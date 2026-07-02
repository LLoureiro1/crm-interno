import { supabase } from '@/integrations/supabase/client';

const MISSING_RPC_PATTERNS = [
  'Could not find the function',
  'PGRST202',
];

function isMissingRpcError(message: string, code?: string): boolean {
  if (code === 'PGRST202') return true;
  const lower = message.toLowerCase();
  return MISSING_RPC_PATTERNS.some((pattern) => lower.includes(pattern.toLowerCase()));
}

/** Valida senha no servidor; ignora se a RPC ainda não foi aplicada no banco. */
export async function assertStrongPasswordOnServer(password: string): Promise<Error | null> {
  const { error } = await supabase.rpc('assert_strong_password', {
    p_password: password,
  });

  if (!error) return null;

  if (isMissingRpcError(error.message ?? '', error.code)) {
    console.warn(
      'RPC assert_strong_password indisponível no banco; usando apenas validação do cliente.',
    );
    return null;
  }

  return new Error(error.message || 'Senha não atende aos requisitos de segurança.');
}
