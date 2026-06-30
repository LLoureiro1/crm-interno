# Evolution WhatsApp — Edge Function

Proxy seguro entre o CRM e a Evolution API. A chave da API **nunca** vai para o frontend.

## Secrets (Supabase Dashboard → Edge Functions → evolution-whatsapp)

| Secret | Exemplo local | Descrição |
|--------|---------------|-----------|
| `EVOLUTION_API_URL` | `http://127.0.0.1:8081` | URL da Evolution API |
| `EVOLUTION_API_KEY` | valor do `.env` em `scripts/evolution` | Chave `AUTHENTICATION_API_KEY` |
| `EVOLUTION_INSTANCE` | `aluno-first-crm` | Nome padrão da instância (opcional) |

> **Importante:** a Edge Function roda na **nuvem Supabase** e **não alcança** `localhost`, `127.0.0.1` nem `host.docker.internal`. Para desenvolvimento local, use `npm run dev` — o Vite faz proxy direto para o Docker na porta 8081.

### Desenvolvimento local (recomendado)

1. Suba o stack Docker:

```powershell
cd scripts/evolution
docker compose up -d
```

2. No `.env` **na raiz do CRM**, configure:

```
EVOLUTION_API_URL=http://127.0.0.1:8081
EVOLUTION_API_KEY=minha-chave-local-123
EVOLUTION_INSTANCE=aluno-first-crm
```

3. Inicie o CRM com `npm run dev` e acesse **Configurações → WhatsApp**.

Não é necessário `supabase functions serve` nem secrets na nuvem para testar localmente.

### Desenvolvimento local (legado — supabase functions serve)

1. Suba o stack Docker:

```powershell
cd scripts/evolution
docker compose up -d
```

2. Sirva a function localmente (com Supabase CLI):

```powershell
supabase functions serve evolution-whatsapp --env-file scripts/evolution/.env
```

Use `EVOLUTION_API_URL=http://127.0.0.1:8081` (não use `host.docker.internal`).

3. No CRM: **Configurações → WhatsApp → Gerar QR Code**.

# Deploy sem JWT — Evolution não envia Authorization header
# supabase functions deploy evolution-webhook --no-verify-jwt

## Ações da API

| action | Descrição |
|--------|-----------|
| `status` | Verifica se a instância existe e o estado da conexão |
| `connect` | Cria a instância (se necessário) e retorna o QR Code em base64 |
| `logout` | Desconecta o WhatsApp |

Acesso restrito a usuários com perfil `admin`.
