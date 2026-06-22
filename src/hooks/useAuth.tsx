
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { Tables } from '@/integrations/supabase/types';
import { endUserSession, startUserSession } from '@/utils/userSession';
import {
  isBrtSessionExpired,
  markAuthLogoutReason,
  msUntilNextMidnightBrt,
} from '@/utils/authSession';

type Profile = Tables<'profiles'>;

const AUTH_BOOTSTRAP_TIMEOUT_MS = 12_000;

type AuthContextValue = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: { message: string } | null }>;
  signOut: () => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null; emailExists: boolean }>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const expiringSessionRef = useRef(false);
  const expirePromiseRef = useRef<Promise<void> | null>(null);
  const loadingResolvedRef = useRef(false);
  const profileRef = useRef<Profile | null>(null);

  const resolveLoading = useCallback(() => {
    if (loadingResolvedRef.current) return;
    loadingResolvedRef.current = true;
    setLoading(false);
  }, []);

  const updateProfile = useCallback((nextProfile: Profile | null) => {
    profileRef.current = nextProfile;
    setProfile(nextProfile);
  }, []);

  const expireSessionForSecurity = useCallback(async (currentUser: User) => {
    if (expirePromiseRef.current) {
      await expirePromiseRef.current;
      return;
    }

    expiringSessionRef.current = true;
    expirePromiseRef.current = (async () => {
      try {
        markAuthLogoutReason('session_expired');
        await endUserSession('session_expired');
        await supabase.auth.signOut();
      } catch (error) {
        console.error('Erro ao expirar sessão:', error);
      } finally {
        updateProfile(null);
        setUser(null);
        resolveLoading();
        expiringSessionRef.current = false;
        expirePromiseRef.current = null;
      }
    })();

    await expirePromiseRef.current;
  }, [resolveLoading, updateProfile]);

  const enforceDailySessionLimit = useCallback(async (currentUser: User | null | undefined) => {
    if (!currentUser || !isBrtSessionExpired(currentUser)) return false;
    await expireSessionForSecurity(currentUser);
    return true;
  }, [expireSessionForSecurity]);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      if (data && !data.ativo) {
        console.log('Usuário inativo detectado, fazendo logout...');
        await endUserSession('inactive_account');
        await supabase.auth.signOut();
        updateProfile(null);
        setUser(null);
        return;
      }

      updateProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      resolveLoading();
    }
  }, [resolveLoading, updateProfile]);

  useEffect(() => {
    let cancelled = false;

    const timeoutId = window.setTimeout(() => {
      if (!cancelled && !loadingResolvedRef.current) {
        console.warn('[auth] Timeout no bootstrap — liberando interface');
        resolveLoading();
      }
    }, AUTH_BOOTSTRAP_TIMEOUT_MS);

    const bootstrapSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;

        if (session?.user) {
          const expired = await enforceDailySessionLimit(session.user);
          if (cancelled) return;
          if (expired) {
            resolveLoading();
            return;
          }
          setUser(session.user);
          await fetchProfile(session.user.id);
          return;
        }

        setUser(null);
        resolveLoading();
      } catch (error) {
        console.error('[auth] Erro no bootstrap da sessão:', error);
        if (!cancelled) {
          setUser(null);
          resolveLoading();
        }
      }
    };

    bootstrapSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return;

      if (session?.user) {
        const expired = await enforceDailySessionLimit(session.user);
        if (cancelled) return;
        if (expired) {
          resolveLoading();
          return;
        }

        setUser(session.user);

        if (event === 'TOKEN_REFRESHED') {
          resolveLoading();
          if (!profileRef.current) {
            await fetchProfile(session.user.id);
          }
          return;
        }

        await fetchProfile(session.user.id);
        return;
      }

      setUser(null);
      updateProfile(null);
      resolveLoading();
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
      window.clearTimeout(timeoutId);
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enforceDailySessionLimit, fetchProfile, resolveLoading, updateProfile]);

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
              message: 'Sua conta foi desativada. Entre em contato com o administrador.',
            },
          };
        }

        await startUserSession(signedInUser.id);
      }
    }

    return { error };
  };

  const signOut = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser) {
      await endUserSession('manual');
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

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signIn,
        signOut,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
};
