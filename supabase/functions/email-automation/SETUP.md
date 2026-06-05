# Integração de E-mails com Google Workspace (Apps Script)

Esta função integra o CRM (Supabase) com o **Google Apps Script Web App** preparado no Workspace institucional.

O CRM continua responsável por:
- Detectar eventos (inscrição, agendamento, lembretes)
- Renderizar templates HTML
- Enfileirar envios em `email_queue`

O **Google Workspace** continua responsável por:
- Receber o webhook (POST)
- Registrar na planilha de controle
- Disparar o e-mail via `GmailApp`

## Eventos suportados

| Gatilho | Quando dispara |
|---------|----------------|
| `student_registered` | Nova inscrição (`INSERT` em `students`) |
| `appointment_scheduled` | Novo agendamento (`INSERT` em `appointments`) |
| `appointment_reminder_same_day` | Cron diário — atendimentos do dia |
| `exam_reminder_1_day_before` | Cron diário — provas de amanhã |

## 1. Google Workspace (lado do desenvolvedor)

1. Planilha Google criada como fila/log de envios
2. Apps Script com `doPost(e)` — veja `apps-script-webhook.example.gs`
3. Implantar como **Web App**:
   - Executar como: conta institucional do Workspace
   - Quem tem acesso: qualquer pessoa
4. Token de segurança via `?token=SENHA` na URL **e** no body JSON

## 2. Secrets no Supabase

```bash
npx supabase secrets set GOOGLE_APPS_SCRIPT_WEBHOOK_URL='https://script.google.com/macros/s/AKfycb.../exec'
npx supabase secrets set GOOGLE_APPS_SCRIPT_WEBHOOK_TOKEN='SENHA_DEFINIDA'
```

Opcional: URL por unidade em **Configurações → E-mails → URL do Web App**.

### 2.1 Trigger do banco → Edge Function

O Postgres **não lê** os secrets da Edge Function. Por isso:

- **Secrets** (`EMAIL_AUTOMATION_WEBHOOK_SECRET`, Google Apps Script, etc.) ficam **só** na Edge Function (CLI ou painel).
- O **SQL** (`setup-email-webhook-auth.sql`) só recria o trigger — **não** pede para colar token.

**Checklist:**

1. Secrets já configurados na função (painel → Edge Functions → Secrets).
2. **Desative "Verify JWT"** em `email-automation` (obrigatório para o `pg_net`).
3. `npx supabase functions deploy email-automation`
4. Execute `setup-email-webhook-auth.sql` no SQL Editor (sem INSERT de token).

`EMAIL_AUTOMATION_WEBHOOK_SECRET` é opcional: serve para testes manuais com header `x-email-webhook-secret`. O trigger do banco não precisa dele no SQL.

## 3. Deploy

**Opção A — CLI (recomendado):**

```bash
npx supabase db push
npx supabase functions deploy email-automation
```

**Opção B — Painel Supabase:**

Cole o conteúdo de `index.ts` em um único arquivo na função `email-automation`.

> O painel só aceita arquivos criados manualmente na UI. Todo o código está em um único `index.ts` — não é necessário arquivo auxiliar.

Execute `setup-email-cron-job.sql` no SQL Editor para lembretes diários.

A migration `20260604120000_email_queue_process_cron.sql` agenda também o job **`email-automation-process-queue`** a cada **5 minutos**, que drena a fila em lotes pequenos (`source: process_queue`).

## 4. Controle de ritmo (throttling)

Para evitar sobrecarga no Google Apps Script, a Edge Function limita envios por execução e espaça as chamadas. Configure via **secrets** da função (valores padrão entre parênteses):

| Secret | Padrão | Descrição |
|--------|--------|-----------|
| `EMAIL_QUEUE_BATCH_SIZE` | 5 | Máximo de e-mails por execução (cron / process_queue) |
| `EMAIL_QUEUE_WEBHOOK_BATCH_SIZE` | 2 | Máximo após evento imediato (webhook de agendamento/inscrição) |
| `EMAIL_QUEUE_SEND_DELAY_MS` | 3000 | Pausa entre cada POST ao Apps Script (ms) |
| `EMAIL_QUEUE_STAGGER_MS` | 2500 | Espaçamento ao enfileirar muitos e-mails de uma vez (cron) |
| `EMAIL_QUEUE_MAX_ATTEMPTS` | 5 | Tentativas antes de marcar como falhou |
| `EMAIL_QUEUE_RETRY_BASE_DELAY_MS` | 60000 | Backoff base para reenvio após erro temporário |

**Estratégias aplicadas:**

