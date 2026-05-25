import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { validateStrongPassword, PASSWORD_MIN_LENGTH, PASSWORD_REQUIREMENTS_TEXT } from '@/utils/passwordPolicy';

const SetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  // Extrair token dos parâmetros da URL
  const token = searchParams.get('token');
  const type = searchParams.get('type');

  useEffect(() => {
    validateToken();
  }, [token, type]);

  const validateToken = async () => {
    try {
      // Para convites via inviteUserByEmail, verificamos se o usuário está logado
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) {
        console.error('Error getting user:', error);
        setTokenValid(false);
        setValidating(false);
        return;
      }

      if (user) {
        // Usuário está logado via convite
        setTokenValid(true);
        setUserEmail(user.email || '');
        toast.success('Link de convite válido! Defina sua senha para continuar.');
        console.log('User logged in via invite:', user.email);
      } else {
        // Fallback: tentar validar token tradicional se não estiver logado
        if (!token || type !== 'invite') {
          setTokenValid(false);
          setValidating(false);
          return;
        }

        const { data, error: otpError } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: 'invite'
        });

        if (otpError) {
          console.error('Token validation error:', otpError);
          setTokenValid(false);
          toast.error('Link de convite inválido ou expirado');
        } else if (data.user) {
          setTokenValid(true);
          setUserEmail(data.user.email || '');
          toast.success('Link de convite válido! Defina sua senha para continuar.');
        } else {
          setTokenValid(false);
          toast.error('Link de convite inválido');
        }
      }
    } catch (error) {
      console.error('Error validating token:', error);
      setTokenValid(false);
      toast.error('Erro ao validar convite');
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validações
    const passwordError = validateStrongPassword(password);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    setLoading(true);

    try {
      const { error: policyError } = await supabase.rpc('assert_strong_password', {
        p_password: password,
      });
      if (policyError) throw policyError;

      // Atualizar a senha do usuário
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        throw error;
      }

      toast.success('Senha definida com sucesso! Você será redirecionado para o sistema.');
      
      // Não fazer logout - usuário já pode acessar o sistema diretamente
      // Redirecionar para o dashboard após um breve delay
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 2000);

    } catch (error: any) {
      console.error('Error setting password:', error);
      toast.error('Erro ao definir senha: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  // Tela de carregamento durante validação
  if (validating) {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-4" />
            <p className="text-gray-600">Validando convite...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Tela de erro para token inválido
  if (!tokenValid) {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-red-600">Convite Inválido</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Este link de convite é inválido ou expirou. Entre em contato com o administrador para receber um novo convite.
              </AlertDescription>
            </Alert>
            <Button
              onClick={() => navigate('/')}
              className="mt-6"
              variant="outline"
            >
              Voltar ao Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Tela principal para definir senha
  return (
    <div className="min-h-screen bg-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Definir Senha</CardTitle>
          <CardDescription className="text-center">
            Bem-vindo! Defina sua senha para acessar o sistema.
            {userEmail && (
              <div className="mt-2 text-sm text-gray-600">
                Conta: {userEmail}
              </div>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password">Nova Senha *</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua nova senha"
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-500" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-500" />
                  )}
                </Button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {PASSWORD_REQUIREMENTS_TEXT}
              </p>
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirmar Senha *</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirme sua nova senha"
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-500" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-500" />
                  )}
                </Button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Definindo Senha...
                </>
              ) : (
                'Definir Senha e Acessar Sistema'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SetPassword;
