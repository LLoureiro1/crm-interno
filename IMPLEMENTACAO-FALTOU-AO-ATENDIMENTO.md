# Implementação: Marcar Alunos como "Faltou ao Atendimento"

## Resumo da Implementação

Foi implementada uma nova regra automática na Edge Function `update-student-statuses` para marcar alunos como "faltou_ao_atendimento" quando eles têm entrevista agendada no passado mas não há registro de appointment com status "realizado".

## Como Funciona

### Condições para Marcar como "Faltou ao Atendimento":

1. ✅ **Aluno tem `interview_date` no passado** (antes de hoje)
2. ✅ **Status atual é `atendimento_agendado` ou `confirmado`**
3. ✅ **Não há appointment com status `realizado`** na data da entrevista
4. ✅ **Cria registro de interação** explicando a mudança

### Exemplo Prático:

- **15/09**: Aluno tem entrevista agendada (`interview_date = '2025-09-15'`)
- **16/09**: Sistema executa a verificação
- **Resultado**: Se não há appointment "realizado" para 15/09, status muda para `faltou_ao_atendimento`

## Arquivos Modificados

### 1. `supabase/functions/update-student-statuses/index.ts`

**Adicionada nova regra (Rule 2):**
- Busca alunos com entrevista no passado
- Verifica se há appointment "realizado" na data da entrevista
- Marca como "faltou_ao_atendimento" se não houver
- Cria registro de interação explicando a mudança

## Como Testar

### 1. Teste Manual

1. Execute o script `test-missed-interview-functionality.sql` no painel do Supabase
2. Crie um aluno de teste com `interview_date` no passado
3. Clique no botão "Atualizar Status" no `StudentsTab`
4. Verifique se o status foi alterado para `faltou_ao_atendimento`

### 2. Teste Automático

Execute o script `setup-cron-job.sql` para configurar execução automática diária às 8h.

## Regras Implementadas

A função `update-student-statuses` agora possui 3 regras:

### Rule 1: Marcar como "Ausente"
- Alunos com exame no passado e sem notas registradas

### Rule 2: Marcar como "Faltou ao Atendimento" ⭐ **NOVA**
- Alunos com entrevista no passado e sem appointment "realizado"

### Rule 3: Marcar como "Atendimento há mais de uma semana"
- Alunos com status "atendimento_recentemente" há mais de 7 dias

## Execução

### Manual
- Botão "Atualizar Status" no `StudentsTab`

### Automática
- Cron job configurado para executar diariamente às 8h
- Script: `setup-cron-job.sql`

## Logs e Rastreabilidade

Cada mudança de status automática cria um registro em `student_interactions` com:
- `interaction_type`: 'mudanca_status'
- `comments`: Explicação detalhada da mudança
- `created_at`: Timestamp da mudança

## Benefícios

- ✅ **Automático**: Não precisa verificar manualmente
- ✅ **Consistente**: Mesma lógica do status "ausente"
- ✅ **Rastreável**: Cria registro de interação
- ✅ **Flexível**: Pode ser executado manualmente ou automaticamente
- ✅ **Inteligente**: Verifica se realmente não houve atendimento

## Monitoramento

Para monitorar a execução:

```sql
-- Ver logs de interações recentes
SELECT 
  si.created_at,
  si.comments,
  s.student_name,
  s.status
FROM public.student_interactions si
JOIN public.students s ON s.id = si.student_id
WHERE si.interaction_type = 'mudanca_status'
  AND si.comments LIKE '%Faltou ao Atendimento%'
ORDER BY si.created_at DESC
LIMIT 10;
```

## Troubleshooting

### Se a função não estiver funcionando:

1. Verificar se a Edge Function foi deployada corretamente
2. Verificar logs da função no painel do Supabase
3. Testar manualmente com dados de teste
4. Verificar se o cron job está ativo (se configurado)

### Logs importantes:
- `Found X students to check for missed interviews`
- `Found X students to mark as missed interview`
- `Error updating students to missed interview`
