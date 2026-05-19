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
