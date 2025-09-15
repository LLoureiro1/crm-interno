# Implementação de Convite de Usuários por Email

## Funcionalidade Implementada

A funcionalidade de criação de usuários com convite por email foi implementada no arquivo `src/components/management/UserManagement.tsx`.

## Como Funciona

### 1. Interface do Usuário
- **Campo de Senha Temporária**: Adicionado apenas quando criando um novo usuário (não aparece ao editar)
- **Validação**: Senha deve ter pelo menos 6 caracteres
- **Feedback**: Mensagem explicativa sobre o processo de convite

### 2. Processo de Criação
1. **Criação no Supabase Auth**: Usa `supabase.auth.admin.createUser()` para criar o usuário
2. **Confirmação de Email**: Email é automaticamente confirmado (`email_confirm: true`)
3. **Criação do Perfil**: Insere dados na tabela `profiles` com as informações do usuário
4. **Metadados**: Armazena informações adicionais no `user_metadata`

### 3. Configurações do Supabase
Para que a funcionalidade funcione completamente, é necessário configurar:

#### Templates de Email (no painel do Supabase)
- **Invite User**: Template para convite de usuários
- **Confirm Signup**: Template para confirmação de cadastro

#### Configurações de Email
- Configurar provedor de email (SMTP) no painel do Supabase
- Ou usar serviços integrados como SendGrid, Mailgun, etc.

## Código Implementado

### Campos do Formulário
```typescript
const [formData, setFormData] = useState({
  name: '',
  email: '',
  profile: 'padrao' as Tables<'profiles'>['profile'],
  unit_id: '',
  temporaryPassword: '' // Novo campo
});
```

### Lógica de Criação
```typescript
// Criar novo usuário com convite por email
const { data: authData, error: authError } = await supabase.auth.admin.createUser({
  email: formData.email,
  password: formData.temporaryPassword,
  email_confirm: true,
  user_metadata: {
    name: formData.name,
    profile: formData.profile,
    unit_id: formData.unit_id || null
  }
});

// Criar perfil na tabela profiles
const { error: profileError } = await supabase
  .from('profiles')
  .insert({
    id: authData.user.id,
    name: formData.name,
    email: formData.email,
    profile: formData.profile,
    unit_id: formData.unit_id || null
  });
```

## Próximos Passos

1. **Configurar Templates de Email** no painel do Supabase
2. **Configurar Provedor de Email** (SMTP ou serviço integrado)
3. **Testar a Funcionalidade** criando um usuário
4. **Personalizar Templates** conforme necessário

## Observações Importantes

- A funcionalidade usa a **Supabase Auth Admin API**, que requer permissões de administrador
- O email é automaticamente confirmado, então o usuário pode fazer login imediatamente
- A senha temporária é definida pelo administrador e pode ser alterada pelo usuário no primeiro login
- O sistema mantém a compatibilidade com a edição de usuários existentes
