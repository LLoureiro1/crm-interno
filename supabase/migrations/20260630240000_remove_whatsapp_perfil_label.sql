-- Remove rótulos "perfil" legados (se a migration anterior já foi aplicada)
DELETE FROM public.whatsapp_conversation_labels WHERE label_type::text = 'perfil';
