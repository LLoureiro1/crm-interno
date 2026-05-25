const REGISTRATION_TOKEN_PREFIX = 'registration_token_';
const REGISTRATION_TOKEN_EXPIRY_DAYS = 30;

const getStorageKey = (studentId: string) => `${REGISTRATION_TOKEN_PREFIX}${studentId}`;

export const storeRegistrationToken = (studentId: string, token: string): void => {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + REGISTRATION_TOKEN_EXPIRY_DAYS);

  sessionStorage.setItem(getStorageKey(studentId), JSON.stringify({
    token,
    expiry: expiryDate.toISOString(),
  }));
};

export const getRegistrationToken = (studentId: string): string | null => {
  const raw = sessionStorage.getItem(getStorageKey(studentId));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { token?: string; expiry?: string };
    if (!parsed.token || !parsed.expiry) return null;
    if (new Date(parsed.expiry) < new Date()) {
      sessionStorage.removeItem(getStorageKey(studentId));
      return null;
    }
    return parsed.token;
  } catch {
    return null;
  }
};

export const clearRegistrationToken = (studentId: string): void => {
  sessionStorage.removeItem(getStorageKey(studentId));
};
