CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_name text NOT NULL,
  sender_phone text NOT NULL,
  sender_name text,
  message_text text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  external_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_messages_instance_external_unique UNIQUE (instance_name, external_id)
);

CREATE INDEX whatsapp_messages_received_at_idx ON public.whatsapp_messages (received_at DESC);
CREATE INDEX whatsapp_messages_instance_idx ON public.whatsapp_messages (instance_name);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY whatsapp_messages_admin_select ON public.whatsapp_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.profile = 'admin'::public.user_profile
    )
  );

COMMENT ON TABLE public.whatsapp_messages IS 'Mensagens WhatsApp recebidas via Evolution API webhook';