1. **Lotes pequenos** — no máximo 5 envios por ciclo (2 após webhook).
2. **Intervalo entre envios** — 3 s entre cada chamada ao script.
3. **Escalonamento na fila** — lembretes do cron entram com `scheduled_for` escalonado (ex.: 08:00, 08:02:30, 08:05…).
4. **Cron a cada 5 min** — drena o backlog sem picos.
5. **Retry com backoff** — erros temporários (timeout, 429, quota) reagendam em vez de falhar na hora.

Logs relevantes: `queue_send_throttle_wait`, `queue_item_deferred`, `queue_backlog_remaining`.

## 5. Payload enviado ao Apps Script

```json
{
  "token": "SENHA_DEFINIDA",
  "event": "student_registered",
  "trigger_type": "student_registered",
  "to_email": "lead@email.com",
  "to_name": "Maria Silva",
  "subject": "Inscrição confirmada - Unidade Centro",
  "html_body": "<div>...</div>",
  "from_email": "noreply@escola.com.br",
  "from_name": "Escola Exemplo",
  "record": {
    "id": "uuid-students",
    "student_id": "uuid-students",
    "student_name": "Maria Silva",
    "nome": "Maria Silva",
    "email": "maria@email.com",
    "phone": "(11) 99999-9999",
    "appointment_date": "2026-05-22",
    "appointment_time": "14:30",
    "data_visita": "2026-05-22T14:30:00",
    "data_agendamento": "2026-05-22T14:30:00",
    "unit_name": "Unidade Centro",
    "unidade": "Unidade Centro",
    "trigger_type": "appointment_scheduled",
    "tracking_code": "ABC12345",
    "status": "atendimento_agendado",
    "queue_id": "uuid-fila",
    "idempotency_key": "appointment_scheduled:..."
  }
}
```

## Mapeamento CRM → Planilha Google (aba "Dados")

| Coluna planilha | Campo Supabase |
|-----------------|----------------|
| ID Aluno | `students.id` |
| Nome | `students.student_name` |
| E-mail | `students.email` |
| Telefone | `students.phone` |
| Data Atendimento | `appointments.appointment_date` + `appointment_time` |
| Unidade | `units.name` |
| Evento | `trigger_type` (ex.: `appointment_scheduled`) |
| Status 7d / 2d / Dia / 30m | Régua no Apps Script (`enviarLembretesAutomaticos`) |
| Envio Imediato | E-mail HTML do CRM na hora do evento |

### Tabelas e eventos

| Evento (`trigger_type`) | Tabela origem | Campos principais |
|-------------------------|---------------|-------------------|
| `student_registered` | `students` | student_name, email, phone, tracking_code, unit_id |
| `appointment_scheduled` | `appointments` + `students` | appointment_date, appointment_time, student_name, email |
| `appointment_reminder_same_day` | cron + `appointments` | data do atendimento no dia |
| `exam_reminder_1_day_before` | cron + `students.exam_date` | data/hora da prova |

Copie o script de `apps-script-webhook.example.gs` para o Google Apps Script do Workspace.
Configure `TOKEN_SEGURANCA` igual ao secret `GOOGLE_APPS_SCRIPT_WEBHOOK_TOKEN`.

Resposta esperada do Apps Script:

```json
{
  "success": true,
  "message_id": "uuid-ou-id-do-envio"
}
```

## 6. Fluxo técnico

```
INSERT students/appointments
        ↓
Trigger PostgreSQL (pg_net)
        ↓
Edge Function email-automation
        ↓
email_queue (pending) + render template
        ↓
POST → Google Apps Script Web App
        ↓
Planilha + GmailApp.sendEmail()
        ↓
email_queue (sent/failed)
```

## 7. Configurar no CRM

**Configurações → E-mails**

- **URL do Web App:** endpoint do Apps Script (ou use secret global)
- **Remetente:** e-mail/nome repassados ao Google para o envio
- **Templates:** HTML editável com variáveis `{{student_name}}`, etc.

## Troubleshooting

| Erro | Solução |
|------|---------|
| `Webhook do Google Apps Script não configurado` | Configure URL (CRM ou secret) e token no Supabase |
| `Unauthorized` no Apps Script | Token divergente entre Supabase e script |
| E-mail não chega | Verifique "Executar como" no deploy do Web App |
| Duplicata | `idempotency_key` evita reenvio na fila do CRM |

## Resend vs Workspace

- **Resend** (`resend-sync`): marketing/lista de contatos
- **Apps Script** (`email-automation`): transacional via Workspace institucional
