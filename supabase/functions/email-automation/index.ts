/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getGmailAccessToken,
  sendGmailHtmlEmail,
  type GoogleServiceAccount,
} from "../_shared/gmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
  is_active: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = await req.json();
    const source = body.source as string | undefined;

    if (source === "cron") {
      const reminders = await scheduleReminders(supabase);
      const processed = await processQueue(supabase);
      return jsonResponse({ success: true, reminders, processed });
    }

    if (source === "webhook") {
      const queued = await handleWebhook(supabase, body);
      const processed = await processQueue(supabase);
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
  const email = String(record.email ?? "");
  if (!email) {
    return { skipped: true, reason: "aluno sem e-mail" };
  }

  const context = await buildStudentContext(supabase, studentId, record);
  const template = await resolveTemplate(
    supabase,
    triggerType,
    context.unit_id ?? null,
  );

  if (!template?.is_active) {
    return { skipped: true, reason: "template inativo ou ausente" };
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

async function queueAppointmentEmail(
  supabase: ReturnType<typeof createClient>,
  record: Record<string, unknown>,
) {
  const appointmentId = String(record.id);
  const studentId = String(record.student_id);

  const { data: student, error } = await supabase
    .from("students")
    .select("id, student_name, email, unit_id, status, tracking_code, exam_date, exam_time, class_id")
    .eq("id", studentId)
    .single();

  if (error || !student?.email) {
    return { skipped: true, reason: "aluno não encontrado ou sem e-mail" };
  }

  const context = await buildStudentContext(supabase, studentId, student);
  context.appointment_date = formatDate(String(record.appointment_date ?? ""));
  context.appointment_time = formatTime(String(record.appointment_time ?? ""));

  const template = await resolveTemplate(
    supabase,
    "appointment_scheduled",
    context.unit_id ?? null,
  );

  if (!template?.is_active) {
    return { skipped: true, reason: "template inativo ou ausente" };
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
        id,
        student_name,
        email,
        unit_id,
        status,
        tracking_code,
        exam_date,
        exam_time,
        class_id
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
    .select("id, student_name, email, unit_id, status, tracking_code, exam_date, exam_time, class_id")
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
  const serviceAccount = getServiceAccount();
  if (!serviceAccount) {
    console.warn("GOOGLE_SERVICE_ACCOUNT_JSON não configurado");
    return { sent: 0, failed: 0, skipped: true };
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

    await supabase
      .from("email_queue")
      .update({ status: "sending", attempts: (item.attempts ?? 0) + 1 })
      .eq("id", item.id);

    try {
      const accessToken = await getGmailAccessToken(
        serviceAccount,
        integration.sender_email,
      );

      const messageId = await sendGmailHtmlEmail({
        accessToken,
        fromEmail: integration.sender_email,
        fromName: integration.sender_name,
        toEmail: item.to_email,
        subject: item.subject,
        htmlBody: item.html_body,
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
  const subject = renderTemplate(params.template.subject, params.context);
  const htmlBody = renderTemplate(params.template.html_body, params.context);

  const { error } = await supabase.from("email_queue").insert({
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
    exam_time: formatTime(String(record.exam_time ?? "")),
    unit_id: record.unit_id ? String(record.unit_id) : null,
  };

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

    if (unitTemplate) {
      return unitTemplate as EmailTemplate;
    }
  }

  const { data: defaultTemplate } = await supabase
    .from("email_templates")
    .select("*")
    .eq("trigger_type", triggerType)
    .is("unit_id", null)
    .maybeSingle();

  return (defaultTemplate as EmailTemplate | null) ?? null;
}

async function resolveIntegration(
  supabase: ReturnType<typeof createClient>,
  unitId: string | null,
): Promise<EmailIntegration | null> {
  if (unitId) {
    const { data: unitIntegration } = await supabase
      .from("email_integrations")
      .select("sender_email, sender_name, is_active")
      .eq("unit_id", unitId)
      .eq("is_active", true)
      .maybeSingle();

    if (unitIntegration) {
      return unitIntegration;
    }
  }

  const { data: defaultIntegration } = await supabase
    .from("email_integrations")
    .select("sender_email, sender_name, is_active")
    .is("unit_id", null)
    .eq("is_active", true)
    .maybeSingle();

  return defaultIntegration;
}

function renderTemplate(template: string, context: TemplateContext): string {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_match, key: string) => {
    const value = context[key as keyof TemplateContext];
    return value ?? "";
  });
}

function getServiceAccount(): GoogleServiceAccount | null {
  const raw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed.client_email || !parsed.private_key) {
      return null;
    }
    return parsed as GoogleServiceAccount;
  } catch {
    return null;
  }
}

function buildScheduledTimestamp(
  baseDate: Date,
  hour: number,
  minute: number,
): string {
  const scheduled = new Date(baseDate);
  scheduled.setHours(hour, minute, 0, 0);
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

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
