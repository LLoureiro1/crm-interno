export interface GoogleServiceAccount {
  client_email: string;
  private_key: string;
}

export async function getGmailAccessToken(
  serviceAccount: GoogleServiceAccount,
  impersonateEmail: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    sub: impersonateEmail,
    scope: "https://www.googleapis.com/auth/gmail.send",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const jwt = await signJwt(header, payload, serviceAccount.private_key);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha ao obter token Gmail: ${errorText}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error("Resposta OAuth sem access_token");
  }

  return data.access_token as string;
}

export async function sendGmailHtmlEmail(params: {
  accessToken: string;
  fromEmail: string;
  fromName: string;
  toEmail: string;
  subject: string;
  htmlBody: string;
}): Promise<string> {
  const rawMessage = buildRawMimeMessage(params);
  const encodedMessage = base64UrlEncode(rawMessage);

  const response = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: encodedMessage }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha ao enviar e-mail Gmail: ${errorText}`);
  }

  const data = await response.json();
  return data.id as string;
}

function buildRawMimeMessage(params: {
  fromEmail: string;
  fromName: string;
  toEmail: string;
  subject: string;
  htmlBody: string;
}): string {
  const encodedSubject = encodeMimeHeader(params.subject);
  const fromHeader = params.fromName
    ? `"${escapeQuotes(params.fromName)}" <${params.fromEmail}>`
    : params.fromEmail;

  return [
    `From: ${fromHeader}`,
    `To: ${params.toEmail}`,
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    btoa(unescape(encodeURIComponent(params.htmlBody))),
  ].join("\r\n");
}

function encodeMimeHeader(value: string): string {
  if (/^[\x00-\x7F]*$/.test(value)) {
    return value;
  }

  const encoded = btoa(unescape(encodeURIComponent(value)));
  return `=?UTF-8?B?${encoded}?=`;
}

function escapeQuotes(value: string): string {
  return value.replace(/"/g, '\\"');
}

function base64UrlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function signJwt(
  header: Record<string, string>,
  payload: Record<string, unknown>,
  privateKeyPem: string,
): Promise<string> {
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const pemContents = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");

  const binaryDer = Uint8Array.from(atob(pemContents), (char) => char.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken),
  );

  const encodedSignature = base64UrlEncode(
    String.fromCharCode(...new Uint8Array(signature)),
  );

  return `${unsignedToken}.${encodedSignature}`;
}
