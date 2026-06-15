/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const FUNCTION_NAME = "email-automation";

/** Limites de envio ao Google Apps Script (configuráveis via secrets da Edge Function). */
type QueueThrottleConfig = {
  batchSize: number;
  webhookBatchSize: number;
  sendDelayMs: number;
  staggerMs: number;
  maxAttempts: number;
  retryBaseDelayMs: number;
};

function parseEnvInt(name: string, fallback: number, min = 0, max = 600_000): number {
  const raw = Deno.env.get(name);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function getQueueThrottleConfig(): QueueThrottleConfig {
  return {
    batchSize: parseEnvInt("EMAIL_QUEUE_BATCH_SIZE", 5, 1, 50),
    webhookBatchSize: parseEnvInt("EMAIL_QUEUE_WEBHOOK_BATCH_SIZE", 2, 1, 20),
    sendDelayMs: parseEnvInt("EMAIL_QUEUE_SEND_DELAY_MS", 3000, 500, 60_000),
    staggerMs: parseEnvInt("EMAIL_QUEUE_STAGGER_MS", 2500, 500, 120_000),
    maxAttempts: parseEnvInt("EMAIL_QUEUE_MAX_ATTEMPTS", 5, 1, 20),
    retryBaseDelayMs: parseEnvInt("EMAIL_QUEUE_RETRY_BASE_DELAY_MS", 60_000, 5_000, 600_000),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Espaça horários de enfileiramento quando muitos e-mails entram de uma vez. */
function createQueueStagger(staggerMs = getQueueThrottleConfig().staggerMs) {
  let index = 0;
  return {
    next(base: Date | string = new Date()): string {
      const baseMs = typeof base === "string" ? new Date(base).getTime() : base.getTime();
      const scheduledMs = baseMs + index * staggerMs;
      index += 1;
      return new Date(scheduledMs).toISOString();
    },
  };
}

function isTransientSendError(error: unknown, httpStatus?: number): boolean {
  if (isAppsScriptError(error) && !error.transient) {
    return false;
  }
  if (httpStatus && [408, 429, 500, 502, 503, 504].includes(httpStatus)) {
    return true;
  }
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("too many") ||
    message.includes("service invoked") ||
    message.includes("lock") ||
    message.includes("busy") ||
    message.includes("temporarily") ||
    message.includes("try again")
  );
}

/** Falha originada no Google Apps Script / Workspace (não na Edge Function). */
class AppsScriptError extends Error {
  readonly origin = "apps_script" as const;
  readonly httpStatus?: number;
  readonly rawResponse?: unknown;
  readonly transient: boolean;
  readonly code?: string;

  constructor(
    message: string,
    options: {
      httpStatus?: number;
      rawResponse?: unknown;
      transient?: boolean;
      code?: string;
    } = {},
  ) {
    super(message);
    this.name = "AppsScriptError";
    this.httpStatus = options.httpStatus;
    this.rawResponse = options.rawResponse;
    this.transient = options.transient ?? false;
    this.code = options.code;
  }
}

function isAppsScriptError(error: unknown): error is AppsScriptError {
  return error instanceof AppsScriptError ||
    (error instanceof Error && (error as AppsScriptError).origin === "apps_script");
}

function logAppsScriptFailure(
  event: string,
  details: Record<string, unknown>,
): void {
  logEmailEvent("error", event, {
    failure_origin: "apps_script",
    ...details,
  });
}

function formatQueueErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Erro desconhecido";
  if (isAppsScriptError(error)) {
    return `[Google Workspace] ${message}`;
  }
  return message;
}

function computeRetryScheduledFor(attempts: number): string {
  const { retryBaseDelayMs } = getQueueThrottleConfig();
  const delayMs = retryBaseDelayMs * Math.pow(2, Math.max(0, attempts - 1));
  return new Date(Date.now() + delayMs).toISOString();
}

async function countDuePendingEmails(
  supabase: ReturnType<typeof createClient>,
): Promise<number> {
  const { count, error } = await supabase
    .from("email_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString());

  if (error) {
    logEmailEvent("warn", "queue_remaining_count_failed", { error: error.message });
    return 0;
  }
  return count ?? 0;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-email-webhook-secret",
};

type LogLevel = "info" | "warn" | "error";

type AuthResult =
  | { ok: true; body: Record<string, unknown>; isServiceRole: boolean; userId?: string }
  | { ok: false; status: number; error: string; details?: Record<string, unknown> };

type TokenDescription = {
  prefix: string;
  looksLikeJwt: boolean;
  role?: string;
};

function logEmailEvent(
  level: LogLevel,
  event: string,
  details: Record<string, unknown> = {},
): void {
  const payload = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    function: FUNCTION_NAME,
    ...details,
  });

  if (level === "error") console.error(payload);
  else if (level === "warn") console.warn(payload);
  else console.log(payload);
}

function describeToken(token: string | null): TokenDescription {
  if (!token) return { prefix: "(vazio)", looksLikeJwt: false };

  const parts = token.split(".");
  if (parts.length !== 3) {
    return { prefix: `${token.slice(0, 12)}...`, looksLikeJwt: false };
  }

  try {
    const payloadJson = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(payloadJson) as { role?: string };
    return {
      prefix: `${token.slice(0, 12)}...`,
      looksLikeJwt: true,
      role: payload.role,
    };
  } catch {
    return { prefix: `${token.slice(0, 12)}...`, looksLikeJwt: false };
  }
}

function logRequestContext(
  req: Request,
  body: Record<string, unknown>,
  runId: string,
  extra: Record<string, unknown> = {},
): void {
  const bearer = getBearerToken(req);
  const webhookSecret = getEmailWebhookSecret(req);
  const source = typeof body.source === "string" ? body.source : undefined;

  logEmailEvent("info", "request_received", {
    runId,
    method: req.method,
    userAgent: req.headers.get("user-agent") ?? null,
    source: source ?? null,
    triggerType: typeof body.trigger_type === "string" ? body.trigger_type : null,
    hasAuthorizationHeader: Boolean(req.headers.get("Authorization")),
    hasWebhookSecretHeader: Boolean(webhookSecret),
    bearerToken: describeToken(bearer),
    contentType: req.headers.get("content-type") ?? null,
    ...extra,
  });
}

async function persistEdgeFunctionLog(
  supabaseAdmin: SupabaseClient,
  entry: {
    function_name: string;
    source?: string;
    status: string;
    http_status?: number;
    message?: string;
    details?: Record<string, unknown>;
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
    });

    if (error) {
      logEmailEvent("warn", "log_persist_failed", {
        status: entry.status,
        dbError: error.message,
      });
    }
  } catch (err) {
    logEmailEvent("warn", "log_persist_failed", {
      status: entry.status,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7).trim();
}

function isServiceRoleToken(token: string): boolean {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return serviceKey.length > 0 && token === serviceKey;
}

async function parseJsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const text = await req.text();
    if (!text.trim()) return {};
    const parsed = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
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
  );
}

function getEmailWebhookSecret(req: Request): string | null {
  const secret = req.headers.get("x-email-webhook-secret");
  return secret?.trim() ? secret.trim() : null;
}

function isValidEmailWebhookSecret(secret: string | null): boolean {
  const expected = Deno.env.get("EMAIL_AUTOMATION_WEBHOOK_SECRET") ?? "";
  return expected.length > 0 && secret === expected;
}

async function authorizeEdgeRequest(
  req: Request,
  body: Record<string, unknown>,
  options: { staffProfiles?: string[]; automatedSources?: string[] } = {},
): Promise<AuthResult> {
  const automatedSources = options.automatedSources ?? ["cron", "webhook"];
  const source = typeof body.source === "string" ? body.source : undefined;
  const isAutomatedCall = !source || automatedSources.includes(source);

  if (isAutomatedCall) {
    const token = getBearerToken(req);
    if (token && isServiceRoleToken(token)) {
      logEmailEvent("info", "auth_success", {
        mode: "service_role",
        source: source ?? "unspecified",
      });
      return { ok: true, body, isServiceRole: true };
    }

    const webhookSecret = getEmailWebhookSecret(req);
    const expected = Deno.env.get("EMAIL_AUTOMATION_WEBHOOK_SECRET") ?? "";

    if (webhookSecret && expected.length > 0) {
      if (!isValidEmailWebhookSecret(webhookSecret)) {
        const details = {
          source: source ?? null,
          authMode: "webhook_secret",
          hint: "x-email-webhook-secret não confere com EMAIL_AUTOMATION_WEBHOOK_SECRET",
        };
        logEmailEvent("error", "auth_failed", details);
        return {
          ok: false,
          status: 403,
          error: "x-email-webhook-secret inválido",
          details,
        };
      }
      logEmailEvent("info", "auth_success", {
        mode: "webhook_secret",
        source: source ?? "unspecified",
      });
      return { ok: true, body, isServiceRole: true };
    }

    // Trigger/cron via pg_net: secrets ficam só na Edge Function (verify_jwt desligado)
    logEmailEvent("info", "auth_success", {
      mode: "automated_trusted",
      source: source ?? "unspecified",
      bearerToken: describeToken(token),
    });
    return { ok: true, body, isServiceRole: true };
  }

  const token = getBearerToken(req);
  if (!token) {
    logEmailEvent("error", "auth_failed", {
      reason: "authorization_ausente",
      source: source ?? null,
    });
    return { ok: false, status: 401, error: "Authorization required" };
  }

  if (isServiceRoleToken(token)) {
    logEmailEvent("info", "auth_success", { mode: "service_role", source: source ?? null });
    return { ok: true, body, isServiceRole: true };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
    error: userError,
  } = await supabaseUser.auth.getUser();

  if (userError || !user) {
    logEmailEvent("error", "auth_failed", {
      reason: "sessao_invalida",
      authError: userError?.message ?? null,
      bearerToken: describeToken(token),
    });
    return { ok: false, status: 401, error: "Sessão inválida" };
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  const staffProfiles = options.staffProfiles ?? ["admin", "direcao"];
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("profile, ativo")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.ativo) {
    logEmailEvent("error", "auth_failed", {
      reason: "usuario_inativo_ou_sem_perfil",
      userId: user.id,
      profileError: profileError?.message ?? null,
    });
    return { ok: false, status: 403, error: "Usuário inativo ou sem perfil" };
  }

  if (!staffProfiles.includes(profile.profile)) {
    logEmailEvent("error", "auth_failed", {
      reason: "permissao_insuficiente",
      userId: user.id,
      profile: profile.profile,
      allowedProfiles: staffProfiles,
    });
    return { ok: false, status: 403, error: "Permissão insuficiente" };
  }

  logEmailEvent("info", "auth_success", {
    mode: "user",
    userId: user.id,
    profile: profile.profile,
  });
  return { ok: true, body, isServiceRole: false, userId: user.id };
}

