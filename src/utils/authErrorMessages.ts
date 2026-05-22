type AuthErrorContext = 'login' | 'reset';

/**
 * Converte mensagens técnicas do Supabase Auth em textos claros em português.
 */
export function getAuthErrorMessage(
  error: { message?: string } | null | undefined,
  context: AuthErrorContext = 'login'
): string {
  const raw = error?.message?.trim() ?? '';
  if (!raw) {
    return context === 'login'
      ? 'Não foi possível entrar. Tente novamente.'
      : 'Não foi possível enviar o e-mail. Tente novamente.';
  }

  if (raw.includes('desativada')) {
    return raw;
  }

  const msg = raw.toLowerCase();

  if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
    return 'E-mail ou senha incorretos. Confira os dados e tente novamente.';
  }

  if (msg.includes('email not confirmed')) {
    return 'Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada.';
  }

  if (msg.includes('too many requests') || msg.includes('rate limit')) {
    return 'Muitas tentativas em sequência. Aguarde alguns minutos e tente de novo.';
  }

  if (msg.includes('invalid email') || msg.includes('unable to validate email')) {
    return 'Informe um endereço de e-mail válido.';
  }

  if (msg.includes('user not found')) {
    return context === 'login'
      ? 'E-mail ou senha incorretos. Confira os dados e tente novamente.'
      : 'Não encontramos uma conta com este e-mail.';
  }

  if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch')) {
    return 'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.';
  }

  return context === 'login'
    ? 'Não foi possível entrar. Tente novamente ou use "Esqueci minha senha".'
    : 'Não foi possível enviar o e-mail de recuperação. Tente novamente mais tarde.';
}

type UserInviteErrorData = {
  error?: string;
  code?: string;
  details?: string;
} | null;

function extractInvokeErrorData(
  error: unknown,
  data?: UserInviteErrorData,
): UserInviteErrorData {
  if (data?.error || data?.code) {
    return data;
  }

  if (!error || typeof error !== 'object') {
    return data ?? null;
  }

  const err = error as Record<string, unknown>;

  if (err.context && typeof err.context === 'object') {
    const context = err.context as Record<string, unknown>;
    if (typeof context.error === 'string' || typeof context.code === 'string') {
      return context as UserInviteErrorData;
    }
  }

  if (err.data && typeof err.data === 'object') {
    return err.data as UserInviteErrorData;
  }

  return data ?? null;
}

/**
 * Converte erros da Edge Function create-user-invite em mensagens claras em português.
 */
export function getUserInviteErrorMessage(
  error: { message?: string } | null | undefined,
  data?: UserInviteErrorData,
): string {
  const payload = extractInvokeErrorData(error, data);
  const apiError = payload?.error?.trim() ?? '';
  const combined = `${apiError} ${payload?.code ?? ''} ${error?.message ?? ''}`.toLowerCase();

  if (
    payload?.code === 'email_inactive_user' ||
    combined.includes('inativo') ||
    combined.includes('email_inactive_user')
  ) {
    return apiError ||
      'Este e-mail já está cadastrado, mas o usuário está inativo. Reative-o na lista de usuários em vez de criar um novo cadastro.';
  }

  if (
    payload?.code === 'email_already_exists' ||
    combined.includes('already exists') ||
    combined.includes('já existe') ||
    combined.includes('já está cadastrado') ||
    combined.includes('already been registered') ||
    combined.includes('duplicate') ||
    combined.includes('409')
  ) {
    return apiError || 'Este e-mail já está cadastrado na base de usuários.';
  }

  if (apiError) {
    return apiError;
  }

  if (error?.message && !error.message.toLowerCase().includes('non-2xx')) {
    return error.message;
  }

  return 'Não foi possível criar o usuário. Tente novamente.';
}
