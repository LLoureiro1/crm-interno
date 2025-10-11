# ⚡ Guia Rápido de Início

> **Configure e comece a usar o sistema em minutos!**

---

## 🎯 Para Quem Vai USAR o Sistema

### ✅ Primeiros Passos (10 minutos)

#### **1. Acesse o Sistema** 
```
URL: https://seu-dominio.com
Email: seu-email@exemplo.com
Senha: (fornecida pelo admin)
```

#### **2. Configure Seu Perfil (Se for Admin)**

**a) Cadastrar Unidades:**
1. Clique em **"Configurações"** (ícone de engrenagem)
2. Clique na aba **"Unidades"**
3. Clique em **"Nova Unidade"**
4. Preencha:
   - Nome da unidade
   - Endereço completo
   - Telefone
   - Cidade
   - **Slug** (será usado na URL - ex: `unidade-centro`)
5. Salve

**b) Cadastrar Séries/Turmas:**
1. Vá em **"Configurações" → "Turmas"**
2. Clique em **"Nova Turma"**
3. Preencha:
   - Nome da turma
   - Unidade
   - Série
   - Mensalidade (R$)
   - Material didático anual (R$)
   - Material didático mensal (R$)
4. Salve

**c) Cadastrar Datas de Provas:**
1. Vá em **"Configurações" → "Datas de Provas"**
2. Selecione a unidade
3. Escolha data e horário
4. Clique em **"Adicionar"**

**d) Criar Usuários da Equipe:**
1. Vá em **"Configurações" → "Usuários"**
2. Clique em **"Novo Usuário"**
3. Preencha:
   - Nome completo
   - Email
   - Perfil (Admin/Direção/Entrevistador/Padrão)
   - Unidade (opcional)
4. Salve

💡 **O sistema enviará um email para o novo usuário definir sua senha!**

---

#### **3. Compartilhe o Link de Inscrição**

Após cadastrar uma unidade, copie o link:
```
https://seu-dominio.com/inscricao/slug-da-unidade
```

📱 **Compartilhe em:**
- Instagram
- Facebook
- WhatsApp
- Site da escola
- E-mail marketing

---

#### **4. Gerencie as Inscrições**

**a) Ver Novos Inscritos:**
1. Clique na aba **"Inscritos"**
2. Veja a lista completa
3. Filtros disponíveis:
   - Por nome, código ou telefone (barra de busca)
   - Por status
   - Por série
   - Por unidade

**b) Abrir Ficha de um Candidato:**
1. Clique no ícone **👁️ (olho)** na linha do candidato
2. Veja todos os dados:
   - Informações pessoais
   - Dados acadêmicos
   - Cálculo de mensalidade
   - Histórico de interações

**c) Agendar Entrevista:**
1. Abra a ficha do candidato
2. Role até **"Agendar Entrevista"**
3. Selecione:
   - Data
   - Horário
   - Entrevistador
   - Formato (Presencial/À distância)
4. Clique em **"Agendar"**
5. Status muda automaticamente para **"Atendimento Agendado"**

**d) Atualizar Status:**
1. Abra a ficha do candidato
2. Role até **"Atualizar Status"**
3. Selecione novo status
4. Se for **"Desistente"**, escolha o motivo
5. Clique em **"Atualizar Status"**

---

#### **5. Realizar Atendimento (Para Entrevistadores)**

1. Vá na aba **"Agendamentos"**
2. Veja seu calendário do dia
3. Clique no candidato agendado
4. Na ficha, role até **"Registrar Atendimento"**
5. Preencha:
   - Notas da entrevista
   - Desconto na mensalidade (se aplicável)
   - Forma de pagamento do material
   - Desconto no material
   - Comentários
6. Clique em **"Registrar Atendimento"**

✨ **O sistema automaticamente:**
- Calcula os valores finais
- Atualiza o status
- Registra no histórico
- Marca o appointment como concluído

---

#### **6. Gerar Relatórios**

1. Clique na aba **"Relatórios"**
2. Veja cards com resumo:
   - Total de inscrições
   - Agendamentos hoje
   - Candidatos próxima prova
   - Matriculados
3. Clique em **"Ver Lista"** em cada card para detalhes
4. Use **"Exportar para Excel"** para baixar os dados

---

## 🔧 Para Quem Vai INSTALAR o Sistema

### ✅ Instalação Rápida (30 minutos)

