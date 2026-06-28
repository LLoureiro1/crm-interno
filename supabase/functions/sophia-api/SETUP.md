# Edge Function: sophia-api

Sincroniza alunos do SophiA para `sophia_students`. **Uma página por invocação** (limite ~2s CPU).

## Modos

### `reconcile` (padrão — botão Importar)

Busca no SophiA apenas os códigos ERP dos matriculados no CRM:

```json
{
  "mode": "reconcile",
  "codes": ["123", "456"],
  "pendingCodes": ["123", "456"],
  "pagina": 0,
  "authMode": "token"
}
```

Resposta: `{ "done", "nextPagina", "found", "changed", "pendingCodes", "authMode" }`

O frontend chama em loop até `done: true` (geralmente 1–3 páginas).

### `full` (catálogo completo do período)

```json
{ "mode": "full", "pagina": 0, "reset": true }
```

## Token cache

Token SophiA fica em `sophia_sync_meta` (~25 min) — reauth só quando expira ou falha.

## Deploy

```bash
npx supabase db push
npx supabase secrets set SOPHIA_PERIODO_ID='11'
npx supabase functions deploy sophia-api
```
