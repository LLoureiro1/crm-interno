import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type AuthResult =
  | { ok: true; body: Record<string, unknown>; isServiceRole: boolean; userId?: string }
  | { ok: false; status: number; error: string }

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return auth.slice(7).trim()
}

function isServiceRoleToken(token: string): boolean {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  return serviceKey.length > 0 && token === serviceKey
}

async function parseJsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const text = await req.text()
    if (!text.trim()) return {}
    const parsed = JSON.parse(text)
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

function jsonError(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function authorizeEdgeRequest(
  req: Request,
  body: Record<string, unknown>,
  options: { staffProfiles?: string[]; automatedSources?: string[] } = {},
): Promise<AuthResult> {
  const token = getBearerToken(req)
  if (!token) {
    return { ok: false, status: 401, error: 'Authorization required' }
  }

  const automatedSources = options.automatedSources ?? ['cron', 'webhook']
  const source = typeof body.source === 'string' ? body.source : undefined
  const isAutomatedCall = !source || automatedSources.includes(source)

  if (isServiceRoleToken(token)) {
    return { ok: true, body, isServiceRole: true }
  }

  if (isAutomatedCall) {
    return { ok: false, status: 403, error: 'Chamadas automáticas exigem service role' }
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
  if (userError || !user) {
    return { ok: false, status: 401, error: 'Sessão inválida' }
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
  const staffProfiles = options.staffProfiles ?? ['admin', 'direcao']
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('profile, ativo')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.ativo) {
    return { ok: false, status: 403, error: 'Usuário inativo ou sem perfil' }
  }

  if (!staffProfiles.includes(profile.profile)) {
    return { ok: false, status: 403, error: 'Permissão insuficiente' }
  }

  return { ok: true, body, isServiceRole: false, userId: user.id }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await parseJsonBody(req)
    const auth = await authorizeEdgeRequest(req, body, {
      staffProfiles: ['admin', 'direcao', 'entrevistador'],
    })

    if (!auth.ok) {
      return jsonError(auth.error, auth.status)
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get yesterday's date
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    // Find students with interview scheduled for yesterday and status still "atendimento_agendado"
    // NUNCA alterar alunos matriculados
    const { data: studentsWithMissedInterviews, error: fetchError } = await supabaseClient
      .from('students')
      .select('id, student_name, interview_date')
      .eq('status', 'atendimento_agendado')
      .eq('interview_date', yesterdayStr)
      .not('status', 'eq', 'matriculado')

    if (fetchError) {
      throw fetchError
    }

    // Update status to "faltou_ao_atendimento" for these students
    if (studentsWithMissedInterviews && studentsWithMissedInterviews.length > 0) {
      const { error: updateError } = await supabaseClient
        .from('students')
        .update({ status: 'faltou_ao_atendimento' })
        .in('id', studentsWithMissedInterviews.map(s => s.id))

      if (updateError) {
        throw updateError
      }

      // Add interaction records for each student
      const interactions = studentsWithMissedInterviews.map(student => ({
        student_id: student.id,
        interaction_type: 'mudanca_status',
        comments: `Status automaticamente alterado para "Faltou ao Atendimento" - entrevista agendada para ${new Date(student.interview_date).toLocaleDateString('pt-BR')} não foi registrada.`
      }))

      const { error: interactionError } = await supabaseClient
        .from('student_interactions')
        .insert(interactions)

      if (interactionError) {
        console.error('Error inserting interactions:', interactionError)
      }

      return new Response(
        JSON.stringify({ 
          message: `Updated ${studentsWithMissedInterviews.length} students to "faltou_ao_atendimento"`,
          updated_students: studentsWithMissedInterviews.length
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    return new Response(
      JSON.stringify({ message: 'No missed interviews found' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})