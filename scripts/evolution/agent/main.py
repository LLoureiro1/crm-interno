import os

import google.generativeai as genai
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

app = FastAPI()

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel(
    model_name="gemini-2.5-flash-lite",
    system_instruction=(
        "Você é um assistente prestativo respondendo mensagens no WhatsApp. "
        "Seja conciso, amigável e responda sempre em português."
    ),
)

EVOLUTION_URL = os.getenv("EVOLUTION_API_URL", "http://localhost:8080")
EVOLUTION_KEY = os.getenv("EVOLUTION_API_KEY")
INSTANCE = os.getenv("EVOLUTION_INSTANCE", "teste")


def send_whatsapp(to: str, text: str):
    url = f"{EVOLUTION_URL}/message/sendText/{INSTANCE}"
    with httpx.Client(timeout=10) as http:
        http.post(
            url, json={"number": to, "text": text}, headers={"apikey": EVOLUTION_KEY}
        )


def ask_ai(text: str) -> str:
    response = model.generate_content(text)
    return response.text


@app.post("/webhook")
async def webhook(request: Request):
    body = await request.json()

    if body.get("event") != "messages.upsert":
        return {"status": "ignored"}

    data = body.get("data", {})
    key = data.get("key", {})

    # Ignora mensagens enviadas pelo próprio bot
    if key.get("fromMe"):
        return {"status": "ignored"}

    message = data.get("message", {})
    text = message.get("conversation") or message.get("extendedTextMessage", {}).get(
        "text"
    )

    if not text:
        return {"status": "no_text"}

    sender = key.get("remoteJid", "")
    name = data.get("pushName", "desconhecido")

    print(f"[{name}] {text}")

    reply = ask_ai(text)
    send_whatsapp(sender, reply)

    print(f"[bot -> {name}] {reply[:80]}...")

    return {"status": "ok"}


@app.get("/qrcode", response_class=HTMLResponse)
def qrcode():
    url = f"{EVOLUTION_URL}/instance/connect/{INSTANCE}"
    with httpx.Client(timeout=10) as http:
        resp = http.get(url, headers={"apikey": EVOLUTION_KEY})
    data = resp.json()
    base64_img = data.get("base64", "")
    state = data.get("state", "")

    if state == "open" or not base64_img:
        return """
        <html><head><title>WhatsApp Status</title>
        <style>body{font-family:sans-serif;text-align:center;padding:40px;background:#f0f0f0;}
        .badge{display:inline-block;background:#25D366;color:white;padding:15px 30px;
        border-radius:12px;font-size:20px;margin-top:20px;}</style></head>
        <body><h2>Status da Conexão</h2>
        <div class="badge">✓ WhatsApp Conectado!</div>
        <p style="margin-top:20px;color:#666;">O agente está ativo e respondendo mensagens.</p>
        </body></html>
        """

    return f"""
    <html>
    <head>
        <title>QR Code WhatsApp</title>
        <style>
            body {{ font-family: sans-serif; text-align: center; padding: 40px; background: #f0f0f0; }}
            img {{ border: 4px solid #25D366; border-radius: 12px; padding: 10px; background: white; }}
            button {{ margin-top: 20px; padding: 10px 30px; font-size: 16px; background: #25D366;
                      color: white; border: none; border-radius: 8px; cursor: pointer; }}
            #timer {{ font-size: 14px; color: #888; margin-top: 10px; }}
        </style>
    </head>
    <body>
        <h2>Escaneie com o WhatsApp</h2>
        <p>WhatsApp > Dispositivos conectados > Conectar dispositivo</p>
        <img src="{base64_img}" style="width:280px;" /><br>
        <div id="timer">Novo QR Code em <span id="count">55</span>s</div>
        <button onclick="location.reload()">Gerar novo QR Code</button>
        <script>
            let t = 55;
            const c = document.getElementById('count');
            const iv = setInterval(() => {{
                t--;
                c.textContent = t;
                if (t <= 0) {{ clearInterval(iv); location.reload(); }}
            }}, 1000);
        </script>
    </body>
    </html>
    """


@app.get("/health")
def health():
    return {"status": "ok", "instance": INSTANCE}
