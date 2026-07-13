-- Passe todas as escolas (students) para o status "Sem Contato" (nenhum_agendamento)
-- Desabilita triggers temporariamente para evitar erro do pg_net (schema "net")
SET session_replication_role = replica;

UPDATE students
SET status = 'nenhum_agendamento',
    updated_at = now();

SET session_replication_role = DEFAULT;
