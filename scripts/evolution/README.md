# Agente WhatsApp com Evolution API

Agente que recebe mensagens no WhatsApp e responde automaticamente usando IA (Gemini).

## Pré-requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado e rodando
- [Python 3.10+](https://www.python.org/downloads/) instalado
- Chave da API Gemini — crie gratuitamente em [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

## Configuração inicial

### 1. Configure as variáveis de ambiente

Edite o arquivo `.env` na raiz do projeto:

```
EVOLUTION_API_KEY=minha-chave-local-123
EVOLUTION_API_URL=http://localhost:8081
EVOLUTION_INSTANCE=aluno-first-crm
GEMINI_API_KEY=AIza...sua-chave-aqui
```

### 2. Suba os containers (Evolution API + PostgreSQL + Redis)

```powershell
docker compose up -d
```

Aguarde todos os containers ficarem verdes no Docker Desktop.

### 3. Crie a instância do WhatsApp

```powershell
$body = '{"instanceName": "teste", "integration": "WHATSAPP-BAILEYS", "qrcode": true}'
curl -X POST http://localhost:8080/instance/create `
  -H "apikey: minha-chave-local-123" `
  -H "Content-Type: application/json" `
  -d $body
```

### 4. Instale as dependências do agente

```powershell
cd agent
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

### 5. Inicie o agente

```powershell
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 6. Conecte o WhatsApp via QR Code

Abra no navegador:
```
http://localhost:8000/qrcode
```

Escaneie o QR Code com o WhatsApp do celular:
**WhatsApp > Dispositivos conectados > Conectar dispositivo**

A página atualiza automaticamente. Quando conectado, exibe "WhatsApp Conectado!".

### 7. Configure o webhook

```powershell
$body = '{"webhook": {"url": "http://host.docker.internal:8000/webhook", "webhook_by_events": false, "events": ["MESSAGES_UPSERT"], "enabled": true}}'
curl -X POST http://localhost:8080/webhook/set/teste `
  -H "apikey: minha-chave-local-123" `
  -H "Content-Type: application/json" `
  -d $body
```

Pronto! Qualquer mensagem enviada para o número conectado será respondida automaticamente pelo agente.

## Estrutura do projeto

```
workspace_evolution/
├── docker-compose.yml   # Evolution API + PostgreSQL + Redis
├── .env                 # Chaves e configurações (não compartilhe!)
└── agent/
    ├── main.py          # Agente Python (webhook + IA)
    └── requirements.txt
```

## Verificar status

| URL | Descrição |
|-----|-----------|
| http://localhost:8000/health | Status do agente |
| http://localhost:8000/qrcode | QR Code / status da conexão WhatsApp |
| http://localhost:8081 | Evolution API |

## Parar tudo

```powershell
docker compose down
```