type EmailTriggerType =
  | "student_registered"
  | "appointment_scheduled"
  | "appointment_scheduled_staff"
  | "appointment_reminder_same_day"
  | "exam_reminder_1_day_before"
  | "attended_over_a_week_ago"
  | "missed_appointment_reschedule"
  | "invite_to_schedule"
  | "exam_reminder_same_day"
  | "post_attendance_followup"
  | "post_attendance_3_days"
  | "matricula_concluida"
  | "staff_new_lead_no_appointment"
  | "staff_missed_appointment_no_reschedule"
  | "staff_proposal_no_response";

interface TemplateContext {
  student_name?: string;
  responsible_name?: string;
  email?: string;
  tracking_code?: string;
  status?: string;
  unit_name?: string;
  unit_address?: string;
  unit_city?: string;
  unit_phone?: string;
  class_name?: string;
  exam_date?: string;
  exam_time?: string;
  appointment_date?: string;
  appointment_time?: string;
  appointment_modality?: string;
  interviewer_name?: string;
  reschedule_link?: string;
  student_count?: string;
  student_list?: string;
}

interface EmailTemplate {
  id: string;
  unit_id: string | null;
  trigger_type: EmailTriggerType;
  subject: string;
  html_body: string;
  is_active: boolean;
  send_offset_days: number;
  send_at_hour: number;
  send_at_minute: number;
  recipient_user_ids?: string[] | null;
}

interface EmailIntegration {
  sender_email: string;
  sender_name: string;
  webhook_url: string | null;
  is_active: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const runId = crypto.randomUUID().slice(0, 8);
  const url = new URL(req.url);
  const querySource = url.searchParams.get("source");

  if (req.method === "GET" && querySource === "tracking") {
    const emailId = url.searchParams.get("id");
    logEmailEvent("info", "tracking_pixel", { runId, emailId: emailId ?? null });

    if (emailId) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      );
      await handleTracking(supabase, emailId, runId);
    }

    const pixel = Uint8Array.from(
      atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"),
      (c) => c.charCodeAt(0),
    );
    return new Response(pixel, {
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        ...corsHeaders,
      },
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  let body: Record<string, unknown> = {};
  let source: string | undefined;

  try {
    body = await parseJsonBody(req);
    source = typeof body.source === "string" ? body.source : undefined;
    logRequestContext(req, body, runId);

    const auth = await authorizeEdgeRequest(req, body, {
      staffProfiles: ["admin"],
      automatedSources: ["cron", "webhook", "process_queue"],
    });

    if (!auth.ok) {
      await persistEdgeFunctionLog(supabaseAdmin, {
        function_name: FUNCTION_NAME,
        source,
        status: "auth_failed",
        http_status: auth.status,
        message: auth.error,
        details: { runId, ...auth.details },
      });
      return jsonError(auth.error, auth.status, auth.details);
    }

    await persistEdgeFunctionLog(supabaseAdmin, {
      function_name: FUNCTION_NAME,
      source,
      status: "started",
      message: "Execução iniciada",
      details: { runId },
    });

    const supabase = supabaseAdmin;
    source = auth.body.source as string | undefined;

    logEmailEvent("info", "run_started", { runId, source: source ?? null });

    let result: Record<string, unknown>;

    if (source === "cron") {
      const reminders = await scheduleReminders(supabase, runId);
      const processed = await processQueue(supabase, runId, { source: "cron" });
      result = { success: true, reminders, processed };
    } else if (source === "webhook") {
      const queued = await handleWebhook(supabase, auth.body, runId);
      if (
        queued && typeof queued === "object" && "skipped" in queued &&
        queued.skipped
      ) {
        logEmailEvent("warn", "webhook_skipped", {
          runId,
          reason: (queued as { reason?: string }).reason ?? "desconhecido",
          triggerType: auth.body.trigger_type ?? null,
        });
      } else {
        logEmailEvent("info", "webhook_queued", {
          runId,
          triggerType: auth.body.trigger_type ?? null,
          queued,
        });
      }
      const processed = await processQueue(supabase, runId, { source: "webhook" });
      if (processed.failed > 0) {
        logEmailEvent("warn", "queue_partial_failure", { runId, processed });
      }
      if ((processed.remaining ?? 0) > 0) {
        logEmailEvent("info", "queue_backlog_remaining", {
          runId,
          remaining: processed.remaining,
          hint: "próximo ciclo do cron process-queue drenará o restante",
        });
      }
      result = { success: true, queued, processed };
    } else if (source === "process_queue") {
      const processed = await processQueue(supabase, runId, { source: "process_queue" });
      result = { success: true, processed };
    } else {
      logEmailEvent("warn", "invalid_source", { runId, source: source ?? null });
      await persistEdgeFunctionLog(supabaseAdmin, {
        function_name: FUNCTION_NAME,
        source,
        status: "error",
        http_status: 400,
        message: "source inválido",
        details: { runId, source: source ?? null },
      });
      return jsonResponse({ error: "source inválido" }, 400);
    }

    logEmailEvent("info", "run_success", { runId, source: source ?? null, result });

    await persistEdgeFunctionLog(supabaseAdmin, {
      function_name: FUNCTION_NAME,
      source,
      status: "success",
      http_status: 200,
      message: "Execução concluída",
      details: { runId, ...result },
    });

    return jsonResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    logEmailEvent("error", "run_error", {
      runId,
      source: source ?? null,
      error: message,
      stack: error instanceof Error ? error.stack ?? null : null,
    });

    await persistEdgeFunctionLog(supabaseAdmin, {
      function_name: FUNCTION_NAME,
      source,
      status: "error",
      http_status: 500,
      message,
      details: { runId },
    });

    return jsonResponse({ error: message }, 500);
  }
});

async function handleWebhook(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  runId: string,
) {
  const triggerType = body.trigger_type as EmailTriggerType;
  const record = body.record as Record<string, unknown> | undefined;

  logEmailEvent("info", "webhook_received", {
    runId,
    triggerType: triggerType ?? null,
    table: body.table ?? null,
    recordId: record?.id ?? null,
  });

  if (!record) {
    return { skipped: true, reason: "record ausente" };
  }

  if (triggerType === "student_registered") {
    return queueStudentEmail(supabase, triggerType, record);
  }

  if (triggerType === "appointment_scheduled") {
    return queueAppointmentEmails(supabase, record, runId);
  }

  if (triggerType === "missed_appointment_reschedule") {
    return queueMissedRescheduleEmail(supabase, record, runId);
  }

  if (triggerType === "matricula_concluida") {
    return queueStudentEmail(supabase, triggerType, record);
  }

  return { skipped: true, reason: "trigger não tratado" };
}

function buildRescheduleLink(studentId: string, registrationToken: string): string {
  const base = (Deno.env.get("PUBLIC_APP_URL") ?? "").replace(/\/$/, "");
  const path = `/reagendar?s=${encodeURIComponent(studentId)}&t=${encodeURIComponent(registrationToken)}`;
  return base ? `${base}${path}` : path;
}

