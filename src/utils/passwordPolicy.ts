export const PASSWORD_MIN_LENGTH = 12;

export const PASSWORD_REQUIREMENTS_TEXT =
  'Mínimo de 12 caracteres, com letra maiúscula, minúscula, número e símbolo.';

export function validateStrongPassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres`;
  }

  if (!/[A-Z]/.test(password)) {
    return 'A senha deve conter pelo menos uma letra maiúscula';
  }

  if (!/[a-z]/.test(password)) {
    return 'A senha deve conter pelo menos uma letra minúscula';
  }

  if (!/[0-9]/.test(password)) {
    return 'A senha deve conter pelo menos um número';
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'A senha deve conter pelo menos um símbolo';
  }

  return null;
}
