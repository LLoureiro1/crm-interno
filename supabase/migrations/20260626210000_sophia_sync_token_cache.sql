-- Cache de token SophiA entre invocações paginadas da edge function

ALTER TABLE public.sophia_sync_meta
  ADD COLUMN IF NOT EXISTS auth_token text,
  ADD COLUMN IF NOT EXISTS auth_mode text DEFAULT 'token',
  ADD COLUMN IF NOT EXISTS token_cached_at timestamptz;
