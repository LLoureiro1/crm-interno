import type { User } from '@supabase/supabase-js';

export const BRT_TIMEZONE = 'America/Sao_Paulo';
const AUTH_LOGOUT_REASON_KEY = 'auth_logout_reason';

export function getBrtDateKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BRT_TIMEZONE }).format(date);
}

export function isBrtSessionExpired(user: User): boolean {
  const lastSignIn = user.last_sign_in_at;
  if (!lastSignIn) return false;
  return getBrtDateKey(new Date(lastSignIn)) !== getBrtDateKey();
}

export function msUntilNextMidnightBrt(now: Date = new Date()): number {
  const todayKey = getBrtDateKey(now);
  const [year, month, day] = todayKey.split('-').map(Number);
  const nextMidnightUtc = Date.UTC(year, month - 1, day + 1, 3, 0, 0);
  return Math.max(1000, nextMidnightUtc - now.getTime());
}

export function brtDateToUtcStart(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 3, 0, 0)).toISOString();
}

export function brtDateToUtcEnd(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1, 2, 59, 59, 999)).toISOString();
}

export function markAuthLogoutReason(reason: 'session_expired'): void {
  sessionStorage.setItem(AUTH_LOGOUT_REASON_KEY, reason);
}

export function consumeAuthLogoutReason(): 'session_expired' | null {
  const reason = sessionStorage.getItem(AUTH_LOGOUT_REASON_KEY);
  if (reason === 'session_expired') {
    sessionStorage.removeItem(AUTH_LOGOUT_REASON_KEY);
    return reason;
  }
  return null;
}