function buildStudentProfileLink(studentId: string): string {
  const base = (Deno.env.get("PUBLIC_APP_URL") ?? "").replace(/\/$/, "");
  const path = `/student/${encodeURIComponent(studentId)}`;
  return base ? `${base}${path}` : path;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildStaffStudentListHtml(
  students: StudentEmailRow[],
  rowStripeColor = "#fef3c7",
): string {
  if (students.length === 0) return "";

  const rows = students.map((student, index) => {
    const link = buildStudentProfileLink(String(student.id));
    const name = escapeHtml(String(student.student_name ?? ""));
    const responsible = escapeHtml(String(student.responsible_name ?? ""));
    const code = escapeHtml(String(student.tracking_code ?? ""));
    const bg = index % 2 === 1 ? `background:${rowStripeColor};` : "";

    return `<tr style="${bg}">
      <td style="padding:8px;"><a href="${link}" style="color:#2563eb;font-weight:600;">${name}</a></td>
      <td style="padding:8px;">${responsible}</td>
      <td style="padding:8px;">${code}</td>
    </tr>`;
  }).join("");

  return `<table style="width:100%;border-collapse:collapse;margin:16px 0;">
    <thead>
      <tr style="background:#f3f4f6;">
        <th style="padding:8px;text-align:left;">Aluno</th>
        <th style="padding:8px;text-align:left;">Responsável</th>
        <th style="padding:8px;text-align:left;">Código</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

async function buildStaffDigestContext(
  supabase: ReturnType<typeof createClient>,
  unitId: string | null,
  students: StudentEmailRow[],
  rowStripeColor: string,
): Promise<TemplateContext & { unit_id?: string | null }> {
  const context: TemplateContext & { unit_id?: string | null } = {
    student_count: String(students.length),
    student_list: buildStaffStudentListHtml(students, rowStripeColor),
    unit_id: unitId,
  };

  if (unitId) {
    const { data: unit } = await supabase
      .from("units")
      .select("name, address, city, phone")
      .eq("id", unitId)
      .maybeSingle();

    if (unit) {
      context.unit_name = unit.name;
      context.unit_address = unit.address;
      context.unit_city = unit.city;
      context.unit_phone = unit.phone;
    }
  }

  return context;
}

type StaffDigestTrigger =
  | "staff_new_lead_no_appointment"
  | "staff_missed_appointment_no_reschedule";

async function queueStaffDigestEmails(
  supabase: ReturnType<typeof createClient>,
  params: {
    triggerType: StaffDigestTrigger;
    students: StudentEmailRow[];
    today: Date;
    todayStr: string;
    rowStripeColor: string;
    stagger: ReturnType<typeof createQueueStagger>;
  },
): Promise<number> {
  const byUnit = new Map<string | null, StudentEmailRow[]>();

  for (const student of params.students) {
    const unitId = student.unit_id ? String(student.unit_id) : null;
    const bucket = byUnit.get(unitId) ?? [];
    bucket.push(student);
    byUnit.set(unitId, bucket);
  }

  let queuedCount = 0;

  for (const [unitId, unitStudents] of byUnit) {
    if (unitStudents.length === 0) continue;

    const template = await resolveTemplate(
      supabase,
      params.triggerType,
      unitId,
    );
    if (!template?.is_active) continue;

    const recipients = await resolveStaffRecipients(
      supabase,
      template,
      unitId,
    );
    if (recipients.length === 0) continue;

    const context = await buildStaffDigestContext(
      supabase,
      unitId,
      unitStudents,
      params.rowStripeColor,
    );
    const scheduledFor = buildScheduledTimestamp(
      params.today,
      template.send_at_hour,
      template.send_at_minute,
    );
    const unitKey = unitId ?? "global";

    for (const recipient of recipients) {
      if (!recipient.email) continue;

      const result = await insertQueueItem(supabase, {
        studentId: String(unitStudents[0].id),
        unitId,
        template,
        triggerType: params.triggerType,
        toEmail: recipient.email,
        toName: recipient.name,
        context,
        idempotencyKey:
          `${params.triggerType}:${unitKey}:${recipient.id}:${params.todayStr}`,
        scheduledFor: params.stagger.next(scheduledFor),
      });
      if (!result.skipped) queuedCount += 1;
    }
  }

  return queuedCount;
}

async function queueMissedRescheduleEmail(
  supabase: ReturnType<typeof createClient>,
  record: Record<string, unknown>,
  runId: string,
) {
  const studentId = String(record.id);
  const email = String(record.email ?? "").trim();
  const registrationToken = String(record.registration_token ?? "").trim();

  if (!email) {
    return {
      skipped: true,
      reason: "aluno sem e-mail cadastrado",
    };
  }

  if (!registrationToken) {
    logEmailEvent("warn", "missed_reschedule_no_token", { runId, studentId });
    return {
      skipped: true,
      reason: "registration_token ausente no cadastro do aluno",
    };
  }

  const context = await buildStudentContext(supabase, studentId, record);
  context.reschedule_link = buildRescheduleLink(studentId, registrationToken);

  const template = await resolveTemplate(
    supabase,
    "missed_appointment_reschedule",
    context.unit_id ?? null,
  );

  if (!template) {
    return {
      skipped: true,
      reason: "nenhum template ativo para missed_appointment_reschedule",
    };
  }

  const interviewDate = String(record.interview_date ?? "").trim() ||
    formatIsoDate(new Date());
  const idempotencyKey =
    `missed_appointment_reschedule:${studentId}:${interviewDate}`;

  const { data: existingItem } = await supabase
    .from("email_queue")
    .select("id, status")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existingItem) {
    logEmailEvent("info", "missed_reschedule_duplicate_skipped", {
      runId,
      studentId,
      idempotencyKey,
      existingStatus: existingItem.status,
    });
    return {
      skipped: true,
      reason: "e-mail de reagendamento já enfileirado para esta falta",
    };
  }

  const scheduledFor = resolveScheduledForFromTemplate(template);

  logEmailEvent("info", "missed_reschedule_queued", {
    runId,
    studentId,
    toEmail: email,
    rescheduleLink: context.reschedule_link,
    scheduledFor,
    sendAtHour: template.send_at_hour,
    sendAtMinute: template.send_at_minute,
    idempotencyKey,
  });

  return insertQueueItem(supabase, {
    studentId,
    unitId: context.unit_id ?? null,
    template,
    triggerType: "missed_appointment_reschedule",
    toEmail: email,
    toName: context.responsible_name || context.student_name,
    context,
    idempotencyKey,
    scheduledFor,
  });
}

async function queueStudentEmail(
  supabase: ReturnType<typeof createClient>,
  triggerType: EmailTriggerType,
  record: Record<string, unknown>,
) {
  const studentId = String(record.id);
  const email = String(record.email ?? "").trim();
  if (!email) {
    return {
      skipped: true,
      reason:
        "aluno sem e-mail cadastrado — inclua o e-mail na inscrição/ficha do aluno",
    };
  }

  const context = await buildStudentContext(supabase, studentId, record);
  const template = await resolveTemplate(
    supabase,
    triggerType,
    context.unit_id ?? null,
  );

  if (!template) {
    return {
      skipped: true,
      reason:
        `nenhum template ativo para ${triggerType} (verifique Configurações → E-mails)`,
    };
  }

  const idempotencyKey = `${triggerType}:${studentId}:${context.status ?? "none"}`;

  return insertQueueItem(supabase, {
    studentId,
    unitId: context.unit_id ?? null,
    template,
    triggerType,
    toEmail: email,
    toName: context.student_name,
    context,
    idempotencyKey,
    scheduledFor: new Date().toISOString(),
  });
}

/** Colunas reais de students (exam_time fica em exam_dates, não em students) */
const STUDENT_EMAIL_SELECT =
  "id, student_name, email, unit_id, status, tracking_code, exam_date, exam_date_id, class_id, responsible_name, registration_token";

type StudentEmailRow = {
  id: string;
  student_name: string;
  email: string;
  unit_id: string | null;
  status: string;
  tracking_code: string | null;
  exam_date: string | null;
  exam_date_id?: string | null;
  class_id: string | null;
  responsible_name?: string | null;
  registration_token?: string | null;
};

async function resolveExamTime(
  supabase: ReturnType<typeof createClient>,
  record: Record<string, unknown>,
): Promise<string> {
  const examDateId = record.exam_date_id
    ? String(record.exam_date_id)
    : null;
  if (!examDateId) return "";

  const { data } = await supabase
    .from("exam_dates")
    .select("exam_time")
    .eq("id", examDateId)
    .maybeSingle();

  return data?.exam_time ? formatTime(String(data.exam_time)) : "";
}

function normalizeStudentRow(
  row: StudentEmailRow | StudentEmailRow[] | null | undefined,
): StudentEmailRow | null {
  if (!row) return null;
  return Array.isArray(row) ? row[0] ?? null : row;
}

type InterviewerProfileRow = {
  id: string;
  name: string;
  email: string;
};

type AppointmentEmailLoad = {
  student: StudentEmailRow;
  appointmentDate: string;
  appointmentTime: string;
  interviewModality: string;
  interviewer: InterviewerProfileRow | null;
};

function normalizeInterviewerRow(
  row: InterviewerProfileRow | InterviewerProfileRow[] | null | undefined,
): InterviewerProfileRow | null {
  if (!row) return null;
  return Array.isArray(row) ? row[0] ?? null : row;
}

function formatInterviewModality(value: string | null | undefined): string {
  if (!value) return "Não informado";
  const normalized = value.toLowerCase().trim();
  if (normalized === "presencial") return "Presencial";
  if (normalized === "a_distancia") return "À distância";
  return value;
}

async function loadAppointmentEmailContext(
  supabase: ReturnType<typeof createClient>,
  appointmentId: string,
  studentIdFromRecord: string | null,
  record: Record<string, unknown>,
  runId: string,
): Promise<AppointmentEmailLoad | { skipped: true; reason: string }> {
  const { data: appointmentRow, error: aptError } = await supabase
    .from("appointments")
    .select(`
      appointment_date,
      appointment_time,
      student_id,
      interviewer_id,
      formato_entrevista,
      students (
        ${STUDENT_EMAIL_SELECT}
      ),
      profiles!appointments_interviewer_id_fkey (
        id,
        name,
        email
      )
    `)
    .eq("id", appointmentId)
    .maybeSingle();

  if (aptError) {
    logEmailEvent("warn", "appointment_notify_load_failed", {
      runId,
      audience: "appointment_scheduled",
      appointmentId,
      error: aptError.message,
    });
  }

  let student = normalizeStudentRow(
    appointmentRow?.students as StudentEmailRow | StudentEmailRow[] | null,
  );

  const studentId = student?.id ??
    studentIdFromRecord ??
    (appointmentRow?.student_id ? String(appointmentRow.student_id) : null);

  if (!student && studentId) {
    const { data: directStudent, error: studentError } = await supabase
      .from("students")
      .select(STUDENT_EMAIL_SELECT)
      .eq("id", studentId)
      .maybeSingle();

    if (studentError) {
      logEmailEvent("warn", "appointment_notify_student_load_failed", {
        runId,
        audience: "appointment_scheduled",
        studentId,
        appointmentId,
        error: studentError.message,
      });
    }
    student = directStudent as StudentEmailRow | null;
  }

  if (!student) {
    return {
      skipped: true,
      reason: `aluno não encontrado para o agendamento (student_id=${studentId ?? "ausente"})`,
    };
  }

  let interviewer = normalizeInterviewerRow(
    appointmentRow?.profiles as InterviewerProfileRow | InterviewerProfileRow[] | null,
  );

  const interviewerIdFromRecord = record.interviewer_id != null &&
      String(record.interviewer_id) !== "null"
    ? String(record.interviewer_id)
    : null;
  const interviewerId = appointmentRow?.interviewer_id
    ? String(appointmentRow.interviewer_id)
    : interviewerIdFromRecord;

  if (!interviewer && interviewerId) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, name, email")
      .eq("id", interviewerId)
      .maybeSingle();

    if (profileError) {
      logEmailEvent("warn", "appointment_notify_interviewer_load_failed", {
        runId,
        audience: "appointment_scheduled_staff",
        appointmentId,
        interviewerId,
        error: profileError.message,
      });
    }
    interviewer = profile as InterviewerProfileRow | null;
  }

  const modalityRaw = appointmentRow?.formato_entrevista ??
    record.formato_entrevista;

  return {
    student,
    appointmentDate: String(
      appointmentRow?.appointment_date ?? record.appointment_date ?? "",
    ),
    appointmentTime: String(
      appointmentRow?.appointment_time ?? record.appointment_time ?? "",
    ),
    interviewModality: formatInterviewModality(
      modalityRaw != null ? String(modalityRaw) : null,
    ),
    interviewer,
  };
}

async function buildAppointmentTemplateContext(
  supabase: ReturnType<typeof createClient>,
  load: AppointmentEmailLoad,
  record: Record<string, unknown>,
): Promise<TemplateContext & { unit_id?: string | null }> {
  const context = await buildStudentContext(
    supabase,
    load.student.id,
    load.student,
  );
  context.appointment_date = formatDate(
    load.appointmentDate || String(record.appointment_date ?? ""),
  );
  context.appointment_time = formatTime(
    load.appointmentTime || String(record.appointment_time ?? ""),
  );
  context.appointment_modality = load.interviewModality;
  if (load.interviewer?.name) {
    context.interviewer_name = load.interviewer.name;
  }
  return context;
}

async function queueAppointmentStudentEmail(
  supabase: ReturnType<typeof createClient>,
  params: {
    appointmentId: string;
    studentId: string;
    studentEmail: string;
    context: TemplateContext & { unit_id?: string | null };
    runId: string;
    scheduledFor: string;
  },
) {
  const template = await resolveTemplate(
    supabase,
    "appointment_scheduled",
    params.context.unit_id ?? null,
  );

  if (!template) {
    logEmailEvent("warn", "appointment_notify_student_skipped", {
      runId: params.runId,
      audience: "appointment_scheduled",
      appointmentId: params.appointmentId,
      studentId: params.studentId,
      reason: "template_inativo_ou_ausente",
    });
    return {
      skipped: true,
      reason:
        "nenhum template ativo para appointment_scheduled (verifique Configurações → E-mails)",
    };
  }

  const result = await insertQueueItem(supabase, {
    studentId: params.studentId,
    appointmentId: params.appointmentId,
    unitId: params.context.unit_id ?? null,
    template,
    triggerType: "appointment_scheduled",
    toEmail: params.studentEmail,
    toName: params.context.student_name,
    context: params.context,
    idempotencyKey: `appointment_scheduled:${params.appointmentId}`,
    scheduledFor: params.scheduledFor,
  });

  if ("queued" in result && result.queued) {
    logEmailEvent("info", "appointment_notify_student_queued", {
      runId: params.runId,
      audience: "appointment_scheduled",
      appointmentId: params.appointmentId,
      studentId: params.studentId,
      toEmail: params.studentEmail,
    });
  }

  return result;
}

async function queueAppointmentStaffEmail(
  supabase: ReturnType<typeof createClient>,
  params: {
    appointmentId: string;
    studentId: string;
    context: TemplateContext & { unit_id?: string | null };
    interviewer: InterviewerProfileRow | null;
    runId: string;
    scheduledFor: string;
  },
) {
  const { appointmentId, studentId, context, interviewer, runId, scheduledFor } = params;

  if (!interviewer?.id) {
    logEmailEvent("warn", "appointment_notify_staff_skipped", {
      runId,
      audience: "appointment_scheduled_staff",
      appointmentId,
      studentId,
      reason: "interviewer_id_ausente",
    });
    return {
      skipped: true,
      reason: "agendamento sem entrevistador definido — e-mail interno não enviado",
    };
  }

  const staffEmail = String(interviewer.email ?? "").trim();
  if (!staffEmail) {
    logEmailEvent("warn", "appointment_notify_staff_skipped", {
      runId,
      audience: "appointment_scheduled_staff",
      appointmentId,
      studentId,
      interviewerId: interviewer.id,
      reason: "colaborador_sem_email_no_perfil",
    });
    return {
      skipped: true,
      reason:
        "colaborador sem e-mail no perfil — cadastre o e-mail do usuário interno para receber o aviso",
    };
  }

  const staffContext: TemplateContext = {
    ...context,
    interviewer_name: interviewer.name || context.interviewer_name || "Colaborador",
  };

  const template = await resolveTemplate(
    supabase,
    "appointment_scheduled_staff",
    context.unit_id ?? null,
  );

  if (!template) {
    logEmailEvent("warn", "appointment_notify_staff_skipped", {
      runId,
      audience: "appointment_scheduled_staff",
      appointmentId,
      studentId,
      interviewerId: interviewer.id,
      reason: "template_inativo_ou_ausente",
    });
    return {
      skipped: true,
      reason:
        "nenhum template ativo para appointment_scheduled_staff (verifique Configurações → E-mails)",
    };
  }

  const result = await insertQueueItem(supabase, {
    studentId,
    appointmentId,
    unitId: context.unit_id ?? null,
    template,
    triggerType: "appointment_scheduled_staff",
    toEmail: staffEmail,
    toName: staffContext.interviewer_name,
    context: staffContext,
    idempotencyKey: `appointment_scheduled_staff:${appointmentId}`,
    scheduledFor,
  });

  if ("queued" in result && result.queued) {
    logEmailEvent("info", "appointment_notify_staff_queued", {
      runId,
      audience: "appointment_scheduled_staff",
      appointmentId,
      studentId,
      interviewerId: interviewer.id,
      toEmail: staffEmail,
      toName: staffContext.interviewer_name,
    });
  }

  return result;
}

async function queueAppointmentEmails(
  supabase: ReturnType<typeof createClient>,
  record: Record<string, unknown>,
  runId: string,
) {
  const appointmentId = String(record.id ?? "");
  if (!appointmentId || appointmentId === "undefined") {
    return { skipped: true, reason: "id do agendamento ausente no webhook" };
  }

  const studentIdFromRecord = record.student_id != null &&
      String(record.student_id) !== "null"
    ? String(record.student_id)
    : null;

  const interviewerIdFromRecord = record.interviewer_id != null &&
      String(record.interviewer_id) !== "null"
    ? String(record.interviewer_id)
    : null;

  logEmailEvent("info", "appointment_notify_started", {
    runId,
    appointmentId,
    studentId: studentIdFromRecord,
    interviewerId: interviewerIdFromRecord,
  });

  const loaded = await loadAppointmentEmailContext(
    supabase,
    appointmentId,
    studentIdFromRecord,
    record,
    runId,
  );

  if ("skipped" in loaded) {
    logEmailEvent("warn", "appointment_notify_aborted", {
      runId,
      appointmentId,
      reason: loaded.reason,
    });
    return loaded;
  }

  const context = await buildAppointmentTemplateContext(supabase, loaded, record);
  const studentId = loaded.student.id;
  const studentEmail = String(loaded.student.email ?? "").trim();
  const stagger = createQueueStagger();

  let studentResult: Record<string, unknown>;
  if (!studentEmail) {
    logEmailEvent("warn", "appointment_notify_student_skipped", {
      runId,
      audience: "appointment_scheduled",
      appointmentId,
      studentId,
      reason: "aluno_sem_email",
    });
    studentResult = {
      skipped: true,
      reason:
        "aluno sem e-mail cadastrado — inclua o e-mail na ficha do aluno para receber confirmação",
    };
  } else {
    studentResult = await queueAppointmentStudentEmail(supabase, {
      appointmentId,
      studentId,
      studentEmail,
      context,
      runId,
      scheduledFor: stagger.next(),
    });
  }

  const staffResult = await queueAppointmentStaffEmail(supabase, {
    appointmentId,
    studentId,
    context,
    interviewer: loaded.interviewer,
    runId,
    scheduledFor: stagger.next(),
  });

  logEmailEvent("info", "appointment_notify_completed", {
    runId,
    appointmentId,
    studentId,
    interviewerId: loaded.interviewer?.id ?? interviewerIdFromRecord,
    studentQueued: "queued" in studentResult && studentResult.queued === true,
    staffQueued: "queued" in staffResult && staffResult.queued === true,
  });

  return {
    appointmentId,
    student: studentResult,
    staff: staffResult,
  };
}

async function scheduleReminders(
  supabase: ReturnType<typeof createClient>,
  runId: string,
) {
  logEmailEvent("info", "schedule_reminders_started", { runId });
  const today = new Date();
  const todayStr = formatIsoDate(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatIsoDate(tomorrow);
  const stagger = createQueueStagger();

  let appointmentCount = 0;
  let examCount = 0;

  const { data: appointments } = await supabase
    .from("appointments")
    .select(`
      id,
      student_id,
      appointment_date,
      appointment_time,
      status,
      students (
        ${STUDENT_EMAIL_SELECT}
      )
    `)
    .eq("appointment_date", todayStr)
    .eq("status", "scheduled");

  for (const appointment of appointments ?? []) {
    const student = appointment.students as Record<string, unknown> | null;
    if (!student?.email) continue;

    const studentId = String(student.id);
    const context = await buildStudentContext(supabase, studentId, student);
    context.appointment_date = formatDate(String(appointment.appointment_date));
    context.appointment_time = formatTime(String(appointment.appointment_time));

    const template = await resolveTemplate(
      supabase,
      "appointment_reminder_same_day",
      context.unit_id ?? null,
    );
    if (!template?.is_active) continue;

    const scheduledFor = buildScheduledTimestamp(
      today,
      template.send_at_hour,
      template.send_at_minute,
    );

    const result = await insertQueueItem(supabase, {
      studentId,
      appointmentId: String(appointment.id),
      unitId: context.unit_id ?? null,
      template,
      triggerType: "appointment_reminder_same_day",
      toEmail: String(student.email),
      toName: context.student_name,
      context,
      idempotencyKey: `appointment_reminder_same_day:${appointment.id}:${todayStr}`,
      scheduledFor: stagger.next(scheduledFor),
    });

    if (!result.skipped) appointmentCount += 1;
  }

  const { data: studentsWithExamTomorrow } = await supabase
    .from("students")
    .select(STUDENT_EMAIL_SELECT)
    .eq("exam_date", tomorrowStr)
    .not("email", "is", null);

  for (const student of studentsWithExamTomorrow ?? []) {
    if (!student.email) continue;

    const context = await buildStudentContext(
      supabase,
      student.id,
      student as Record<string, unknown>,
    );

    const template = await resolveTemplate(
      supabase,
      "exam_reminder_1_day_before",
      context.unit_id ?? null,
    );
    if (!template?.is_active) continue;

    const scheduledFor = buildScheduledTimestamp(
      today,
      template.send_at_hour,
      template.send_at_minute,
    );

    const result = await insertQueueItem(supabase, {
      studentId: student.id,
      unitId: context.unit_id ?? null,
      template,
      triggerType: "exam_reminder_1_day_before",
      toEmail: student.email,
      toName: context.student_name,
      context,
      idempotencyKey: `exam_reminder_1_day_before:${student.id}:${tomorrowStr}`,
      scheduledFor: stagger.next(scheduledFor),
    });

    if (!result.skipped) examCount += 1;
  }

  // --- Pós-atendimento: 7 dias após o atendimento realizado ---
  let postAttendanceCount = 0;
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
  const sevenDaysAgoStr = formatIsoDate(sevenDaysAgo);

  const { data: attendedAppointments } = await supabase
    .from("appointments")
    .select(`
      id,
      student_id,
      appointment_date,
      appointment_time,
      students (
        ${STUDENT_EMAIL_SELECT}
      )
    `)
    .eq("appointment_date", sevenDaysAgoStr)
    .eq("status", "realizado")
    .eq("attended", true);

  for (const appointment of attendedAppointments ?? []) {
    const student = appointment.students as Record<string, unknown> | null;
    if (!student?.email) continue;

    const studentId = String(student.id);
    const context = await buildStudentContext(supabase, studentId, student);
    context.appointment_date = formatDate(String(appointment.appointment_date));
    context.appointment_time = formatTime(String(appointment.appointment_time));

    const template = await resolveTemplate(
      supabase,
      "attended_over_a_week_ago",
      context.unit_id ?? null,
    );
    if (!template?.is_active) continue;

    const scheduledFor = buildScheduledTimestamp(
      today,
      template.send_at_hour,
      template.send_at_minute,
    );

    const result = await insertQueueItem(supabase, {
      studentId,
      appointmentId: String(appointment.id),
      unitId: context.unit_id ?? null,
      template,
      triggerType: "attended_over_a_week_ago",
      toEmail: String(student.email),
      toName: context.student_name,
      context,
      idempotencyKey: `attended_over_a_week_ago:${appointment.id}:${sevenDaysAgoStr}`,
      scheduledFor: stagger.next(scheduledFor),
    });

    if (!result.skipped) postAttendanceCount += 1;
  }

  // --- Lembrete de prova no dia (exam_reminder_same_day) ---
  let examSameDayCount = 0;
  const { data: studentsWithExamToday } = await supabase
    .from("students")
    .select(STUDENT_EMAIL_SELECT)
    .eq("exam_date", todayStr)
    .not("email", "is", null);

  for (const student of studentsWithExamToday ?? []) {
    if (!student.email) continue;
    const context = await buildStudentContext(
      supabase,
      student.id,
      student as Record<string, unknown>,
    );
    const template = await resolveTemplate(
      supabase,
      "exam_reminder_same_day",
      context.unit_id ?? null,
    );
    if (!template?.is_active) continue;
    const scheduledFor = buildScheduledTimestamp(
      today,
      template.send_at_hour,
      template.send_at_minute,
    );
    const result = await insertQueueItem(supabase, {
      studentId: student.id,
      unitId: context.unit_id ?? null,
      template,
      triggerType: "exam_reminder_same_day",
      toEmail: student.email,
      toName: context.student_name,
      context,
      idempotencyKey: `exam_reminder_same_day:${student.id}:${todayStr}`,
      scheduledFor: stagger.next(scheduledFor),
    });
    if (!result.skipped) examSameDayCount += 1;
  }

  // --- Convidar para agendamento (invite_to_schedule) ---
  // Alunos em nenhum_agendamento há mais de 24 horas
  let inviteToScheduleCount = 0;
  const oneDayAgo = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const oneDayAgoIso = oneDayAgo.toISOString();
  const yesterdayStr = formatIsoDate(oneDayAgo);

  const { data: studentsToInvite } = await supabase
    .from("students")
    .select(STUDENT_EMAIL_SELECT)
    .eq("status", "nenhum_agendamento")
    .lt("created_at", oneDayAgoIso)
    .not("email", "is", null);

  for (const student of studentsToInvite ?? []) {
    if (!student.email) continue;
    const registrationToken = (student as StudentEmailRow).registration_token ?? "";
    if (!registrationToken) continue;
    const context = await buildStudentContext(
      supabase,
      student.id,
      student as Record<string, unknown>,
    );
    context.reschedule_link = buildRescheduleLink(student.id, registrationToken);
    const template = await resolveTemplate(
      supabase,
      "invite_to_schedule",
      context.unit_id ?? null,
    );
    if (!template?.is_active) continue;
    const scheduledFor = buildScheduledTimestamp(
      today,
      template.send_at_hour,
      template.send_at_minute,
    );
    const result = await insertQueueItem(supabase, {
      studentId: student.id,
      unitId: context.unit_id ?? null,
      template,
      triggerType: "invite_to_schedule",
      toEmail: student.email,
      toName: context.student_name,
      context,
      idempotencyKey: `invite_to_schedule:${student.id}:${todayStr}`,
      scheduledFor: stagger.next(scheduledFor),
    });
    if (!result.skipped) inviteToScheduleCount += 1;
  }

  // --- Follow-up pós atendimento 1 dia (post_attendance_followup) ---
  let postFollowupCount = 0;

  const { data: followupAppointments } = await supabase
    .from("appointments")
    .select(`
      id,
      student_id,
      appointment_date,
      appointment_time,
      students (
        ${STUDENT_EMAIL_SELECT}
      )
    `)
    .eq("appointment_date", yesterdayStr)
    .eq("status", "realizado")
    .eq("attended", true);

  for (const appointment of followupAppointments ?? []) {
    const student = appointment.students as Record<string, unknown> | null;
    if (!student?.email) continue;
    const studentId = String(student.id);
    const context = await buildStudentContext(supabase, studentId, student);
    context.appointment_date = formatDate(String(appointment.appointment_date));
    context.appointment_time = formatTime(String(appointment.appointment_time));
    const template = await resolveTemplate(
      supabase,
      "post_attendance_followup",
      context.unit_id ?? null,
    );
    if (!template?.is_active) continue;
    const scheduledFor = buildScheduledTimestamp(
      today,
      template.send_at_hour,
      template.send_at_minute,
    );
    const result = await insertQueueItem(supabase, {
      studentId,
      appointmentId: String(appointment.id),
      unitId: context.unit_id ?? null,
      template,
      triggerType: "post_attendance_followup",
      toEmail: String(student.email),
      toName: context.student_name,
      context,
      idempotencyKey: `post_attendance_followup:${appointment.id}:${yesterdayStr}`,
      scheduledFor: stagger.next(scheduledFor),
    });
    if (!result.skipped) postFollowupCount += 1;
  }

  // --- Valor pedagógico 3 dias após atendimento (post_attendance_3_days) ---
  let post3DaysCount = 0;
  const threeDaysAgo = new Date(today);
  threeDaysAgo.setUTCDate(threeDaysAgo.getUTCDate() - 3);
  const threeDaysAgoStr = formatIsoDate(threeDaysAgo);

  const { data: threeDayAppointments } = await supabase
    .from("appointments")
    .select(`
      id,
      student_id,
      appointment_date,
      appointment_time,
      students (
        ${STUDENT_EMAIL_SELECT}
      )
    `)
    .eq("appointment_date", threeDaysAgoStr)
    .eq("status", "realizado")
    .eq("attended", true);

  for (const appointment of threeDayAppointments ?? []) {
    const student = appointment.students as Record<string, unknown> | null;
    if (!student?.email) continue;
    const studentId = String(student.id);
    const context = await buildStudentContext(supabase, studentId, student);
    context.appointment_date = formatDate(String(appointment.appointment_date));
    context.appointment_time = formatTime(String(appointment.appointment_time));
    const template = await resolveTemplate(
      supabase,
      "post_attendance_3_days",
      context.unit_id ?? null,
    );
    if (!template?.is_active) continue;
    const scheduledFor = buildScheduledTimestamp(
      today,
      template.send_at_hour,
      template.send_at_minute,
    );
    const result = await insertQueueItem(supabase, {
      studentId,
      appointmentId: String(appointment.id),
      unitId: context.unit_id ?? null,
      template,
      triggerType: "post_attendance_3_days",
      toEmail: String(student.email),
      toName: context.student_name,
      context,
      idempotencyKey: `post_attendance_3_days:${appointment.id}:${threeDaysAgoStr}`,
      scheduledFor: stagger.next(scheduledFor),
    });
    if (!result.skipped) post3DaysCount += 1;
  }

  // --- [INTERNO] Inscrito sem agendamento 24h (digest diário por unidade) ---
  const { data: leadsWithoutAppointment } = await supabase
    .from("students")
    .select(STUDENT_EMAIL_SELECT)
    .eq("status", "nenhum_agendamento")
    .lt("created_at", oneDayAgoIso);

  const staffNewLeadCount = await queueStaffDigestEmails(supabase, {
    triggerType: "staff_new_lead_no_appointment",
    students: (leadsWithoutAppointment ?? []) as StudentEmailRow[],
    today,
    todayStr,
    rowStripeColor: "#fef3c7",
    stagger,
  });

  // --- [INTERNO] Faltou ao atendimento 24h sem reagendar (digest diário por unidade) ---
  const { data: missedStudents } = await supabase
    .from("students")
    .select(STUDENT_EMAIL_SELECT)
    .eq("status", "faltou_ao_atendimento")
    .lt("updated_at", oneDayAgoIso);

  const staffMissedCount = await queueStaffDigestEmails(supabase, {
    triggerType: "staff_missed_appointment_no_reschedule",
    students: (missedStudents ?? []) as StudentEmailRow[],
    today,
    todayStr,
    rowStripeColor: "#fee2e2",
    stagger,
  });

  // --- [INTERNO] Proposta sem retorno 3 dias (staff_proposal_no_response) ---
  let staffProposalCount = 0;

  const { data: proposalAppointments } = await supabase
    .from("appointments")
    .select(`
      id,
      student_id,
      appointment_date,
      interviewer_id,
      students (
        ${STUDENT_EMAIL_SELECT}
      )
    `)
    .eq("appointment_date", threeDaysAgoStr)
    .eq("status", "realizado")
    .eq("attended", true);

  for (const appointment of proposalAppointments ?? []) {
    const student = appointment.students as Record<string, unknown> | null;
    if (!student) continue;
    if (String(student.status ?? "") !== "atendimento_recentemente") continue;

    const studentId = String(student.id);
    const interviewerId = appointment.interviewer_id
      ? String(appointment.interviewer_id)
      : null;
    if (!interviewerId) continue;

    const { data: interviewer } = await supabase
      .from("profiles")
      .select("id, name, email")
      .eq("id", interviewerId)
      .maybeSingle();

    if (!interviewer?.email) continue;

    const context = await buildStudentContext(supabase, studentId, student);
    context.appointment_date = formatDate(String(appointment.appointment_date));

    const template = await resolveTemplate(
      supabase,
      "staff_proposal_no_response",
      context.unit_id ?? null,
    );
    if (!template?.is_active) continue;

    const scheduledFor = buildScheduledTimestamp(
      today,
      template.send_at_hour,
      template.send_at_minute,
    );
    const result = await insertQueueItem(supabase, {
      studentId,
      appointmentId: String(appointment.id),
      unitId: context.unit_id ?? null,
      template,
      triggerType: "staff_proposal_no_response",
      toEmail: String(interviewer.email),
      toName: String(interviewer.name ?? ""),
      context,
      idempotencyKey: `staff_proposal_no_response:${studentId}:${interviewerId}:${todayStr}`,
      scheduledFor: stagger.next(scheduledFor),
    });
    if (!result.skipped) staffProposalCount += 1;
  }

  const summary = {
    appointmentCount,
    examCount,
    examSameDayCount,
    postAttendanceCount,
    postFollowupCount,
    post3DaysCount,
    inviteToScheduleCount,
    staffNewLeadCount,
    staffMissedCount,
    staffProposalCount,
  };
  logEmailEvent("info", "schedule_reminders_done", { runId, ...summary });
  return summary;
}

async function processQueue(
  supabase: ReturnType<typeof createClient>,
  runId: string,
  options: { source?: string; batchSize?: number } = {},
) {
  const throttle = getQueueThrottleConfig();
  const batchSize = options.batchSize ??
    (options.source === "webhook"
      ? throttle.webhookBatchSize
      : throttle.batchSize);

  logEmailEvent("info", "queue_process_started", {
    runId,
    source: options.source ?? null,
    batchSize,
    sendDelayMs: throttle.sendDelayMs,
    maxAttempts: throttle.maxAttempts,
  });

  const defaultWebhookToken = Deno.env.get("GOOGLE_APPS_SCRIPT_WEBHOOK_TOKEN") ?? "";
  const defaultWebhookUrl = Deno.env.get("GOOGLE_APPS_SCRIPT_WEBHOOK_URL") ?? "";

  if (!defaultWebhookToken && !defaultWebhookUrl) {
    logEmailEvent("warn", "apps_script_not_configured", {
      runId,
      hasToken: Boolean(defaultWebhookToken),
      hasUrl: Boolean(defaultWebhookUrl),
    });
  }

  const { data: pendingEmails, error } = await supabase
    .from("email_queue")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(batchSize);

  if (error) {
    logEmailEvent("error", "queue_fetch_failed", { runId, error: error.message });
    throw error;
  }

  logEmailEvent("info", "queue_pending_loaded", {
    runId,
    count: pendingEmails?.length ?? 0,
    batchSize,
  });

  let sent = 0;
  let failed = 0;
  let deferred = 0;

  for (let index = 0; index < (pendingEmails?.length ?? 0); index++) {
    const item = pendingEmails![index];

    if (index > 0) {
      logEmailEvent("info", "queue_send_throttle_wait", {
        runId,
        queueItemId: item.id,
        delayMs: throttle.sendDelayMs,
        position: index + 1,
        batchSize,
      });
      await sleep(throttle.sendDelayMs);
    }

    const integration = await resolveIntegration(
      supabase,
      item.unit_id as string | null,
    );

    if (!integration?.is_active) {
      logEmailEvent("warn", "queue_item_failed", {
        runId,
        queueItemId: item.id,
        reason: "integracao_inativa",
        unitId: item.unit_id,
        triggerType: item.trigger_type,
        toEmail: item.to_email,
      });
      await supabase
        .from("email_queue")
        .update({
          status: "failed",
          error_message: "Integração de e-mail inativa ou não configurada",
          attempts: (item.attempts ?? 0) + 1,
        })
        .eq("id", item.id);
      failed += 1;
      continue;
    }

    const webhookUrl = integration.webhook_url || defaultWebhookUrl;
    const webhookToken = defaultWebhookToken;

    if (!webhookUrl || !webhookToken) {
      logEmailEvent("warn", "queue_item_failed", {
        runId,
        queueItemId: item.id,
        reason: "webhook_nao_configurado",
        hasUrl: Boolean(webhookUrl),
        hasToken: Boolean(webhookToken),
        triggerType: item.trigger_type,
        toEmail: item.to_email,
      });
      await supabase
        .from("email_queue")
        .update({
          status: "failed",
          error_message:
            "Webhook do Google Apps Script não configurado (URL ou token ausente)",
          attempts: (item.attempts ?? 0) + 1,
        })
        .eq("id", item.id);
      failed += 1;
      continue;
    }

    const nextAttempts = (item.attempts ?? 0) + 1;

    await supabase
      .from("email_queue")
      .update({ status: "sending", attempts: nextAttempts })
      .eq("id", item.id);

    try {
      const record = await buildAppsScriptRecord(supabase, item);

      const { messageId } = await sendEmailViaAppsScriptWebhook({
        webhookUrl,
        token: webhookToken,
        runId,
        payload: {
          event: String(item.trigger_type),
          trigger_type: String(item.trigger_type),
          to_email: item.to_email,
          to_name: item.to_name ?? "",
          subject: item.subject,
          html_body: item.html_body,
          from_email: integration.sender_email,
          from_name: integration.sender_name,
          record,
        },
      });

      await supabase
        .from("email_queue")
        .update({
          status: "sent",
          provider_message_id: messageId,
          sent_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", item.id);

      sent += 1;
      logEmailEvent("info", "queue_item_sent", {
        runId,
        queueItemId: item.id,
        triggerType: item.trigger_type,
        toEmail: item.to_email,
        messageId,
        attempt: nextAttempts,
      });
    } catch (sendError) {
      const message = formatQueueErrorMessage(sendError);
      const fromAppsScript = isAppsScriptError(sendError);
      const httpStatus = sendError instanceof Error &&
          "httpStatus" in sendError
        ? Number((sendError as Error & { httpStatus?: number }).httpStatus)
        : undefined;
      const canRetry = isTransientSendError(sendError, httpStatus) &&
        nextAttempts < throttle.maxAttempts;

      if (canRetry) {
        const retryAt = computeRetryScheduledFor(nextAttempts);
        await supabase
          .from("email_queue")
          .update({
            status: "pending",
            scheduled_for: retryAt,
            error_message: `Tentativa ${nextAttempts}/${throttle.maxAttempts}: ${message}`,
          })
          .eq("id", item.id);

        deferred += 1;
        logEmailEvent("warn", "queue_item_deferred", {
          runId,
          queueItemId: item.id,
          reason: fromAppsScript ? "apps_script_transient_error" : "transient_send_error",
          failure_origin: fromAppsScript ? "apps_script" : "edge_function",
          triggerType: item.trigger_type,
          toEmail: item.to_email,
          attempt: nextAttempts,
          retryAt,
          error: message,
        });
        continue;
      }

      logEmailEvent("error", "queue_item_failed", {
        runId,
        queueItemId: item.id,
        reason: fromAppsScript ? "apps_script_error" : "send_error",
        failure_origin: fromAppsScript ? "apps_script" : "edge_function",
        triggerType: item.trigger_type,
        toEmail: item.to_email,
        attempt: nextAttempts,
        error: message,
        httpStatus: httpStatus ?? null,
      });

      await supabase
        .from("email_queue")
        .update({
          status: "failed",
          error_message: message,
        })
        .eq("id", item.id);

      failed += 1;
    }
  }

  const remaining = await countDuePendingEmails(supabase);
  const summary = { sent, failed, deferred, remaining, batchSize };
  logEmailEvent(failed > 0 || deferred > 0 ? "warn" : "info", "queue_process_done", {
    runId,
    ...summary,
  });
  return summary;
}

async function insertQueueItem(
  supabase: ReturnType<typeof createClient>,
  params: {
    studentId: string;
    appointmentId?: string;
    unitId: string | null;
    template: EmailTemplate;
    triggerType: EmailTriggerType;
    toEmail: string;
    toName?: string;
    context: TemplateContext;
    idempotencyKey: string;
    scheduledFor: string;
  },
) {
  const emailId = crypto.randomUUID();
  const subject = renderTemplate(params.template.subject, params.context);
  let htmlBody = renderTemplate(params.template.html_body, params.context);

  // Add tracking pixel
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const projectRef = supabaseUrl.split(".")[0].split("//")[1];
  const trackingUrl =
    `https://${projectRef}.supabase.co/functions/v1/email-automation?source=tracking&id=${emailId}`;
  const pixelHtml =
    `<img src="${trackingUrl}" width="1" height="1" style="display:none !important;" />`;

  if (htmlBody.includes("</body>")) {
    htmlBody = htmlBody.replace("</body>", `${pixelHtml}</body>`);
  } else {
    htmlBody += pixelHtml;
  }

  const { error } = await supabase.from("email_queue").insert({
    id: emailId,
    student_id: params.studentId,
    appointment_id: params.appointmentId ?? null,
    unit_id: params.unitId,
    template_id: params.template.id,
    trigger_type: params.triggerType,
    to_email: params.toEmail,
    to_name: params.toName ?? null,
    subject,
    html_body: htmlBody,
    scheduled_for: params.scheduledFor,
    idempotency_key: params.idempotencyKey,
  });

  if (error) {
    if (error.code === "23505") {
      logEmailEvent("info", "queue_item_duplicate", {
        idempotencyKey: params.idempotencyKey,
        triggerType: params.triggerType,
        studentId: params.studentId,
        toEmail: params.toEmail,
      });
      return { skipped: true, reason: "e-mail já enfileirado" };
    }
    logEmailEvent("error", "queue_insert_failed", {
      triggerType: params.triggerType,
      studentId: params.studentId,
      toEmail: params.toEmail,
      error: error.message,
      code: error.code,
    });
    throw error;
  }

  logEmailEvent("info", "queue_item_inserted", {
    emailId,
    triggerType: params.triggerType,
    studentId: params.studentId,
    toEmail: params.toEmail,
    scheduledFor: params.scheduledFor,
  });

  return { queued: true };
}

async function buildStudentContext(
  supabase: ReturnType<typeof createClient>,
  studentId: string,
  record: Record<string, unknown>,
): Promise<TemplateContext & { unit_id?: string | null }> {
  const context: TemplateContext & { unit_id?: string | null } = {
    student_name: String(record.student_name ?? ""),
    responsible_name: String(record.responsible_name ?? ""),
    email: String(record.email ?? ""),
    tracking_code: String(record.tracking_code ?? ""),
    status: String(record.status ?? ""),
    exam_date: formatDate(String(record.exam_date ?? "")),
    exam_time: "",
    unit_id: record.unit_id ? String(record.unit_id) : null,
  };

  context.exam_time = await resolveExamTime(supabase, record);

  if (context.unit_id) {
    const { data: unit } = await supabase
      .from("units")
      .select("name, address, city, phone")
      .eq("id", context.unit_id)
      .maybeSingle();

    if (unit) {
      context.unit_name = unit.name;
      context.unit_address = unit.address;
      context.unit_city = unit.city;
      context.unit_phone = unit.phone;
    }
  }

  if (record.class_id) {
    const { data: classData } = await supabase
      .from("classes")
      .select("name")
      .eq("id", String(record.class_id))
      .maybeSingle();

    if (classData) {
      context.class_name = classData.name;
    }
  }

  return context;
}

async function resolveTemplate(
  supabase: ReturnType<typeof createClient>,
  triggerType: EmailTriggerType,
  unitId: string | null,
): Promise<EmailTemplate | null> {
  const staffUnitRecipientTriggers: EmailTriggerType[] = [
    "staff_new_lead_no_appointment",
    "staff_missed_appointment_no_reschedule",
  ];

  if (unitId) {
    const { data: unitTemplate } = await supabase
      .from("email_templates")
      .select("*")
      .eq("trigger_type", triggerType)
      .eq("unit_id", unitId)
      .maybeSingle();

    if (unitTemplate?.is_active) {
      return unitTemplate as EmailTemplate;
    }
  }

  const { data: defaultTemplate } = await supabase
    .from("email_templates")
    .select("*")
    .eq("trigger_type", triggerType)
    .is("unit_id", null)
    .maybeSingle();

  if (!defaultTemplate?.is_active) {
    return null;
  }

  // Fallback de conteúdo global: destinatários internos ficam vazios por unidade
  // (notifica todos os ativos da unidade do inscrito, não os do template padrão).
  if (unitId && staffUnitRecipientTriggers.includes(triggerType)) {
    return {
      ...(defaultTemplate as EmailTemplate),
      recipient_user_ids: [],
    };
  }

  return defaultTemplate as EmailTemplate;
}

async function resolveStaffRecipients(
  supabase: ReturnType<typeof createClient>,
  template: EmailTemplate,
  unitId: string | null,
): Promise<{ id: string; name: string; email: string }[]> {
  const recipientIds = template.recipient_user_ids ?? [];

  if (recipientIds.length > 0) {
    let query = supabase
      .from("profiles")
      .select("id, name, email")
      .in("id", recipientIds)
      .eq("ativo", true);
    if (unitId) {
      query = query.eq("unit_id", unitId);
    }
    const { data } = await query;
    return (data ?? []) as { id: string; name: string; email: string }[];
  }

  // Fallback: todos os usuários ativos da mesma unidade
  let query = supabase
    .from("profiles")
    .select("id, name, email")
    .eq("ativo", true);
  if (unitId) {
    query = query.eq("unit_id", unitId);
  }
  const { data } = await query;
  return (data ?? []) as { id: string; name: string; email: string }[];
}

async function resolveIntegration(
  supabase: ReturnType<typeof createClient>,
  unitId: string | null,
): Promise<EmailIntegration | null> {
  if (unitId) {
    const { data: unitIntegration } = await supabase
      .from("email_integrations")
      .select("sender_email, sender_name, webhook_url, is_active")
      .eq("unit_id", unitId)
      .eq("is_active", true)
      .maybeSingle();

    if (unitIntegration) {
      return unitIntegration;
    }
  }

  const { data: defaultIntegration } = await supabase
    .from("email_integrations")
    .select("sender_email, sender_name, webhook_url, is_active")
    .is("unit_id", null)
    .eq("is_active", true)
    .maybeSingle();

  return defaultIntegration;
}

async function buildAppsScriptRecord(
  supabase: ReturnType<typeof createClient>,
  item: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const record: Record<string, unknown> = {
    queue_id: item.id,
    student_id: item.student_id,
    appointment_id: item.appointment_id,
    unit_id: item.unit_id,
    template_id: item.template_id,
    trigger_type: item.trigger_type,
    idempotency_key: item.idempotency_key,
    scheduled_for: item.scheduled_for,
    to_email: item.to_email,
    to_name: item.to_name,
  };

  if (item.student_id) {
    const { data: student } = await supabase
      .from("students")
      .select(
        `${STUDENT_EMAIL_SELECT}, phone, responsible_name, interview_date`,
      )
      .eq("id", String(item.student_id))
      .maybeSingle();

    if (student) {
      record.id = student.id;
      record.student_id = student.id;
      record.student_name = student.student_name;
      record.nome = student.student_name;
      record.student_email = student.email;
      record.email_lead = student.email;
      record.phone = student.phone;
      record.telefone = student.phone;
      record.responsible_name = student.responsible_name;
      record.tracking_code = student.tracking_code;
      record.status = student.status;
      record.exam_date = student.exam_date;
      record.exam_time = await resolveExamTime(
        supabase,
        student as Record<string, unknown>,
      );
      record.interview_date = student.interview_date;

      if (!item.unit_id && student.unit_id) {
        record.unit_id = student.unit_id;
      }
    }
  }

  if (item.appointment_id) {
    const { data: appointment } = await supabase
      .from("appointments")
      .select("id, appointment_date, appointment_time, status, formato_entrevista")
      .eq("id", String(item.appointment_id))
      .maybeSingle();

    if (appointment) {
      record.appointment_id = appointment.id;
      record.appointment_date = appointment.appointment_date;
      record.appointment_time = formatTime(appointment.appointment_time);
      record.data_visita = buildVisitDateTime(
        appointment.appointment_date,
        appointment.appointment_time,
      );
      record.data_agendamento = record.data_visita;
      record.appointment_status = appointment.status;
      record.formato_entrevista = appointment.formato_entrevista;
    }
  }

  const unitId = record.unit_id ? String(record.unit_id) : null;
  if (unitId) {
    const { data: unit } = await supabase
      .from("units")
      .select("id, name, phone, city, address")
      .eq("id", unitId)
      .maybeSingle();

    if (unit) {
      record.unit_name = unit.name;
      record.unidade = unit.name;
      record.unit_phone = unit.phone;
      record.unit_city = unit.city;
      record.unit_address = unit.address;
    }
  }

  if (!record.data_visita && record.interview_date) {
    record.data_visita = String(record.interview_date);
    record.data_agendamento = record.data_visita;
  }

  if (!record.data_visita && record.exam_date) {
    record.data_visita = buildVisitDateTime(
      String(record.exam_date),
      String(record.exam_time ?? "09:00"),
    );
    record.data_agendamento = record.data_visita;
  }

  // Garante dados mínimos mesmo se a consulta ao students falhar
  if (!record.student_name && item.to_name) {
    record.student_name = item.to_name;
    record.nome = item.to_name;
  }
  if (!record.id && item.student_id) {
    record.id = item.student_id;
  }

  // Destinatário real vem da fila (to_email). E-mails internos ao colaborador
  // não podem usar record.email do aluno — o Apps Script prioriza registro.email.
  const recipientEmail = String(item.to_email ?? "").trim();
  if (recipientEmail) {
    record.to_email = recipientEmail;
    record.email = recipientEmail;
    record.E_MAIL = recipientEmail;
  } else if (!record.email && record.student_email) {
    record.email = record.student_email;
    record.E_MAIL = record.student_email;
  }

  // Aliases alinhados à planilha institucional (NOME_LEAD, E-MAIL, etc.)
  record.NOME_LEAD = record.student_name ?? item.to_name ?? "";
  if (!record.E_MAIL) {
    record.E_MAIL = record.email ?? "";
  }
  record.UNIDADE = record.unit_name ?? record.unidade ?? "";
  record.DATA_VISITA = record.data_visita ?? "";
  record.STATUS_ENVIO = item.trigger_type ?? record.trigger_type ?? "";

  return record;
}

function buildVisitDateTime(dateValue: string, timeValue: string): string {
  if (!dateValue) return "";
  const time = formatTime(timeValue || "09:00");
  return `${dateValue}T${time}:00`;
}

function renderTemplate(template: string, context: TemplateContext): string {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_match, key: string) => {
    const value = context[key as keyof TemplateContext];
    return value ?? "";
  });
}

