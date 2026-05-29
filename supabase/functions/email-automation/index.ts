/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-email-webhook-secret",
};

type AuthResult =
  | { ok: true; body: Record<string, unknown>; isServiceRole: boolean; userId?: string }
  | { ok: false; status: number; error: string };

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

function jsonError(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
      return { ok: true, body, isServiceRole: true };
    }

    const webhookSecret = getEmailWebhookSecret(req);
    const expected = Deno.env.get("EMAIL_AUTOMATION_WEBHOOK_SECRET") ?? "";

    if (webhookSecret && expected.length > 0) {
      if (!isValidEmailWebhookSecret(webhookSecret)) {
        return {
          ok: false,
          status: 403,
          error: "x-email-webhook-secret inválido",
        };
      }
      return { ok: true, body, isServiceRole: true };
    }

    // Trigger/cron via pg_net: secrets ficam só na Edge Function (não duplicar no SQL)
    // Exige "Verify JWT" desligado no painel desta função
    return { ok: true, body, isServiceRole: true };
  }

  const token = getBearerToken(req);
  if (!token) {
    return { ok: false, status: 401, error: "Authorization required" };
  }

  if (isServiceRoleToken(token)) {
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
    return { ok: false, status: 403, error: "Usuário inativo ou sem perfil" };
  }

  if (!staffProfiles.includes(profile.profile)) {
    return { ok: false, status: 403, error: "Permissão insuficiente" };
  }

  return { ok: true, body, isServiceRole: false, userId: user.id };
}

type EmailTriggerType =
  | "student_registered"
  | "appointment_scheduled"
  | "appointment_reminder_same_day"
  | "exam_reminder_1_day_before";

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

  // Handle tracking pixel (GET request)
  const url = new URL(req.url);
  const source = url.searchParams.get("source");

  if (req.method === "GET" && source === "tracking") {
    const emailId = url.searchParams.get("id");
    if (emailId) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      );
      await handleTracking(supabase, emailId);
    }

    // Return 1x1 transparent GIF
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

  try {
    const body = await parseJsonBody(req);
    const auth = await authorizeEdgeRequest(req, body, {
      staffProfiles: ["admin"],
      automatedSources: ["cron", "webhook", "process_queue"],
    });

    if (!auth.ok) {
      return jsonError(auth.error, auth.status);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const source = auth.body.source as string | undefined;

    if (source === "cron") {
      const reminders = await scheduleReminders(supabase);
      const processed = await processQueue(supabase);
      return jsonResponse({ success: true, reminders, processed });
    }

    if (source === "webhook") {
      const queued = await handleWebhook(supabase, auth.body);
      if (
        queued && typeof queued === "object" && "skipped" in queued &&
        queued.skipped
      ) {
        console.warn(
          "email-automation webhook skipped:",
          (queued as { reason?: string }).reason ?? queued,
        );
      }
      const processed = await processQueue(supabase);
      if (processed.failed > 0) {
        console.warn("email-automation fila com falhas:", processed);
      }
      return jsonResponse({ success: true, queued, processed });
    }

    if (source === "process_queue") {
      const processed = await processQueue(supabase);
      return jsonResponse({ success: true, processed });
    }

    return jsonResponse({ error: "source inválido" }, 400);
  } catch (error) {
    console.error("email-automation error:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Erro interno" },
      500,
    );
  }
});

async function handleWebhook(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
) {
  const triggerType = body.trigger_type as EmailTriggerType;
  const record = body.record as Record<string, unknown> | undefined;

  if (!record) {
    return { skipped: true, reason: "record ausente" };
  }

  if (triggerType === "student_registered") {
    return queueStudentEmail(supabase, triggerType, record);
  }

  if (triggerType === "appointment_scheduled") {
    return queueAppointmentEmail(supabase, record);
  }

  return { skipped: true, reason: "trigger não tratado" };
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
  "id, student_name, email, unit_id, status, tracking_code, exam_date, exam_date_id, class_id";

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

async function loadStudentForAppointment(
  supabase: ReturnType<typeof createClient>,
  appointmentId: string,
  studentIdFromRecord: string | null,
): Promise<
  | { student: StudentEmailRow; appointmentDate: string; appointmentTime: string }
  | { skipped: true; reason: string }
> {
  const { data: appointmentRow, error: aptError } = await supabase
    .from("appointments")
    .select(`
      appointment_date,
      appointment_time,
      student_id,
      students (
        ${STUDENT_EMAIL_SELECT}
      )
    `)
    .eq("id", appointmentId)
    .maybeSingle();

  if (aptError) {
    console.warn("queueAppointmentEmail:", aptError.message);
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
      console.warn("queueAppointmentEmail student:", studentError.message);
    }
    student = directStudent as StudentEmailRow | null;
  }

  if (!student) {
    return {
      skipped: true,
      reason: `aluno não encontrado para o agendamento (student_id=${studentId ?? "ausente"})`,
    };
  }

  const email = String(student.email ?? "").trim();
  if (!email) {
    return {
      skipped: true,
      reason:
        "aluno sem e-mail cadastrado — inclua o e-mail na ficha do aluno para receber confirmação",
    };
  }

  return {
    student: { ...student, email },
    appointmentDate: String(
      appointmentRow?.appointment_date ?? "",
    ),
    appointmentTime: String(
      appointmentRow?.appointment_time ?? "",
    ),
  };
}

