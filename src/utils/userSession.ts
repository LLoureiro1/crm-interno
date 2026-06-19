import { supabase } from '@/integrations/supabase/client';
import type { Enums } from '@/integrations/supabase/types';

const SESSION_STORAGE_KEY = 'crm_active_session_id';

export type SessionEndReason = Enums<'user_session_end_reason'>;

export async function startUserSession(userId: string): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('user_sessions')
      .insert({
        user_id: userId,
        metadata: {
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        },
      })
      .select('id')
      .single();

    if (error) throw error;
    if (data?.id) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, data.id);
    }
  } catch (error) {
    console.error('Erro ao registrar início da sessão:', error);
  }
}

export async function endUserSession(reason: SessionEndReason): Promise<void> {
  const sessionId = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!sessionId) return;

  try {
    const { error } = await supabase
      .from('user_sessions')
      .update({
        logged_out_at: new Date().toISOString(),
        logout_reason: reason,
      })
      .eq('id', sessionId)
      .is('logged_out_at', null);

    if (error) throw error;
  } catch (error) {
    console.error('Erro ao registrar fim da sessão:', error);
  } finally {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }
}
