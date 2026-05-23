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

## 4. Payload enviado ao Apps Script

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

## 5. Fluxo técnico

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

## 6. Configurar no CRM

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
