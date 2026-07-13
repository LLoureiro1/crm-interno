-- Adiciona novos valores ao enum invalid_reason para "Escola Descartada"
ALTER TYPE invalid_reason ADD VALUE IF NOT EXISTS 'pequena_demais';
ALTER TYPE invalid_reason ADD VALUE IF NOT EXISTS 'instituicao_beneficente';
