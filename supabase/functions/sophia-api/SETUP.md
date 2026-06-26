# Edge Function: sophia-api

Sincroniza alunos do SophiA para a tabela `sophia_students` (uma página por invocação, dentro do limite de CPU).

A conferência em Configurações lê o cache local no Postgres — não varre a API SophiA em tempo real.

## Tabelas

- `sophia_students` — `codigo_externo`, `nome`, `periodo_id`, `synced_at`
- `sophia_sync_meta` — status e data da última sincronização por período

## Secrets

```bash
npx supabase secrets set SOPHIA_API_BASE_URL='https://portal.sophia.com.br/SophiAWebAPI/9827/api/v1'
npx supabase secrets set SOPHIA_API_USUARIO='...'
npx supabase secrets set SOPHIA_API_SENHA='...'
npx supabase secrets set SOPHIA_PERIODO_ID='11'
```

## Deploy

```bash
npx supabase db push
npx supabase functions deploy sophia-api
```

## API (POST)

```json
{ "pagina": 0, "reset": true }
```

Resposta: `{ "pagina", "nextPagina", "done", "upserted", "periodoId" }`

O frontend chama em loop até `done: true`.
