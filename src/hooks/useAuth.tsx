
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { Tables } from '@/integrations/supabase/types';
import { logUserAuthEvent } from '@/utils/authActivityLog';
import {
  isBrtSessionExpired,
  markAuthLogoutReason,
  msUntilNextMidnightBrt,
} from '@/utils/authSession';

type Profile = Tables<'profiles'>;

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const expiringSessionRef = useRef(false);

  const expireSessionForSecurity = useCallback(async (currentUser: User) => {
    if (expiringSessionRef.current) return;
    expiringSessionRef.current = true;

    try {
      markAuthLogoutReason('session_expired');
      await logUserAuthEvent(currentUser.id, 'session_expired');
      await supabase.auth.signOut();
      setProfile(null);
      setUser(null);
    } finally {
      expiringSessionRef.current = false;
    }
  }, []);

  const enforceDailySessionLimit = useCallback(async (currentUser: User | null | undefined) => {
    if (!currentUser || !isBrtSessionExpired(currentUser)) return false;
    await expireSessionForSecurity(currentUser);
    return true;
  }, [expireSessionForSecurity]);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      
      if (data && !data.ativo) {
        console.log('Usuário inativo detectado, fazendo logout...');
        await supabase.auth.signOut();
        setProfile(null);
        setUser(null);
        return;
      }
      
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const bootstrapSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;

      if (session?.user) {
        const expired = await enforceDailySessionLimit(session.user);
        if (cancelled || expired) {
          if (!expired) setLoading(false);
          return;
        }
        setUser(session.user);
        await fetchProfile(session.user.id);
        return;
      }

      setUser(null);
      setLoading(false);
    };

    bootstrapSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return;

      if (session?.user) {
        const expired = await enforceDailySessionLimit(session.user);
        if (cancelled || expired) return;
        setUser(session.user);
        if (event !== 'TOKEN_REFRESHED') {
          fetchProfile(session.user.id);
        }
        return;
      }

      setUser(null);
      setProfile(null);
      setLoading(false);
    });

    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return;
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!cancelled && currentUser) {
        await enforceDailySessionLimit(currentUser);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enforceDailySessionLimit]);

  useEffect(() => {
    if (!user) return;

    const scheduleMidnightLogout = () => {
      const delay = msUntilNextMidnightBrt();
      return window.setTimeout(async () => {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser) {
          await expireSessionForSecurity(currentUser);
        }
      }, delay);
    };

    let timerId = scheduleMidnightLogout();

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      window.clearTimeout(timerId);
      timerId = scheduleMidnightLogout();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearTimeout(timerId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.id, user?.last_sign_in_at, expireSessionForSecurity]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (!error) {
      const { data: { user: signedInUser } } = await supabase.auth.getUser();
      if (signedInUser) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('ativo')
          .eq('id', signedInUser.id)
          .single();
          
        if (!profileError && profileData && !profileData.ativo) {
          await supabase.auth.signOut();
          return { 
            error: { 
              message: 'Sua conta foi desativada. Entre em contato com o administrador.' 
            } 
          };
        }

        await logUserAuthEvent(signedInUser.id, 'login');
      }
    }
    
    return { error };
  };

  const signOut = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser) {
      await logUserAuthEvent(currentUser.id, 'logout');
    }

    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return {
      error,
      emailExists: false,
    };
  };

  return {
    user,
    profile,
    loading,
    signIn,
    signOut,
    resetPassword,
  };
};
