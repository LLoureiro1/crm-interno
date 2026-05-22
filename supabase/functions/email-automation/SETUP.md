# Integração de E-mails com Google Workspace

Esta função envia e-mails transacionais HTML via **Gmail API** usando uma **Service Account** com delegação em todo o domínio (Domain-Wide Delegation).

## Eventos suportados

| Gatilho | Quando dispara |
|---------|----------------|
| `student_registered` | Nova inscrição (`INSERT` em `students`) |
| `appointment_scheduled` | Novo agendamento (`INSERT` em `appointments`) |
| `appointment_reminder_same_day` | Cron diário — atendimentos do dia |
| `exam_reminder_1_day_before` | Cron diário — provas de amanhã |

## 1. Configurar Google Cloud + Workspace

### 1.1 Criar projeto no Google Cloud

1. Acesse [Google Cloud Console](https://console.cloud.google.com/).
2. Crie um projeto (ou use um existente).
3. Ative a **Gmail API**: APIs & Services → Library → Gmail API → Enable.

### 1.2 Criar Service Account

1. IAM & Admin → Service Accounts → Create Service Account.
2. Anote o e-mail gerado (`...@...gserviceaccount.com`).
3. Crie uma chave JSON e baixe o arquivo.

### 1.3 Delegação em todo o domínio (Domain-Wide Delegation)

1. Na Service Account, copie o **Client ID** (numérico).
2. No [Admin Console do Google Workspace](https://admin.google.com/):
   - Security → Access and data control → API controls
   - Domain-wide delegation → Add new
   - Client ID: cole o ID da service account
   - OAuth Scopes: `https://www.googleapis.com/auth/gmail.send`
3. Confirme.

> O remetente (`sender_email` na tabela `email_integrations`) deve ser um usuário real do Workspace (ex.: `noreply@escola.com.br`). A service account envia **em nome** desse usuário.

## 2. Secrets no Supabase

```bash
npx supabase secrets set GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...@....iam.gserviceaccount.com",...}'
```

> Cole o JSON completo da chave em uma única linha ou use o painel do Supabase (Edge Functions → Secrets).

## 3. Deploy da função

```bash
npx supabase functions deploy email-automation
```

No `config.toml`, `verify_jwt = false` — a função é chamada por triggers/cron com service role.

## 4. Aplicar migration e cron

```bash
npx supabase db push
```

Depois execute `setup-email-cron-job.sql` no SQL Editor para agendar lembretes diários às 7h.

## 5. Configurar remetente e templates

No painel do CRM: **Configurações → E-mails**

- **Integração:** defina `sender_email` e `sender_name` por unidade (ou padrão global).
- **Templates:** edite assunto e HTML. Use variáveis:
  - `{{student_name}}`, `{{responsible_name}}`, `{{email}}`
  - `{{tracking_code}}`, `{{status}}`, `{{class_name}}`
  - `{{unit_name}}`, `{{unit_address}}`, `{{unit_city}}`, `{{unit_phone}}`
  - `{{appointment_date}}`, `{{appointment_time}}`
  - `{{exam_date}}`, `{{exam_time}}`

## 6. Fluxo técnico

```
INSERT students/appointments
        ↓
Trigger PostgreSQL (pg_net)
        ↓
Edge Function email-automation (webhook)
        ↓
email_queue (pending)
        ↓
Gmail API → envio HTML
        ↓
email_queue (sent/failed)
```

Cron diário (`setup-email-cron-job.sql`):
- Enfileira lembretes de prova/atendimento
- Processa fila pendente

## 7. Monitoramento

Consulte a fila no admin ou via SQL:

```sql
SELECT trigger_type, to_email, status, scheduled_for, sent_at, error_message
FROM email_queue
ORDER BY created_at DESC
LIMIT 50;
```

## Resend vs Google Workspace

- **Resend** (`resend-sync`): continua sincronizando contatos para marketing.
- **Google Workspace** (`email-automation`): e-mails transacionais HTML com remetente `@seudominio.com`.

## Troubleshooting

| Erro | Solução |
|------|---------|
| `Integração de e-mail inativa` | Cadastre remetente em Configurações → E-mails |
| `invalid_grant` / `unauthorized_client` | Verifique Domain-Wide Delegation e scope `gmail.send` |
| `Mail service not enabled` | Usuário remetente deve existir no Workspace |
| E-mail duplicado | Idempotency key evita reenvio; registro ignorado silenciosamente |
