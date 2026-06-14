# Roadmap: Aluno First CRM Tech Debt

## Active Phase

### Phase 1: Security & RLS Audit 🟢
**Goal:** Auditar e fortalecer as políticas de Row Level Security e funções auxiliares.
- SEC-01: Auditar as policies de RLS para a tabela de students
- SEC-02: Verificar helpers de acesso para evitar exposição inter-unidades
- SEC-03: Restringir queries anônimas públicas para não expor a lista de unidades internas

## Upcoming Phases

### Phase 2: Synchronization & Consistency ⚪
**Goal:** Garantir consistência dos estados entre as tabelas do Supabase.
- SYNC-01: Criar mechanismos/triggers para sincronizar `students.status` e `appointments.status`
- SYNC-02: Evitar regressões silenciosas durante agendamentos e cancelamentos
- SYNC-03: Garantir que as interações operacionais sejam rastreáveis e auditáveis

### Phase 3: Timezone & Scheduling ⚪
**Goal:** Refatorar a lógica de datas para garantir fusos horários consistentes e evitar bloqueios inválidos.
- TIME-01: Padronizar tratamento de datas e timezones em UTC no banco e conversão no front-end
- TIME-02: Implementar validação consistente para bloqueio de horários passados
- TIME-03: Ajustar lógica de detecção de faltas baseada no timezone correto

---
*Roadmap generated: 2026-06-14*
