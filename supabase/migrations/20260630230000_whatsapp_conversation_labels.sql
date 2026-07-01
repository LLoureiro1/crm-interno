CREATE TYPE public.whatsapp_lead_label_type AS ENUM ('propensao');

CREATE TABLE public.whatsapp_conversation_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_name text NOT NULL REFERENCES public.whatsapp_integrations(instance_name) ON DELETE CASCADE,
  sender_phone text NOT NULL,
  label_type public.whatsapp_lead_label_type NOT NULL DEFAULT 'propensao',
  propensity_stars smallint NOT NULL,
  updated_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_conversation_labels_unique UNIQUE (instance_name, sender_phone),
  CONSTRAINT whatsapp_conversation_labels_stars_check CHECK (
    propensity_stars >= 1 AND propensity_stars <= 5
  )
);

CREATE INDEX whatsapp_conversation_labels_instance_idx
  ON public.whatsapp_conversation_labels (instance_name);

ALTER TABLE public.whatsapp_conversation_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY whatsapp_conversation_labels_select ON public.whatsapp_conversation_labels
  FOR SELECT TO authenticated
  USING (public.auth_user_can_view_whatsapp(instance_name));

CREATE POLICY whatsapp_conversation_labels_insert ON public.whatsapp_conversation_labels
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_can_view_whatsapp(instance_name)
    AND updated_by = auth.uid()
  );

CREATE POLICY whatsapp_conversation_labels_update ON public.whatsapp_conversation_labels
  FOR UPDATE TO authenticated
  USING (public.auth_user_can_view_whatsapp(instance_name))
  WITH CHECK (
    public.auth_user_can_view_whatsapp(instance_name)
    AND updated_by = auth.uid()
  );

CREATE POLICY whatsapp_conversation_labels_delete ON public.whatsapp_conversation_labels
  FOR DELETE TO authenticated
  USING (public.auth_user_can_view_whatsapp(instance_name));

COMMENT ON TABLE public.whatsapp_conversation_labels IS
  'Propensão do lead WhatsApp (1-5 estrelas). Inscrito é derivado do match com students.';
