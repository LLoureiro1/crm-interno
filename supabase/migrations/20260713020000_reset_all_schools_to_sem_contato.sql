-- Migra status antigos para a nova nomenclatura do sistema
-- Desabilita triggers para evitar erro do pg_net
SET session_replication_role = replica;

-- nao_confirmado → nenhum_agendamento (Sem Contato)
UPDATE students SET status = 'nenhum_agendamento', updated_at = now()
WHERE status = 'nao_confirmado';

-- ausente → nenhum_agendamento (Sem Contato)
UPDATE students SET status = 'nenhum_agendamento', updated_at = now()
WHERE status = 'ausente';

-- processo_anos_anteriores → desistente
UPDATE students SET status = 'desistente', updated_at = now()
WHERE status = 'processo_anos_anteriores';

SET session_replication_role = DEFAULT;
