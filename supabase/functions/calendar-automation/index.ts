import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();

    // Aceitar apenas payloads relacionados a agendamentos marcados
    const record = payload.record;
    const oldRecord = payload.old_record;

    if (!record || record.status !== "scheduled") {
      return new Response(JSON.stringify({ message: "Ignorado: não é um agendamento com status scheduled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Evita reagendar se o status já era 'scheduled' (edição que não alterou o status principal)
    if (oldRecord && oldRecord.status === "scheduled" && 
        oldRecord.appointment_date === record.appointment_date &&
        oldRecord.appointment_time === record.appointment_time &&
        oldRecord.interviewer_id === record.interviewer_id) {
        return new Response(JSON.stringify({ message: "Ignorado: dados do agendamento não mudaram" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Buscar dados do aluno
    const { data: student, error: studentError } = await supabaseAdmin
      .from("students")
      .select("nome, email, unit_id")
      .eq("id", record.student_id)
      .single();

    if (studentError || !student) {
      throw new Error(`Erro ao buscar aluno: ${studentError?.message}`);
    }

    // Buscar dados do entrevistador
    let interviewerEmail = "";
    if (record.interviewer_id) {
      // Primeiro tenta pegar do perfil se tiver email salvo lá
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("id", record.interviewer_id)
        .maybeSingle();
      
      interviewerEmail = profile?.email || "";
      
      // Fallback para a tabela auth.users se necessário
      if (!interviewerEmail) {
         const { data: authData } = await supabaseAdmin.auth.admin.getUserById(record.interviewer_id);
         interviewerEmail = authData?.user?.email || "";
      }
    }

    // Buscar dados da unidade
    let unitName = "";
    if (student.unit_id) {
      const { data: unit } = await supabaseAdmin
        .from("units")
        .select("name")
        .eq("id", student.unit_id)
        .maybeSingle();
      unitName = unit?.name || "";
    }

    // Se não tiver entrevistador para convidar, aborta e informa
    if (!interviewerEmail) {
      return new Response(JSON.stringify({ message: "Ignorado: Agendamento sem e-mail de entrevistador definido." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const googleAppsScriptUrl = Deno.env.get("GOOGLE_CALENDAR_WEBHOOK_URL");
    const webhookToken = Deno.env.get("GOOGLE_CALENDAR_WEBHOOK_TOKEN");

    if (!googleAppsScriptUrl) {
      throw new Error("Variável GOOGLE_CALENDAR_WEBHOOK_URL não configurada.");
    }

    // Preparar payload para o Google Apps Script
    const googlePayload = {
      token: webhookToken || "",
      student_name: student.nome || "Aluno",
      student_email: student.email || "",
      interviewer_email: interviewerEmail,
      appointment_date: record.appointment_date,
      appointment_time: record.appointment_time, // Supomos "HH:MM" ou "HH:MM:SS"
      unit_name: unitName,
      modality: record.modality || "Não definida"
    };

    console.log("Enviando evento para o Calendário:", googlePayload.student_name, googlePayload.appointment_date);

    // Fazer a chamada HTTP (POST)
    const googleResponse = await fetch(googleAppsScriptUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(googlePayload),
    });

    const googleResult = await googleResponse.json();

    return new Response(JSON.stringify({ success: true, googleResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    console.error("Erro na Edge Function calendar-automation:", message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
