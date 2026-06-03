import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

type AuthResult =
  | { ok: true; body: Record<string, unknown>; isServiceRole: boolean; userId?: string }
  | { ok: false; status: number; error: string; details?: Record<string, unknown> }

type TokenDescription = {
  prefix: string
  looksLikeJwt: boolean
  role?: string
  iss?: string
}

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get("Authorization")
  if (!auth?.startsWith("Bearer ")) return null
  const token = auth.slice(7).trim()
  return token.length > 0 ? token : null
}

function getApiKeyHeader(req: Request): string | null {
  const apikey = req.headers.get("apikey")?.trim()
  return apikey && apikey.length > 0 ? apikey : null
}

function describeToken(token: string | null): TokenDescription {
  if (!token) return { prefix: "(vazio)", looksLikeJwt: false }

  const parts = token.split(".")
  if (parts.length !== 3) {
    return { prefix: `${token.slice(0, 12)}...`, looksLikeJwt: false }
  }

  try {
    const payloadJson = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
    const payload = JSON.parse(payloadJson) as { role?: string; iss?: string }
    return {
      prefix: `${token.slice(0, 12)}...`,
      looksLikeJwt: true,
      role: payload.role,
      iss: payload.iss,
    }
  } catch {
    return { prefix: `${token.slice(0, 12)}...`, looksLikeJwt: false }
  }
}

function isServiceRoleToken(token: string): boolean {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  return serviceKey.length > 0 && token === serviceKey
}

async function parseJsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const text = await req.text()
    if (!text.trim()) return {}
    const parsed = JSON.parse(text)
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

function jsonError(
  error: string,
  status: number,
  details?: Record<string, unknown>,
): Response {
  return new Response(
    JSON.stringify(details ? { error, details } : { error }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  )
}

function logRequestContext(
  functionName: string,
  req: Request,
  body: Record<string, unknown>,
  extra: Record<string, unknown> = {},
): void {
  const bearer = getBearerToken(req)
  const apikey = getApiKeyHeader(req)
  const source = typeof body.source === "string" ? body.source : undefined

  console.log(
    JSON.stringify({
      event: "edge_request_received",
      function: functionName,
      method: req.method,
      userAgent: req.headers.get("user-agent") ?? null,
      source: source ?? null,
      hasAuthorizationHeader: Boolean(req.headers.get("Authorization")),
      hasApiKeyHeader: Boolean(apikey),
      bearerToken: describeToken(bearer),
      apiKeyToken: describeToken(apikey),
      contentType: req.headers.get("content-type") ?? null,
      ...extra,
    }),
  )
}

function logAuthFailure(
  functionName: string,
  reason: string,
  details: Record<string, unknown>,
): void {
  console.error(
    JSON.stringify({
      event: "edge_auth_failed",
      function: functionName,
      reason,
      ...details,
    }),
  )
}

async function persistEdgeFunctionLog(
  supabaseAdmin: SupabaseClient,
  entry: {
    function_name: string
    source?: string
    status: string
    http_status?: number
    message?: string
    details?: Record<string, unknown>
  },
): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from("edge_function_logs").insert({
      function_name: entry.function_name,
      source: entry.source ?? null,
      status: entry.status,
      http_status: entry.http_status ?? null,
      message: entry.message ?? null,
      details: entry.details ?? null,
    })

    if (error) {
      console.warn(
        JSON.stringify({
          event: "edge_log_persist_failed",
          function: entry.function_name,
          error: error.message,
        }),
      )
    }
  } catch (err) {
    console.warn(
      JSON.stringify({
        event: "edge_log_persist_failed",
        function: entry.function_name,
        error: err instanceof Error ? err.message : String(err),
      }),
    )
  }
}