#### **Pré-requisitos**
- [ ] Node.js 18+ instalado ([Download](https://nodejs.org))
- [ ] Git instalado ([Download](https://git-scm.com))
- [ ] Conta no Supabase ([Criar conta grátis](https://supabase.com))
- [ ] Editor de código (VS Code recomendado)

---

#### **Passo 1: Clonar o Projeto**

```bash
# Clone o repositório
git clone <url-do-repositorio>

# Entre na pasta
cd aluno-first-crm

# Instale as dependências
npm install
```

⏱️ **Tempo estimado:** 5 minutos

---

#### **Passo 2: Configurar Supabase**

1. **Crie um projeto no Supabase:**
   - Acesse https://supabase.com
   - Clique em **"New Project"**
   - Escolha um nome e senha
   - Escolha a região mais próxima
   - Aguarde criação (~2 minutos)

2. **Copie as credenciais:**
   - Vá em **"Settings" → "API"**
   - Copie:
     - `Project URL`
     - `anon public` (chave pública)

3. **Configure o arquivo `.env`:**

```bash
# Crie o arquivo .env na raiz do projeto
touch .env

# Abra e adicione:
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-publica-aqui
```

⏱️ **Tempo estimado:** 5 minutos

---

#### **Passo 3: Criar Banco de Dados**

1. **No Supabase Dashboard:**
   - Vá em **"SQL Editor"**
   - Clique em **"New Query"**

2. **Execute as migrations:**

**a) Estrutura básica:**
```sql
-- Ver arquivo: supabase/migrations/20250615050745-3bd98a89-7a90-4f84-9cc4-e68c977caaf9.sql
-- (Cole e execute todo o conteúdo do arquivo)
```

**b) Demais migrations:**
Execute sequencialmente todos os arquivos `.sql` da pasta `supabase/migrations/`

3. **Verifique as tabelas:**
   - Vá em **"Table Editor"**
   - Deve aparecer: `profiles`, `units`, `series`, `classes`, `students`, etc.

⏱️ **Tempo estimado:** 10 minutos

---

#### **Passo 4: Configurar Autenticação**

1. No Supabase, vá em **"Authentication" → "Providers"**
2. Habilite **"Email"**
3. Em **"URL Configuration"**, adicione:
   - Site URL: `http://localhost:5173` (dev) ou sua URL de produção
   - Redirect URLs: mesma URL acima

⏱️ **Tempo estimado:** 2 minutos

---

#### **Passo 5: Criar Primeiro Admin**

1. **No Supabase SQL Editor:**

```sql
-- 1. Criar usuário na tabela de autenticação
-- (Será feito pela interface ao fazer primeiro login)

-- 2. Ou criar diretamente:
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at)
VALUES (
  gen_random_uuid(),
  'admin@escola.com',
  crypt('SenhaSegura123', gen_salt('bf')),
  NOW()
);

-- 3. Criar profile
INSERT INTO profiles (id, name, email, profile)
SELECT 
  id,
  'Administrador',
  'admin@escola.com',
  'admin'
FROM auth.users 
WHERE email = 'admin@escola.com';
```

💡 **Ou use o método mais fácil:**
1. Execute `npm run dev`
2. Acesse `http://localhost:5173`
3. Clique em **"Criar Conta"**
4. Preencha os dados
5. Vá no Supabase SQL Editor e execute:
```sql
UPDATE profiles 
SET profile = 'admin' 
WHERE email = 'seu-email@exemplo.com';
```

⏱️ **Tempo estimado:** 3 minutos

---

#### **Passo 6: Testar Localmente**

```bash
# Inicie o servidor de desenvolvimento
npm run dev
```

Acesse: `http://localhost:5173`

**Teste:**
- ✅ Login funciona?
- ✅ Dashboard carrega?
- ✅ Consegue acessar configurações?

⏱️ **Tempo estimado:** 2 minutos

---

#### **Passo 7: Deploy (Produção)**

**Opção A: Vercel (Recomendado)**

1. Acesse https://vercel.com
2. Conecte com GitHub
3. Importe seu repositório
4. Configure variáveis de ambiente:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy automático! 🎉

**Opção B: Netlify**

```bash
# Build
npm run build

# Instalar CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy
netlify deploy --prod --dir=dist
```

⏱️ **Tempo estimado:** 5 minutos

---

## 📱 URLs Importantes

Após deploy, anote suas URLs:

```
🌐 App Principal: https://seu-app.vercel.app
📝 Formulário Público: https://seu-app.vercel.app/inscricao/[slug]
🔧 Configurações Supabase: https://app.supabase.com
```

---

## 🎯 Checklist Pós-Instalação

- [ ] Sistema acessível via URL
- [ ] Login funcionando
- [ ] Ao menos 1 usuário admin criado
- [ ] Ao menos 1 unidade cadastrada
- [ ] Ao menos 1 turma cadastrada
- [ ] Link de inscrição testado
- [ ] Teste completo: inscrição → agendamento → atendimento

---

## 🆘 Problemas Comuns

### **Erro: "Missing Supabase credentials"**
**Solução:** Verifique se o arquivo `.env` existe e tem as variáveis corretas

### **Erro: "Failed to fetch"**
**Solução:** Verifique a URL do Supabase e se o projeto está ativo

### **Erro: "Invalid API key"**
**Solução:** Use a chave `anon public`, não a `service_role`

### **Tabelas não aparecem**
**Solução:** Execute as migrations SQL no SQL Editor do Supabase

### **Não consigo fazer login**
**Solução:** 
1. Verifique se o email foi confirmado no Supabase Auth
2. Confirme que existe um profile com esse email

---

## 📞 Precisa de Ajuda?

1. **Leia a documentação completa:** `README.md`
2. **Documentação técnica:** `TECHNICAL_GUIDE.md`
3. **Contato:** [seu-email@exemplo.com]

---

## 🎉 Pronto!

Se chegou até aqui, seu sistema está **funcionando e pronto para uso**! 🚀

**Próximos passos:**
1. Personalize cores e logo (se necessário)
2. Configure integrações de email
3. Treine sua equipe
4. Comece a divulgar o link de inscrição

**Bom trabalho!** 💪

