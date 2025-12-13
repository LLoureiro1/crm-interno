import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================
// CONFIGURAÇÃO DOS FILTROS
// ============================
const STATUS_PERMITIDOS = ["nenhum_agendamento", "faltou_atendimento"];
const UNITS_SLUGS = ["central"];

export default async function handler(req, res) {
  try {
    await sendEmails();
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Erro geral:", err);
    return res.status(500).json({ error: err.message });
  }
}

async function sendEmails() {
  // 1️⃣ Buscar unidades pelos slugs
  const { data: units, error: unitsError } = await supabase
    .from("units")
    .select("id, slug")
    .in("slug", UNITS_SLUGS);

  if (unitsError) {
    console.error("Erro ao buscar unidades:", unitsError);
    return;
  }

  if (!units || units.length === 0) {
    console.log("Nenhuma unidade encontrada para os slugs informados.");
    return;
  }

  const unitIds = units.map(u => u.id);

  // 2️⃣ Buscar students filtrando por status + unidade
  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id, name, email, status, unit_id")
    .in("status", STATUS_PERMITIDOS)
    .in("unit_id", unitIds);

  if (studentsError) {
    console.error("Erro ao buscar students:", studentsError);
    return;
  }

  if (!students || students.length === 0) {
    console.log("Nenhum estudante encontrado com os filtros definidos.");
    return;
  }

  console.log(`Total de estudantes encontrados: ${students.length}`);

  // 3️⃣ Enviar emails
  for (const student of students) {
    if (!student.email) {
      console.log(`Student ${student.id} sem email, ignorado.`);
      continue;
    }

    const mensagem = `
Olá ${student.name},

Estamos entrando em contato porque seu status atual no sistema é:
${student.status}

Se tiver qualquer dúvida, é só responder esse email.
`;

    try {
      await resend.emails.send({
        from: "Notificações <noreply@seudominio.com>",
        to: student.email,
        subject: "Aviso importante sobre seu cadastro",
        text: mensagem
      });

      console.log(`Email enviado para ${student.email}`);
    } catch (err) {
      console.error(`Erro ao enviar para ${student.email}:`, err);
    }
  }
}
