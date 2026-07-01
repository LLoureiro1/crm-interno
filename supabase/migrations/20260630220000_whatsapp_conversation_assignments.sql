CREATE TABLE public.whatsapp_conversation_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_name text NOT NULL REFERENCES public.whatsapp_integrations(instance_name) ON DELETE CASCADE,
  sender_phone text NOT NULL,
  assigned_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_user_name text NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_conversation_assignments_unique UNIQUE (instance_name, sender_phone)
);

CREATE INDEX whatsapp_conversation_assignments_instance_idx
  ON public.whatsapp_conversation_assignments (instance_name);

ALTER TABLE public.whatsapp_conversation_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY whatsapp_conversation_assignments_select ON public.whatsapp_conversation_assignments
  FOR SELECT TO authenticated
  USING (public.auth_user_can_view_whatsapp(instance_name));

CREATE POLICY whatsapp_conversation_assignments_insert ON public.whatsapp_conversation_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_can_view_whatsapp(instance_name)
    AND assigned_user_id = auth.uid()
  );

CREATE POLICY whatsapp_conversation_assignments_update ON public.whatsapp_conversation_assignments
  FOR UPDATE TO authenticated
  USING (public.auth_user_can_view_whatsapp(instance_name))
  WITH CHECK (
    public.auth_user_can_view_whatsapp(instance_name)
    AND assigned_user_id = auth.uid()
  );

COMMENT ON TABLE public.whatsapp_conversation_assignments IS
  'Usuário do CRM que assumiu a conversa WhatsApp com um contato';
