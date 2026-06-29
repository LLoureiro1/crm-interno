# Edge Function: sophia-api

Sincroniza alunos do SophiA para `sophia_students`. **Uma página por invocação** (limite ~2s CPU).

## Modo `incremental` (botão Importar novas matrículas)

Percorre **todo** o catálogo SophiA (paginado), compara com `sophia_students` e **insere só alunos novos** (mesmo `codigo_externo` é ignorado). Não usa dados do CRM.

```json
{ "mode": "incremental", "pagina": 0 }
```

Resposta: `{ "done", "nextPagina", "newCount", "knownCount", "pageRows" }`

O frontend chama em loop até `done: true`.

## Modo `full` (reset completo)

Apaga cache e reimporta tudo: `{ "mode": "full", "pagina": 0, "reset": true }`

## Deploy

```bash
npx supabase db push
npx supabase secrets set SOPHIA_PERIODO_ID='11'
npx supabase functions deploy sophia-api
```
