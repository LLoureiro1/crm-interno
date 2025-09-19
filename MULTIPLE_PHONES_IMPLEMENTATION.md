# Implementação de Múltiplos Telefones

## Resumo da Implementação

Foi implementada a funcionalidade de múltiplos telefones tanto na página de inscrição quanto na ficha do aluno. O primeiro telefone (principal) fica na tabela `students` e telefones adicionais ficam na tabela `student_phones` existente.

## Mudanças Realizadas

### 1. Banco de Dados

**Utilização da tabela existente:** `student_phones`

A tabela `student_phones` já existia no banco com a seguinte estrutura:
- `id`: UUID (chave primária)
- `student_id`: UUID (referência para students)
- `phone_number`: VARCHAR (número do telefone)
- `created_at`, `updated_at`: timestamps

**Estratégia implementada:**
- **Telefone principal**: Armazenado no campo `phone` da tabela `students` (como já era)
- **Telefones adicionais**: Armazenados na tabela `student_phones` existente
- Sem necessidade de migração adicional

### 2. Tipos TypeScript

**Arquivo:** `src/integrations/supabase/types.ts`
- Adicionado tipo `student_phones` com todas as propriedades necessárias

**Arquivo:** `src/types/registration.ts`
- Atualizado `RegistrationFormData` para incluir:
  - `phone`: string (telefone principal)
  - `additionalPhones`: string[] (telefones adicionais)

### 3. Componentes

#### 3.1 MultiplePhones (`src/components/ui/MultiplePhones.tsx`)
- Componente reutilizável para gerenciar múltiplos telefones
- Exibe telefone principal em destaque (fundo azul)
- Permite adicionar/remover telefones adicionais
- Formatação automática de telefones
- Validação em tempo real

#### 3.2 StudentPhoneManager (`src/components/ui/StudentPhoneManager.tsx`)
- Componente específico para edição de telefones na ficha do aluno
- Modo visualização e edição
- Gerencia telefone principal (tabela students) e adicionais (tabela student_phones)
- Integração completa com Supabase
- Validação e tratamento de erros

### 4. Páginas Atualizadas

#### 4.1 Página de Inscrição
**Arquivos modificados:**
- `src/components/RegistrationForm.tsx`
- `src/components/registration/ResponsibleDataSection.tsx`

**Mudanças:**
- Integração do componente `MultiplePhones`
- Telefone principal salvo na tabela `students`
- Telefones adicionais salvos na tabela `student_phones`
- Validação de telefone principal obrigatório

#### 4.2 Ficha do Aluno
**Arquivo:** `src/pages/StudentProfile.tsx`

**Mudanças:**
- Substituição da exibição simples de telefone pelo `StudentPhoneManager`
- Permissões baseadas no perfil do usuário
- Integração com sistema de edição existente

### 5. Validação

**Arquivo:** `src/utils/registrationValidation.ts`

**Mudanças:**
- Validação de telefone principal obrigatório
- Validação opcional de telefones adicionais (se preenchidos, devem ser válidos)
- Verificação de formato (11 dígitos com DDD) para todos os telefones

## Funcionalidades

### Na Página de Inscrição:
1. **Telefone Principal Obrigatório:** Campo destacado em azul, deve ser preenchido
2. **Adicionar Telefones:** Botão "+" para adicionar telefones adicionais
3. **Telefones Adicionais:** Opcionais, mas se preenchidos devem ser válidos
4. **Remover Telefones:** Possível remover apenas telefones adicionais
5. **Formatação Automática:** Telefones são formatados como (XX) XXXXX-XXXX

### Na Ficha do Aluno:
1. **Visualização:** Telefone principal em destaque (azul) e adicionais em cinza
2. **Edição:** Modo de edição completo para admin/direção
3. **Adicionar/Remover:** Gerenciamento de telefones adicionais
4. **Telefone Principal:** Sempre presente, editável mas não removível
5. **Validação:** Validação em tempo real durante edição

## Compatibilidade

- **Campo `phone` mantido:** Telefone principal continua na tabela `students`
- **Tabela existente:** Utiliza tabela `student_phones` já existente no banco
- **Sem migração:** Não há necessidade de migração de dados

## Segurança

- **Permissões:** Utiliza as permissões RLS já configuradas na tabela `student_phones`
- **Validação:** Validação tanto no frontend quanto no banco de dados
- **Sanitização:** Telefones são sanitizados e formatados adequadamente

## Implementação Pronta

A funcionalidade está completamente implementada e pronta para uso:
1. **Página de inscrição:** Telefone principal + telefones adicionais
2. **Ficha do aluno:** Visualização e edição de todos os telefones
3. **Validação:** Telefone principal obrigatório, adicionais opcionais
4. **Interface:** Clara distinção entre telefone principal e adicionais

## Arquivos Modificados

### Novos Arquivos:
- `src/components/ui/MultiplePhones.tsx`
- `src/components/ui/StudentPhoneManager.tsx`
- `MULTIPLE_PHONES_IMPLEMENTATION.md`

### Arquivos Modificados:
- `src/integrations/supabase/types.ts` - Adicionado tipo `student_phones`
- `src/types/registration.ts` - Adicionado `additionalPhones` ao `RegistrationFormData`
- `src/components/RegistrationForm.tsx` - Integração com múltiplos telefones
- `src/components/registration/ResponsibleDataSection.tsx` - Componente `MultiplePhones`
- `src/pages/StudentProfile.tsx` - Componente `StudentPhoneManager`
- `src/utils/registrationValidation.ts` - Validação de telefones principal e adicionais
