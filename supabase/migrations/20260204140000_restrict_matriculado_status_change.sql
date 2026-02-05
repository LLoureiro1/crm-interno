CREATE OR REPLACE FUNCTION check_matriculado_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Se o status anterior era matriculado
    IF OLD.status = 'matriculado' THEN
        -- E o novo status é diferente de matriculado (mudança real)
        -- E o novo status não é um dos permitidos (desistente, cadastro_invalido)
        IF NEW.status NOT IN ('matriculado', 'desistente', 'cadastro_invalido') THEN
            RAISE EXCEPTION 'Estudantes matriculados só podem alterar status para Desistente ou Cadastro Inválido.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_matriculado_status_change ON students;

CREATE TRIGGER trg_check_matriculado_status_change
BEFORE UPDATE OF status ON students
FOR EACH ROW
EXECUTE FUNCTION check_matriculado_status_change();
