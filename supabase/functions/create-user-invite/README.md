# Create User Invite Edge Function

Esta Edge Function permite que administradores criem novos usuários e enviem convites por email de forma segura.

## Funcionalidades

- ✅ Verificação de autenticação obrigatória
- ✅ Verificação de permissões de administrador
- ✅ Validação completa de dados de entrada
- ✅ Criação segura de usuário via Service Role
- ✅ Geração automática de link de convite
- ✅ Rollback automático em caso de erro
- ✅ Prevenção de usuários duplicados

## Como usar

### Request
```http
POST /functions/v1/create-user-invite
Authorization: Bearer <user_access_token>
Content-Type: application/json

{
  "name": "Nome do Usuário",
  "email": "usuario@exemplo.com",
  "profile": "admin|direcao|secretaria|padrao",
  "unit_id": "uuid-da-unidade" // opcional
}
```

### Response Success
```json
{
  "success": true,
  "message": "User created successfully and invite sent",
  "user": {
    "id": "uuid",
    "email": "usuario@exemplo.com",
    "name": "Nome do Usuário",
    "profile": "admin",
    "unit_id": "uuid-da-unidade"
  },
  "invite_link": "https://...",
  "invite_error": null
}
```

### Response Error
```json
{
  "error": "Error message"
}
```

## Status Codes

- `200` - Usuário criado com sucesso
- `400` - Dados inválidos
- `401` - Não autenticado
- `403` - Sem permissões de admin
- `409` - Usuário já existe
- `500` - Erro interno

## Deploy

```bash
supabase functions deploy create-user-invite
```

## Variáveis de Ambiente Necessárias

- `SUPABASE_URL` - URL do projeto Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Service Role Key (configurada automaticamente)
- `SUPABASE_ANON_KEY` - Anon Key (configurada automaticamente)
