import { Resend } from "resend";
// Utilitário de resposta JSON sem dependência de Next.js
function json(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  if (!headers.has('content-type')) headers.set('content-type', 'application/json');
  return new Response(JSON.stringify(body), { ...init, headers });
}

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const student = payload.record;

    if (!student.email) {
      return json({ ok: false, message: "Sem email" });
    }

    const audienceId = process.env.RESEND_AUDIENCE_ID!;

    await resend.contacts.create({
      audienceId,
      email: student.email,
      firstName: student.name || "",
      lastName: student.last_name || "",
      unsubscribed: false,
    });

    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: String(error) }, { status: 500 });
  }
}