async function queueAppointmentEmail(
  supabase: ReturnType<typeof createClient>,
  record: Record<string, unknown>,
) {
  const appointmentId = String(record.id ?? "");
  if (!appointmentId || appointmentId === "undefined") {
    return { skipped: true, reason: "id do agendamento ausente no webhook" };
  }

  const studentIdFromRecord = record.student_id != null &&
      String(record.student_id) !== "null"
    ? String(record.student_id)
    : null;

  const loaded = await loadStudentForAppointment(
    supabase,
    appointmentId,
    studentIdFromRecord,
  );

  if ("skipped" in loaded) {
    return loaded;
  }

  const { student, appointmentDate, appointmentTime } = loaded;
  const studentId = student.id;

  const context = await buildStudentContext(supabase, studentId, student);
  context.appointment_date = formatDate(
    appointmentDate || String(record.appointment_date ?? ""),
  );
  context.appointment_time = formatTime(
    appointmentTime || String(record.appointment_time ?? ""),
  );

  const template = await resolveTemplate(
    supabase,
    "appointment_scheduled",
    context.unit_id ?? null,
  );

  if (!template) {
    return {
      skipped: true,
      reason:
        "nenhum template ativo para appointment_scheduled (verifique Configurações → E-mails)",
    };
  }

  const idempotencyKey = `appointment_scheduled:${appointmentId}`;

  return insertQueueItem(supabase, {
    studentId,
    appointmentId,
    unitId: context.unit_id ?? null,
    template,
    triggerType: "appointment_scheduled",
    toEmail: student.email,
    toName: context.student_name,
    context,
    idempotencyKey,
    scheduledFor: new Date().toISOString(),
  });
}

async function scheduleReminders(supabase: ReturnType<typeof createClient>) {
  const today = new Date();
  const todayStr = formatIsoDate(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatIsoDate(tomorrow);

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
      scheduledFor,
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
      scheduledFor,
    });

    if (!result.skipped) examCount += 1;
  }

  return { appointmentCount, examCount };
}

async function processQueue(supabase: ReturnType<typeof createClient>) {
  const defaultWebhookToken = Deno.env.get("GOOGLE_APPS_SCRIPT_WEBHOOK_TOKEN") ?? "";
  const defaultWebhookUrl = Deno.env.get("GOOGLE_APPS_SCRIPT_WEBHOOK_URL") ?? "";

  if (!defaultWebhookToken && !defaultWebhookUrl) {
    console.warn("GOOGLE_APPS_SCRIPT_WEBHOOK_TOKEN/URL não configurados");
  }

  const { data: pendingEmails, error } = await supabase
    .from("email_queue")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(20);

  if (error) {
    throw error;
  }

  let sent = 0;
  let failed = 0;

  for (const item of pendingEmails ?? []) {
    const integration = await resolveIntegration(
      supabase,
      item.unit_id as string | null,
    );

    if (!integration?.is_active) {
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

    await supabase
      .from("email_queue")
      .update({ status: "sending", attempts: (item.attempts ?? 0) + 1 })
      .eq("id", item.id);

    try {
      const record = await buildAppsScriptRecord(supabase, item);

      const { messageId } = await sendEmailViaAppsScriptWebhook({
        webhookUrl,
        token: webhookToken,
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
    } catch (sendError) {
      const message = sendError instanceof Error
        ? sendError.message
        : "Erro desconhecido";

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

  return { sent, failed };
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
      return { skipped: true, reason: "e-mail já enfileirado" };
    }
    throw error;
  }

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

  if (defaultTemplate?.is_active) {
    return defaultTemplate as EmailTemplate;
  }

  return null;
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
      record.email = student.email;
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
  if (!record.email && item.to_email) {
    record.email = item.to_email;
  }
  if (!record.id && item.student_id) {
    record.id = item.student_id;
  }

  // Aliases alinhados à planilha institucional (NOME_LEAD, E-MAIL, etc.)
  record.NOME_LEAD = record.student_name ?? item.to_name ?? "";
  record.E_MAIL = record.email ?? item.to_email ?? "";
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
}): Promise<{ messageId: string }> {
  const requestUrl = buildAppsScriptWebhookUrl(params.webhookUrl, params.token);
  const body: AppsScriptWebhookPayload = {
    token: params.token,
    ...params.payload,
  };

  console.log("Apps Script webhook:", {
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
    throw new Error(errorMessage);
  }

  if (typeof rawResponse === "string" || !rawResponse) {
    throw new Error(
      "Resposta inválida do Apps Script (provável redirect sem body JSON). Reimplante o Web App e confira a URL.",
    );
  }

  const responseObj = rawResponse as Record<string, unknown>;
  const expectsEmail = Boolean(body.subject && body.html_body);

  if (expectsEmail) {
    if (responseObj.email_sent === false) {
      const emailError = typeof responseObj.email_error === "string"
        ? responseObj.email_error
        : "Apps Script não enviou o e-mail (email_sent=false)";
      throw new Error(emailError);
    }

    if (responseObj.lead_email === "Não informado") {
      throw new Error(
        "Apps Script recebeu payload sem e-mail — reimplante o Web App com o script atualizado",
      );
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
) {
  try {
    // 1. Buscar informações do e-mail
    const { data: email, error: fetchError } = await supabase
      .from("email_queue")
      .select("student_id, trigger_type, subject, opened_at")
      .eq("id", emailId)
      .maybeSingle();

    if (fetchError || !email) {
      console.warn("handleTracking: e-mail não encontrado", emailId);
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
      const triggerLabel = String(email.trigger_type).replace(/_/g, " ");
      await supabase.from("student_interactions").insert({
        student_id: email.student_id,
        interaction_type: "email_opened",
        comments: `E-mail aberto: "${email.subject}" (Evento: ${triggerLabel})`,
      });
    }
  } catch (err) {
    console.error("handleTracking error:", err);
  }
}
