CREATE TABLE public.whatsapp_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_name text NOT NULL UNIQUE,
  display_phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.whatsapp_viewer_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_name text NOT NULL REFERENCES public.whatsapp_integrations(instance_name) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_viewer_access_unique UNIQUE (instance_name, user_id)
);

CREATE INDEX whatsapp_viewer_access_user_idx ON public.whatsapp_viewer_access (user_id);

ALTER TABLE public.whatsapp_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_viewer_access ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.auth_user_can_view_whatsapp(p_instance_name text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.auth_user_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.whatsapp_viewer_access va
      WHERE va.user_id = auth.uid()
        AND (p_instance_name IS NULL OR va.instance_name = p_instance_name)
    );
$$;

REVOKE ALL ON FUNCTION public.auth_user_can_view_whatsapp(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_user_can_view_whatsapp(text) TO authenticated;

DROP POLICY IF EXISTS whatsapp_messages_admin_select ON public.whatsapp_messages;

CREATE POLICY whatsapp_messages_select ON public.whatsapp_messages
  FOR SELECT TO authenticated
  USING (public.auth_user_can_view_whatsapp(instance_name));

CREATE POLICY whatsapp_integrations_admin_all ON public.whatsapp_integrations
  FOR ALL TO authenticated
  USING (public.auth_user_is_admin())
  WITH CHECK (public.auth_user_is_admin());

CREATE POLICY whatsapp_integrations_select ON public.whatsapp_integrations
  FOR SELECT TO authenticated
  USING (public.auth_user_can_view_whatsapp(instance_name));

CREATE POLICY whatsapp_viewer_access_admin_all ON public.whatsapp_viewer_access
  FOR ALL TO authenticated
  USING (public.auth_user_is_admin())
  WITH CHECK (public.auth_user_is_admin());

CREATE POLICY whatsapp_viewer_access_own_select ON public.whatsapp_viewer_access
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

INSERT INTO public.whatsapp_integrations (instance_name, is_active)
VALUES ('aluno-first-crm', true)
ON CONFLICT (instance_name) DO NOTHING;

COMMENT ON TABLE public.whatsapp_integrations IS 'Instância WhatsApp conectada via Evolution API (um número por instância)';
COMMENT ON TABLE public.whatsapp_viewer_access IS 'Usuários do CRM autorizados a ver conversas da instância WhatsApp';