/**
 * Constrói o timestamp de envio interpretando `hour` e `minute` como
 * horário de Brasília (America/Sao_Paulo, UTC-3).
 * O servidor (Supabase Edge / Deno) roda em UTC, então somamos 3 horas
 * para obter o instante UTC equivalente ao horário local desejado.
 */
function buildScheduledTimestamp(
  baseDate: Date,
  hour: number,
  minute: number,
): string {
  const BRASILIA_OFFSET_HOURS = 3; // UTC-3
  // Cria a data no fuso UTC com a hora que representa o horário de Brasília
  const scheduled = new Date(Date.UTC(
    baseDate.getUTCFullYear(),
    baseDate.getUTCMonth(),
    baseDate.getUTCDate(),
    hour + BRASILIA_OFFSET_HOURS, // converte horário Brasília → UTC
    minute,
    0,
    0,
  ));
  return scheduled.toISOString();
}

/** Agenda envio conforme template (offset + hora/min). Se já passou hoje, usa o dia seguinte. */
function resolveScheduledForFromTemplate(
  template: EmailTemplate,
  referenceDate: Date = new Date(),
): string {
  const base = new Date(referenceDate);
  base.setUTCDate(base.getUTCDate() + (template.send_offset_days ?? 0));

  let scheduledFor = buildScheduledTimestamp(
    base,
    template.send_at_hour,
    template.send_at_minute,
  );

  if (new Date(scheduledFor).getTime() <= Date.now()) {
    base.setUTCDate(base.getUTCDate() + 1);
    scheduledFor = buildScheduledTimestamp(
      base,
      template.send_at_hour,
      template.send_at_minute,
    );
  }

  return scheduledFor;
}

function formatIsoDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatDate(value: string): string {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function formatTime(value: string): string {
  if (!value) return "";
  return value.slice(0, 5);
}

interface AppsScriptWebhookPayload {
  token: string;
  event: string;
  trigger_type: string;
  to_email: string;
  to_name: string;
  subject: string;
  html_body: string;
  from_email: string;
  from_name: string;
  record: Record<string, unknown>;
}

function buildAppsScriptWebhookUrl(baseUrl: string, token: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

async function sendEmailViaAppsScriptWebhook(params: {
  webhookUrl: string;
  token: string;
  payload: Omit<AppsScriptWebhookPayload, "token">;
  runId?: string;
}): Promise<{ messageId: string }> {
  const requestUrl = buildAppsScriptWebhookUrl(params.webhookUrl, params.token);
  const body: AppsScriptWebhookPayload = {
    token: params.token,
    ...params.payload,
  };

  logEmailEvent("info", "apps_script_request", {
    runId: params.runId ?? null,
    to_email: body.to_email,
    to_name: body.to_name,
    trigger_type: body.trigger_type,
    subject: body.subject?.slice(0, 80),
    record_email: body.record?.email,
    record_name: body.record?.student_name,
  });

  const response = await postToAppsScriptWebhook(requestUrl, body);

  let rawResponse: unknown = null;
  const responseText = await response.text();

  if (responseText) {
    try {
      rawResponse = JSON.parse(responseText);
    } catch {
      rawResponse = responseText;
    }
  }

  if (!response.ok) {
    const errorMessage = extractAppsScriptError(rawResponse) ||
      `Webhook Apps Script retornou HTTP ${response.status}`;
    logAppsScriptFailure("apps_script_http_error", {
      runId: params.runId ?? null,
      httpStatus: response.status,
      to_email: body.to_email,
      trigger_type: body.trigger_type,
      error: errorMessage,
      rawResponse,
    });
    throw new AppsScriptError(errorMessage, {
      httpStatus: response.status,
      rawResponse,
      transient: [408, 429, 500, 502, 503, 504].includes(response.status),
      code: "http_error",
    });
  }

  if (typeof rawResponse === "string" || !rawResponse) {
    const errorMessage =
      "Resposta inválida do Apps Script (provável redirect sem body JSON). Reimplante o Web App e confira a URL.";
    logAppsScriptFailure("apps_script_invalid_response", {
      runId: params.runId ?? null,
      to_email: body.to_email,
      trigger_type: body.trigger_type,
      error: errorMessage,
      rawResponse,
    });
    throw new AppsScriptError(errorMessage, {
      rawResponse,
      code: "invalid_response",
    });
  }

  const responseObj = rawResponse as Record<string, unknown>;

  if (responseObj.success === false) {
    const errorMessage = extractAppsScriptError(rawResponse) ||
      "Apps Script retornou success=false";
    logAppsScriptFailure("apps_script_rejected", {
      runId: params.runId ?? null,
      to_email: body.to_email,
      trigger_type: body.trigger_type,
      error: errorMessage,
      rawResponse,
    });
    throw new AppsScriptError(errorMessage, {
      rawResponse,
      code: "success_false",
    });
  }

  const expectsEmail = Boolean(body.subject && body.html_body);

  if (expectsEmail) {
    if (responseObj.email_sent === false) {
      const emailError = typeof responseObj.email_error === "string"
        ? responseObj.email_error
        : "Apps Script não enviou o e-mail (email_sent=false)";
      logAppsScriptFailure("apps_script_email_failed", {
        runId: params.runId ?? null,
        to_email: body.to_email,
        trigger_type: body.trigger_type,
        error: emailError,
        rawResponse,
      });
      throw new AppsScriptError(emailError, {
        rawResponse,
        code: "email_not_sent",
      });
    }

    if (responseObj.lead_email === "Não informado") {
      const errorMessage =
        "Apps Script recebeu payload sem e-mail — reimplante o Web App com o script atualizado";
      logAppsScriptFailure("apps_script_missing_email", {
        runId: params.runId ?? null,
        to_email: body.to_email,
        trigger_type: body.trigger_type,
        error: errorMessage,
        rawResponse,
      });
      throw new AppsScriptError(errorMessage, {
        rawResponse,
        code: "missing_email",
      });
    }
  }

  const messageId = extractAppsScriptMessageId(rawResponse) ||
    `apps-script-${crypto.randomUUID()}`;

  return { messageId };
}

/**
 * Envia POST ao Web App do Google Apps Script.
 * Fallback: application/x-www-form-urlencoded com campo "payload".
 */
async function postToAppsScriptWebhook(
  requestUrl: string,
  body: AppsScriptWebhookPayload,
): Promise<Response> {
  const jsonBody = JSON.stringify(body);

  let response = await fetchGoogleAppsScriptPost(requestUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: jsonBody,
  });

  if (response.ok) {
    return response;
  }

  const formBody = new URLSearchParams();
  formBody.set("payload", jsonBody);

  response = await fetchGoogleAppsScriptPost(requestUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody.toString(),
  });

  return response;
}

