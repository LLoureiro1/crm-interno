import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

// Criando helper para respostas JSON
function json(body: any, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  if (!headers.has("content-type")) headers.set("content-type", "application/json");
  return new Response(JSON.stringify(body), { ...init, headers });
}

export async function POST(req: Request) {
  try {
    // 1. Verificação da autenticação do Supabase
    const auth = req.headers.get("authorization");
    const expected = `Bearer ${process.env.SUPABASE_WEBHOOK_SECRET}`;

    if (auth !== expected) {
      return json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // 2. Lendo payload do Supabase
    const payload = await req.json();
    const recordNew = payload?.record;
    const recordOld = payload?.old_record;
    const eventType = payload?.type; // "INSERT" ou "UPDATE"

    // 3. Segurança básica
    if (!recordNew) {
      return json({ ok: false, message: "Sem dados recebidos" });
    }

    const email = recordNew.email;
    if (!email) {
      return json({ ok: false, message: "Aluno sem email" });
    }

    const audienceId = process.env.RESEND_AUDIENCE_ID!;
    
    // ================================
    // 4. LÓGICA DE DISPARO
    // ================================

    // → Caso seja INSERT
    if (eventType === "INSERT") {
      await resend.contacts.create({
        audienceId,
        email,
        firstName: recordNew.name || "",
        lastName: recordNew.last_name || "",
        unsubscribed: false,
      });

      return json({ ok: true, triggered: "INSERT → contato criado no Resend" });
    }

    // → Caso seja UPDATE
    if (eventType === "UPDATE") {
      // só dispara se o STATUS mudar
      const oldStatus = recordOld?.status;
      const newStatus = recordNew?.status;

      if (oldStatus === newStatus) {
        return json({
          ok: true,
          triggered: "UPDATE → mas status não mudou",
        });
      }

      // status mudou → atualiza contato no Resend
      await resend.contacts.create({
        audienceId,
        email,
        firstName: recordNew.name || "",
        lastName: recordNew.last_name || "",
        unsubscribed: false,
      });

      return json({
        ok: true,
        triggered: `UPDATE → status mudou (${oldStatus} → ${newStatus})`,
      });
    }

    // → Se vier outro tipo (DELETE, etc.)
    return json({ ok: true, message: "Evento ignorado" });

  } catch (err: any) {
    return json({ ok: false, error: String(err) }, { status: 500 });
  }
}
