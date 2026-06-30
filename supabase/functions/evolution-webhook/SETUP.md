# Evolution Webhook

Recebe `MESSAGES_UPSERT` da Evolution API e grava em `whatsapp_messages`.

## Deploy

```powershell
supabase db push
supabase functions deploy evolution-webhook --no-verify-jwt
```

**Opção A (recomendada):** `--no-verify-jwt` — Evolution chama sem JWT.

**Opção B:** manter JWT e configurar headers na Evolution (o CRM faz isso ao clicar em "Atualizar status" com a instância conectada):

```json
"headers": {
  "Authorization": "Bearer <SUPABASE_ANON_KEY>",
  "apikey": "<SUPABASE_ANON_KEY>"
}
```
## Secrets

Usa automaticamente `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` do projeto.

## Webhook URL

Após conectar no CRM, a URL configurada na Evolution será:

`https://<projeto>.supabase.co/functions/v1/evolution-webhook`

Para reconfigurar manualmente:

```powershell
curl -X POST "http://127.0.0.1:8081/webhook/set/aluno-first-crm" `
  -H "apikey: SUA-CHAVE" `
  -H "Content-Type: application/json" `
  -d '{"webhook":{"url":"https://jfpzbsfywfcuylqgafpp.supabase.co/functions/v1/evolution-webhook","webhook_by_events":false,"events":["MESSAGES_UPSERT"],"enabled":true}}'
```
