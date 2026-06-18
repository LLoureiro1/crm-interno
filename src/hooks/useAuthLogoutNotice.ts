import { useEffect } from 'react';
import { toast } from 'sonner';
import { consumeAuthLogoutReason } from '@/utils/authSession';

export function useAuthLogoutNotice() {
  useEffect(() => {
    if (consumeAuthLogoutReason() === 'session_expired') {
      toast.info('Sua sessão foi encerrada por segurança. Faça login novamente.');
    }
  }, []);
}
