# Configuração da Integração Supabase + Resend

Esta função sincroniza alunos da tabela `students` com a lista de contatos do Resend.

## 1. Variáveis de Ambiente

Você precisa configurar as chaves de API do Resend no Supabase:

```bash
npx supabase secrets set RESEND_API_KEY=re_123456789
npx supabase secrets set RESEND_AUDIENCE_ID=c9384...
```

*   `RESEND_API_KEY`: Sua chave de API do Resend.
*   `RESEND_AUDIENCE_ID`: O ID da "Audience" (Lista de Contatos) no Resend onde os alunos serão adicionados.

## 2. Deploy da Função

Faça o deploy da função para o Supabase:

```bash
npx supabase functions deploy resend-sync
```

## 3. Criar o Webhook (Gatilho)

A maneira mais fácil é através do Dashboard do Supabase:

1.  Vá para **Database** -> **Webhooks**.
2.  Clique em **Create Webhook**.
3.  **Name**: `sync-resend` (ou outro nome de sua preferência).
4.  **Table**: `public.students`.
5.  **Events**: Marque `INSERT` e `UPDATE`.
6.  **Type**: Escolha `Supabase Edge Functions` (ou `HTTP Request`).
7.  **Edge Function**: Selecione a função `resend-sync`.
    *   Se usar `HTTP Request`, a URL será `https://<PROJECT_REF>.supabase.co/functions/v1/resend-sync` e você deve adicionar o header `Authorization: Bearer <ANON_KEY>`.
8.  Clique em **Confirm**.

### Alternativa via SQL (se preferir)

Se você tiver a extensão `pg_net` habilitada e souber a URL da sua função:

```sql
create trigger "sync-resend-trigger"
after insert or update on "public"."students"
for each row
execute function supabase_functions.http_request(
  'https://<PROJECT_REF>.supabase.co/functions/v1/resend-sync',
  'POST',
  '{"Content-type":"application/json", "Authorization": "Bearer <ANON_KEY>"}',
  '{}',
  '1000'
);
```
