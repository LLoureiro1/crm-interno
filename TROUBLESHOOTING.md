# 🔧 Guia de Solução de Problemas - Formulário de Inscrição

## ❌ Problema: Dropdown de Séries não aparece

### Sintomas:
- Campo "Série" não mostra opções ao clicar
- Console não mostra logs de debug
- Erro: "A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received"

### 🔍 Diagnóstico

O problema geralmente ocorre por uma das seguintes razões:

1. **Tabela `series` vazia** - Não há dados no banco
2. **Problema de conectividade** - Erro na conexão com Supabase
3. **Problema de permissões** - Usuário não tem acesso às tabelas
4. **Erro de JavaScript** - Problema no código do componente

### ✅ Solução Implementada

#### 1. **Melhorias no Hook `useRegistrationData`**
- ✅ Adicionado tratamento robusto de erros
- ✅ Estados de loading e error
- ✅ Teste de conectividade com Supabase
- ✅ Logs detalhados para debug
- ✅ Função `refetch` para recarregar dados

#### 2. **Melhorias no Componente `RegistrationForm`**
- ✅ Estados de loading durante carregamento inicial
- ✅ Tela de erro com botão "Tentar Novamente"
- ✅ Desabilitação do formulário durante carregamento
- ✅ Logs de debug para rastreamento

#### 3. **Melhorias no Componente `AcademicDataSection`**
- ✅ Contador de séries disponíveis no label
- ✅ Mensagens informativas quando não há dados
- ✅ Desabilitação de campos quando não há opções
- ✅ Logs detalhados de seleções

#### 4. **Dados Iniciais**
- ✅ Migração para inserir séries e unidades iniciais
- ✅ Script SQL para configuração manual
- ✅ Verificação de dados existentes

### 🚀 Como Resolver

#### **Passo 1: Verificar Dados no Banco**

1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard)
2. Vá para o projeto `vibbpmjjfgzfievvserr`
3. Acesse **Table Editor** → **series**
4. Verifique se há dados na tabela

#### **Passo 2: Inserir Dados Iniciais**

Se a tabela estiver vazia, execute o script SQL:

1. No Supabase Dashboard, vá para **SQL Editor**
2. Execute o arquivo `scripts/setup-initial-data.sql`
3. Ou execute este SQL diretamente:

```sql
-- Inserir séries iniciais
INSERT INTO public.series (id, name, level, created_at) VALUES
  (gen_random_uuid(), '1º Ano', 'fundamental', now()),
  (gen_random_uuid(), '2º Ano', 'fundamental', now()),
  (gen_random_uuid(), '3º Ano', 'fundamental', now()),
  (gen_random_uuid(), '4º Ano', 'fundamental', now()),
  (gen_random_uuid(), '5º Ano', 'fundamental', now()),
  (gen_random_uuid(), '6º Ano', 'fundamental', now()),
  (gen_random_uuid(), '7º Ano', 'fundamental', now()),
  (gen_random_uuid(), '8º Ano', 'fundamental', now()),
  (gen_random_uuid(), '9º Ano', 'fundamental', now()),
  (gen_random_uuid(), '1º Ano EM', 'medio', now()),
  (gen_random_uuid(), '2º Ano EM', 'medio', now()),
  (gen_random_uuid(), '3º Ano EM', 'medio', now())
ON CONFLICT (name) DO NOTHING;

-- Inserir unidades iniciais
INSERT INTO public.units (id, name, address, created_at) VALUES
  (gen_random_uuid(), 'Unidade Centro', 'Rua Central, 123', now()),
  (gen_random_uuid(), 'Unidade Norte', 'Av. Norte, 456', now()),
  (gen_random_uuid(), 'Unidade Sul', 'Rua Sul, 789', now())
ON CONFLICT (name) DO NOTHING;
```

#### **Passo 3: Testar a Aplicação**

1. Recarregue a página `/inscricao`
2. Abra o console do navegador (F12)
3. Verifique se aparecem os logs:
   ```
   🔧 Hook useRegistrationData inicializado
   🚀 Iniciando carregamento de dados...
   🔌 Testando conectividade com Supabase...
   ✅ Conectividade com Supabase OK
   📚 Carregando séries...
   📚 Dados de séries recebidos: { count: 12, data: [...], error: null }
   ✅ Séries definidas no estado: 12 séries
   🎓 AcademicDataSection renderizado com: { seriesCount: 12, ... }
   ```

#### **Passo 4: Verificar Funcionamento**

- ✅ Campo "Série" deve mostrar "Série * (12 séries disponíveis)"
- ✅ Dropdown deve abrir e mostrar as opções
- ✅ Seleção deve funcionar normalmente
- ✅ Campos dependentes (Unidade, Turma) devem aparecer

### 🐛 Debug Avançado

Se o problema persistir:

#### **1. Verificar Console do Navegador**
```javascript
// No console, execute:
console.log('Testando Supabase...');
// Verifique se há erros de rede ou JavaScript
```

#### **2. Verificar Rede**
- Abra **DevTools** → **Network**
- Recarregue a página
- Verifique se há requisições para Supabase
- Verifique se retornam status 200

#### **3. Verificar Permissões**
- No Supabase Dashboard, vá para **Authentication** → **Policies**
- Verifique se há políticas para a tabela `series`
- Se necessário, crie uma política pública:

```sql
-- Permitir leitura pública da tabela series
CREATE POLICY "Allow public read access to series" ON public.series
FOR SELECT USING (true);
```

### 📋 Checklist de Verificação

- [ ] Tabela `series` tem dados
- [ ] Tabela `units` tem dados  
- [ ] Console mostra logs de debug
- [ ] Não há erros de JavaScript
- [ ] Requisições para Supabase retornam 200
- [ ] Políticas de acesso estão configuradas
- [ ] Campo "Série" mostra contador de opções
- [ ] Dropdown abre e mostra opções
- [ ] Seleção funciona corretamente

### 🆘 Suporte

Se o problema persistir após seguir todos os passos:

1. **Colete informações de debug:**
   - Screenshot do console
   - Logs de rede (Network tab)
   - Mensagens de erro específicas

2. **Verifique configurações:**
   - URL do Supabase
   - Chaves de API
   - Políticas de segurança

3. **Teste em ambiente limpo:**
   - Modo incógnito
   - Outro navegador
   - Cache limpo

---

## 🎯 Melhorias Implementadas

### **Robustez**
- ✅ Tratamento completo de erros
- ✅ Estados de loading e error
- ✅ Fallbacks para dados vazios
- ✅ Reconexão automática

### **Experiência do Usuário**
- ✅ Indicadores visuais de carregamento
- ✅ Mensagens informativas
- ✅ Botões de retry
- ✅ Contadores de opções disponíveis

### **Debug e Monitoramento**
- ✅ Logs detalhados em cada etapa
- ✅ Informações de conectividade
- ✅ Contadores de dados carregados
- ✅ Rastreamento de seleções

### **Manutenibilidade**
- ✅ Código bem documentado
- ✅ Separação de responsabilidades
- ✅ Tratamento centralizado de erros
- ✅ Scripts de configuração automatizados