/**
 * Google Apps Script executa doPost no POST /exec e responde 302 para uma URL
 * googleusercontent.com que só aceita GET (retorna o JSON de saída).
 * Re-POST na URL de redirect causa HTTP 405 embora o e-mail já tenha sido enviado.
 */
async function fetchGoogleAppsScriptPost(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const response = await fetch(url, { ...init, redirect: "manual" });

  if (response.status < 300 || response.status >= 400) {
    return response;
  }

  const location = response.headers.get("Location");
  if (!location) {
    return response;
  }

  return fetch(location, { method: "GET", redirect: "follow" });
}

function extractAppsScriptError(rawResponse: unknown): string | null {
  if (!rawResponse || typeof rawResponse !== "object") return null;

  const response = rawResponse as Record<string, unknown>;
  if (typeof response.error === "string") return response.error;
  if (typeof response.email_error === "string" && response.email_error) {
    return response.email_error;
  }
  if (typeof response.message === "string" && response.success === false) {
    return response.message;
  }

  return null;
}

function extractAppsScriptMessageId(rawResponse: unknown): string | null {
  if (!rawResponse || typeof rawResponse !== "object") return null;

  const response = rawResponse as Record<string, unknown>;
  if (typeof response.message_id === "string") return response.message_id;
  if (typeof response.messageId === "string") return response.messageId;
  if (typeof response.id === "string") return response.id;

  return null;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleTracking(
  supabase: ReturnType<typeof createClient>,
  emailId: string,
  runId: string,
) {
  try {
    const { data: email, error: fetchError } = await supabase
      .from("email_queue")
      .select("student_id, trigger_type, subject, opened_at")
      .eq("id", emailId)
      .maybeSingle();

    if (fetchError || !email) {
      logEmailEvent("warn", "tracking_email_not_found", {
        runId,
        emailId,
        error: fetchError?.message ?? null,
      });
      return;
    }

    // 2. Atualizar opened_at e opened_count
    const { error: updateError } = await supabase.rpc("increment_email_open", {
      email_id: emailId,
    });

    if (updateError) {
      // Fallback se a RPC não existir
      await supabase
        .from("email_queue")
        .update({
          opened_at: email.opened_at || new Date().toISOString(),
          opened_count: 1, // Simples fallback
        })
        .eq("id", emailId);
    }

    // 3. Registrar interação se for a primeira abertura
    if (!email.opened_at && email.student_id) {
      const labels: Record<string, string> = {
        student_registered: 'Nova inscrição',
        appointment_scheduled: 'Agendamento confirmado',
        appointment_reminder_same_day: 'Lembrete no dia do atendimento',
        exam_reminder_1_day_before: 'Lembrete 1 dia antes da prova',
        attended_over_a_week_ago: 'Atendido há mais de uma semana',
        missed_appointment_reschedule: 'Faltou ao atendimento — reagendar',
        invite_to_schedule: 'Convite para agendamento',
        exam_reminder_same_day: 'Lembrete no dia da prova',
        post_attendance_followup: 'Follow-up pós atendimento',
        post_attendance_3_days: 'Comunicação pedagógica (3 dias após atendimento)',
        matricula_concluida: 'Matrícula concluída',
        staff_new_lead_no_appointment: '[INTERNO] Lead sem agendamento 24h',
        staff_missed_appointment_no_reschedule: '[INTERNO] Faltou ao atendimento 24h sem reagendar',
        staff_proposal_no_response: '[INTERNO] Proposta sem retorno 3 dias',
      };
      const triggerLabel = labels[email.trigger_type] || String(email.trigger_type).replace(/_/g, " ");
      await supabase.from("student_interactions").insert({
        student_id: email.student_id,
        interaction_type: "email_opened",
        comments: `E-mail aberto: "${email.subject}" (Evento: ${triggerLabel})`,
      });

      logEmailEvent("info", "tracking_first_open", {
        runId,
        emailId,
        studentId: email.student_id,
        triggerType: email.trigger_type,
      });
    }
  } catch (err) {
    logEmailEvent("error", "tracking_error", {
      runId,
      emailId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
