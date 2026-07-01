# Projeto
CRM web para captação, inscrição, atendimento e matrícula de novos alunos em múltiplas unidades escolares.
Cobre inscrição pública, operação interna do funil, automações de e-mail, relatórios e priorização por engajamento.

## Arquitetura
- SPA React 18 + TypeScript + Vite + Tailwind/shadcn.
- Supabase como backend: Auth, Postgres, RLS, Realtime, RPCs SQL e Edge Functions.
- Front-end concentrado em src; regras críticas em supabase/migrations; automações serverless em supabase/functions; rotas auxiliares em api.
- Módulos principais: inscrições, alunos, agendamentos, configurações, relatórios, listas de contato, automação de e-mails e **WhatsApp (Leads / Qualificação)**.

## WhatsApp e Qualificação (Leads)
- Integração com **Evolution API** (Baileys): uma instância = um número WhatsApp conectado via QR Code.
- **Admin** conecta/desconecta em Configurações → WhatsApp; pode liberar visualizadores em `whatsapp_viewer_access` (RLS; aba Leads só no menu para admin).
- Aba **Leads** (`QualificacaoTab`): conversas agrupadas por contato, UI estilo WhatsApp; **visível apenas para perfil admin** (`useWhatsappAccess`).
- Mensagens recebidas/enviadas gravadas em `whatsapp_messages` via webhook `evolution-webhook`; polling ~8s na UI.
- **Assumir conversa:** usuário clica em “Assumir Conversa”; grava em `whatsapp_conversation_assignments` (`assigned_user_id`, `assigned_user_name`); badge visível para todos; upsert permite repasse entre usuários.
- Proxy admin (status, QR, connect): dev via Vite; produção via `/api/evolution-whatsapp` (Vercel) apontando para Evolution hospedada (Oracle Cloud ou Cloudflare Tunnel). Ver `scripts/evolution/DEPLOY-PRODUCAO.md` e `ORACLE-CLOUD.md`.
- Tabelas: `whatsapp_integrations`, `whatsapp_viewer_access`, `whatsapp_messages`, `whatsapp_conversation_assignments`. RLS via `auth_user_can_view_whatsapp()`.

## Autenticação e Acesso
- Login interno via Supabase Auth; o hook de auth carrega profiles e força logout de usuário inativo.
- Perfis: admin, direcao, entrevistador e padrao.
- Admin gerencia usuários/configurações e pode marcar matriculado; direcao acessa relatórios avançados e operações amplas; entrevistador agenda e registra atendimento; padrao tem acesso operacional restrito.
- RLS isola dados por unidade; admin e usuários da unidade central podem atuar sobre múltiplas unidades; demais perfis ficam limitados à própria unidade.
- Fluxos públicos usam RPCs seguras com registration_token; anon não possui leitura ampla de students.

## Fluxos principais
1. Inscrição pública por unidade: valida dados, escolhe série/turma, registra origem e tracking, cria aluno via RPC e gera token de acompanhamento.
2. Turmas com prova entram como nao_confirmado e podem receber a próxima data de prova; turmas sem prova entram como nenhum_agendamento.
3. Autoagendamento público usa token e disponibilidade para criar appointment, atualizar status para atendimento_agendado e registrar interação.
4. Equipe interna agenda, cancela, reage e edita o aluno pelo perfil, com validação de conflito de horário do entrevistador.
5. Atendimento registra desconto, forma de pagamento/material, marca appointment como realizado, atualiza aluno para atendimento_recentemente e grava interação.
6. Atualização manual de status exige campos obrigatórios por caso: motivo de desistência, motivo de cadastro inválido e código ERP para matriculado.
7. Falta ao atendimento pode virar reagendamento público único por link; o fluxo cancela agendamentos abertos anteriores e cria um novo.
8. Crons e Edge Functions atualizam status atrasados, processam fila de e-mails, enviam lembretes e recalculam score de engajamento.
9. WhatsApp: webhook Evolution grava mensagens; equipe vê conversas em Leads, assume responsabilidade por contato e acompanha histórico no accordion estilo chat.

## Regras de negócio críticas
- Aluno matriculado só pode mudar para desistente ou cadastro_invalido; somente admin pode definir matriculado.
- Unidade central não deve aparecer para inscrição pública anônima.
- Autoagendamento e reagendamento exigem token válido, status elegível, horário futuro e slot sem colisão.
- Reagendamento após falta só pode ser usado uma vez por evento de falta.
- Histórico operacional precisa permanecer rastreável em student_interactions e contact_attempts.
- Score de engajamento combina funil, recência, e-mails, comparecimento e contatos; matriculado fixa 100 e desistente fixa 0.

## Pontos sensíveis
- Políticas RLS e helpers de acesso por unidade/perfil: erro aqui expõe dados entre unidades ou quebra fluxos anon.
- RPCs, triggers e migrations de inscrição, agendamento, e-mails e score concentram regras críticas do funil.
- Sincronismo entre students.status, appointments.status/attended, interações e automações pode gerar regressão silenciosa.
- Datas, timezone e bloqueio de horários passados impactam agendamento, reagendamento e detecção de faltas.
- Listas de contato são dinâmicas e redistribuem itens por carga, então qualquer mudança em filtros/status afeta distribuição.
- WhatsApp: Evolution precisa de URL pública estável em produção; sessão fica no servidor Docker; webhook Supabase deve permanecer acessível sem JWT ou com headers anon configurados.

## Convenções importantes
- Regra de negócio prioritariamente no banco via RPCs SECURITY DEFINER, triggers e policies; o front-end orquestra a UI.
- Componentes são organizados por domínio; hooks centralizam auth, formulário e dados; utils concentram validação e sanitização.
- Status e enums do banco são a fonte de verdade e precisam permanecer consistentes entre UI, SQL e Edge Functions.
- Mudanças em auth, status, e-mails ou scheduling devem considerar sempre os fluxos autenticado, anon, cron e webhook.
- Componentes WhatsApp em `src/components/whatsapp/`; lógica de agrupamento em `src/lib/whatsappConversations.ts`; proxy Evolution em `api/evolution-whatsapp.js`.
