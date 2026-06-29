-- Atualiza documentação da coluna: destinatários vazios = ninguém recebe
COMMENT ON COLUMN public.email_templates.recipient_user_ids IS
  'UUIDs de profiles que recebem e-mails internos (templates [INTERNO]). Vazio = ninguém recebe.';
