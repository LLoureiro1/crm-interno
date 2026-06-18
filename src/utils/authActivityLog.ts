import { supabase } from '@/integrations/supabase/client';
import type { Enums } from '@/integrations/supabase/types';

export type UserAuthAction = Enums<'user_auth_action'>;

const AUTH_ACTION_LABELS: Record<UserAuthAction, string> = {
  login: 'Login',
  logout: 'Logout',
  session_expired: 'Sessão expirada (meia-noite)',
};

export function getAuthActionLabel(action: UserAuthAction | string): string {
  return AUTH_ACTION_LABELS[action as UserAuthAction] ?? action;
}

export async function logUserAuthEvent(
  userId: string,
  action: UserAuthAction,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    const { error } = await supabase.from('user_auth_logs').insert({
      user_id: userId,
      action,
      metadata: {
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        ...metadata,
      },
    });

    if (error) {
      console.error('Erro ao registrar log de acesso:', error);
    }
  } catch (error) {
    console.error('Erro ao registrar log de acesso:', error);
  }
}
