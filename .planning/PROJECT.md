# Aluno First CRM

## What This Is

CRM web para captação, inscrição, atendimento e matrícula de novos alunos em múltiplas unidades escolares.
Cobre inscrição pública, operação interna do funil, automações de e-mail, relatórios e priorização por engajamento.

## Core Value

Garantir um fluxo confiável de matrícula e acompanhamento de alunos sem vazamento de dados entre unidades, mantendo a consistência do funil de vendas.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ [Frontend SPA] — React 18, Vite, TypeScript, Tailwind, shadcn/ui
- ✓ [Backend & Infra] — Supabase (Auth, Postgres, RLS, Edge Functions, RPCs)
- ✓ [Controle de Acesso] — Login interno, perfis (admin, direcao, entrevistador, padrao) e isolamento via RLS
- ✓ [Fluxos Principais] — Inscrição pública, autoagendamento, gestão interna do funil
- ✓ [Automações] — Processamento de e-mails via Resend, cálculo de score de engajamento, crons

### Active

<!-- Current scope. Building toward these. -->

- [ ] [Revisão de Segurança RLS] - Auditar e fortalecer policies de RLS para prevenir qualquer risco de exposição inter-unidades.
- [ ] [Sincronização de Status] - Criar garantias (ex: constraints/triggers) para sincronismo perfeito entre `students.status`, `appointments.status` e interações.
- [ ] [Refatoração de Timezone] - Padronizar e blindar o tratamento de datas/timezones nos agendamentos e detecção de faltas.
- [ ] [Otimização de Listas de Contato] - Melhorar a performance e consistência na redistribuição de itens por carga nas listas dinâmicas.

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- [Migração de Backend] — O sistema depende pesadamente do Supabase (Auth, RLS, RPCs, Edge Functions); trocar o BaaS está fora de cogitação.
- [Alteração do Framework UI] — Toda a interface já está construída e estabilizada com shadcn/ui e Tailwind.

## Context

O projeto é um sistema maduro ("brownfield") com regras de negócio críticas embutidas fortemente no banco de dados via PL/pgSQL (RPCs e Triggers). Os maiores desafios envolvem a manutenção dessa lógica no DB sem causar regressões silenciosas no fluxo (ex: agendamento público e anon). As políticas de RLS e o isolamento de dados por unidade são altamente sensíveis.

## Constraints

- **Tecnologia**: A regra de negócio deve ser priorizada no banco de dados (RPCs SECURITY DEFINER). O frontend apenas orquestra.
- **Segurança**: Fluxos "anon" não podem permitir leitura ampla da tabela de estudantes.
- **Confiabilidade**: O histórico operacional precisa ser permanentemente rastreável nas tabelas `student_interactions` e `contact_attempts`.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Focar o GSD-Core em melhorias e débitos técnicos | A codebase atual já suporta o fluxo principal, mas tem pontos frágeis na sincronia de status e timezones que podem causar falhas silenciosas. | — Pending |

---
*Last updated: 2026-06-14 after initialization*

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state