async function authorizeEdgeRequest(
  functionName: string,
  req: Request,
  body: Record<string, unknown>,
  options: { staffProfiles?: string[]; automatedSources?: string[] } = {},
): Promise<AuthResult> {
  const automatedSources = options.automatedSources ?? ["cron", "webhook"]
  const source = typeof body.source === "string" ? body.source : undefined
  const isAutomatedCall = !source || automatedSources.includes(source)

  const bearer = getBearerToken(req)
  const apikey = getApiKeyHeader(req)
  const serviceRoleCandidate = bearer && isServiceRoleToken(bearer)
    ? bearer
    : apikey && isServiceRoleToken(apikey)
    ? apikey
    : null

  if (isAutomatedCall) {
    if (serviceRoleCandidate) {
      console.log(
        JSON.stringify({
          event: "edge_auth_success",
          function: functionName,
          mode: "service_role",
          source: source ?? "unspecified",
        }),
      )
      return { ok: true, body, isServiceRole: true }
    }

    // Chamadas automáticas confiáveis (cron jobs via pg_net com verify_jwt desligado)
    console.log(
      JSON.stringify({
        event: "edge_auth_success",
        function: functionName,
        mode: "automated_trusted",
        source: source ?? "unspecified",
        bearerToken: describeToken(bearer),
      }),
    )
    return { ok: true, body, isServiceRole: true }
  }

  if (!bearer) {
    logAuthFailure(functionName, "Authorization ausente", { source: source ?? null })
    return { ok: false, status: 401, error: "Authorization required" }
  }

  if (isServiceRoleToken(bearer)) {
    return { ok: true, body, isServiceRole: true }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${bearer}` } },
  })

  const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
  if (userError || !user) {
    logAuthFailure(functionName, "Sessão inválida", {
      source: source ?? null,
      bearerToken: describeToken(bearer),
      authError: userError?.message ?? null,
    })
    return { ok: false, status: 401, error: "Sessão inválida" }
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
  const staffProfiles = options.staffProfiles ?? ["admin", "direcao"]
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("profile, ativo")
    .eq("id", user.id)
    .single()

  if (profileError || !profile?.ativo) {
    logAuthFailure(functionName, "Usuário inativo ou sem perfil", {
      userId: user.id,
      profileError: profileError?.message ?? null,
    })
    return { ok: false, status: 403, error: "Usuário inativo ou sem perfil" }
  }

  if (!staffProfiles.includes(profile.profile)) {
    logAuthFailure(functionName, "Permissão insuficiente", {
      userId: user.id,
      profile: profile.profile,
      allowedProfiles: staffProfiles,
    })
    return { ok: false, status: 403, error: "Permissão insuficiente" }
  }

  console.log(
    JSON.stringify({
      event: "edge_auth_success",
      function: functionName,
      mode: "user",
      userId: user.id,
      profile: profile.profile,
    }),
  )

  return { ok: true, body, isServiceRole: false, userId: user.id }
}

const FUNCTION_NAME = "check-missed-interviews"

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  )

  let body: Record<string, unknown> = {}
  let source: string | undefined

  try {
    body = await parseJsonBody(req)
    source = typeof body.source === "string" ? body.source : undefined
    logRequestContext(FUNCTION_NAME, req, body)

    const auth = await authorizeEdgeRequest(FUNCTION_NAME, req, body, {
      staffProfiles: ["admin", "direcao", "entrevistador"],
    })

    if (!auth.ok) {
      await persistEdgeFunctionLog(supabaseAdmin, {
        function_name: FUNCTION_NAME,
        source,
        status: "auth_failed",
        http_status: auth.status,
        message: auth.error,
        details: auth.details,
      })

      return jsonError(auth.error, auth.status, auth.details)
    }

    await persistEdgeFunctionLog(supabaseAdmin, {
      function_name: FUNCTION_NAME,
      source,
      status: "started",
      message: "Execução iniciada",
    })

    const supabaseClient = supabaseAdmin

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split("T")[0]

    console.log(
      JSON.stringify({
        event: "edge_run_started",
        function: FUNCTION_NAME,
        source: source ?? null,
        checkDate: yesterdayStr,
      }),
    )

    const { data: studentsWithMissedInterviews, error: fetchError } = await supabaseClient
      .from("students")
      .select("id, student_name, interview_date")
      .eq("status", "atendimento_agendado")
      .eq("interview_date", yesterdayStr)
      .not("status", "eq", "matriculado")

    if (fetchError) {
      throw fetchError
    }

    if (studentsWithMissedInterviews && studentsWithMissedInterviews.length > 0) {
      const { error: updateError } = await supabaseClient
        .from("students")
        .update({ status: "faltou_ao_atendimento" })
        .in("id", studentsWithMissedInterviews.map((s) => s.id))

      if (updateError) {
        throw updateError
      }

      const interactions = studentsWithMissedInterviews.map((student) => ({
        student_id: student.id,
        interaction_type: "mudanca_status",
        comments: `Status automaticamente alterado para "Faltou ao Atendimento" - entrevista agendada para ${new Date(student.interview_date).toLocaleDateString("pt-BR")} não foi registrada.`,
      }))

      const { error: interactionError } = await supabaseClient
        .from("student_interactions")
        .insert(interactions)

      if (interactionError) {
        console.error("Error inserting interactions:", interactionError)
      }

      const result = {
        message: `Updated ${studentsWithMissedInterviews.length} students to "faltou_ao_atendimento"`,
        updated_students: studentsWithMissedInterviews.length,
      }

      console.log(JSON.stringify({ event: "edge_run_success", function: FUNCTION_NAME, ...result }))

      await persistEdgeFunctionLog(supabaseAdmin, {
        function_name: FUNCTION_NAME,
        source,
        status: "success",
        http_status: 200,
        message: result.message,
        details: result,
      })

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      })
    }

    const result = { message: "No missed interviews found" }

    console.log(JSON.stringify({ event: "edge_run_success", function: FUNCTION_NAME, ...result }))

    await persistEdgeFunctionLog(supabaseAdmin, {
      function_name: FUNCTION_NAME,
      source,
      status: "success",
      http_status: 200,
      message: result.message,
      details: result,
    })

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(
      JSON.stringify({
        event: "edge_run_error",
        function: FUNCTION_NAME,
        source: source ?? null,
        error: message,
      }),
    )

    await persistEdgeFunctionLog(supabaseAdmin, {
      function_name: FUNCTION_NAME,
      source,
      status: "error",
      http_status: 400,
      message,
    })

    return new Response(
      JSON.stringify({ error: message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      },
    )
  }
})
