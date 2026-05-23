-- Webhook do Google Apps Script (Web App) para disparo via Workspace

ALTER TABLE public.email_integrations
ADD COLUMN IF NOT EXISTS webhook_url text;

COMMENT ON COLUMN public.email_integrations.webhook_url IS
  'URL do Google Apps Script Web App. O token de segurança fica no secret GOOGLE_APPS_SCRIPT_WEBHOOK_TOKEN.';
