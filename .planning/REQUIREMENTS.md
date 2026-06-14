# Requirements: Aluno First CRM Tech Debt

**Defined:** 2026-06-14
**Core Value:** Garantir um fluxo confiável de matrícula e acompanhamento de alunos sem vazamento de dados entre unidades.

## v1 Requirements

Requirements focused on stabilizing the codebase and fixing tech debt.

### Security & Access Control

- [ ] **SEC-01**: Auditar as policies de RLS para a tabela de students
- [ ] **SEC-02**: Verificar helpers de acesso para evitar exposição inter-unidades
- [ ] **SEC-03**: Restringir queries anônimas públicas para não expor a lista de unidades internas

### Synchronization & Consistency

- [ ] **SYNC-01**: Criar mechanismos/triggers para sincronizar `students.status` e `appointments.status`
- [ ] **SYNC-02**: Evitar regressões silenciosas durante agendamentos e cancelamentos
- [ ] **SYNC-03**: Garantir que as interações operacionais sejam rastreáveis e auditáveis

### Timezone & Scheduling

- [ ] **TIME-01**: Padronizar tratamento de datas e timezones em UTC no banco e conversão no front-end
- [ ] **TIME-02**: Implementar validação consistente para bloqueio de horários passados
- [ ] **TIME-03**: Ajustar lógica de detecção de faltas baseada no timezone correto

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | Phase 1 | Pending |
| SEC-02 | Phase 1 | Pending |
| SEC-03 | Phase 1 | Pending |
| SYNC-01 | Phase 2 | Pending |
| SYNC-02 | Phase 2 | Pending |
| SYNC-03 | Phase 2 | Pending |
| TIME-01 | Phase 3 | Pending |
| TIME-02 | Phase 3 | Pending |
| TIME-03 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-14*
*Last updated: 2026-06-14 after initial definition*
