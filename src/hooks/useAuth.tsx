
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { Tables } from '@/integrations/supabase/types';

type Profile = Tables<'profiles'>;

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      
      // Verificar se o usuário está ativo
      if (data && !data.ativo) {
        // Usuário inativo - fazer logout
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

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    // Se o login foi bem-sucedido, verificar se o usuário está ativo
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('ativo')
          .eq('id', user.id)
          .single();
          
        if (!profileError && profile && !profile.ativo) {
          // Usuário inativo - fazer logout imediatamente
          await supabase.auth.signOut();
          return { 
            error: { 
              message: 'Sua conta foi desativada. Entre em contato com o administrador.' 
            } 
          };
        }
      }
    }
    
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const resetPassword = async (email: string) => {
    // Primeiro, verificar se o email existe na tabela profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email')
      .eq('email', email)
      .single();

    if (profileError || !profile) {
      // Email não existe na base
      return { 
        error: null, 
        emailExists: false 
      };
    }

    // Email existe, tentar enviar reset
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    
    return { 
      error, 
      emailExists: true 
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
