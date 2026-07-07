
import { useState, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAuthLogoutNotice } from '@/hooks/useAuthLogoutNotice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { ForgotPassword } from './ForgotPassword';
import { AlertCircle } from 'lucide-react';
import { getAuthErrorMessage } from '@/utils/authErrorMessages';

function LoginShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-blue-50 p-4">
      {children}
    </div>
  );
}

function LoginCard({ children }: { children: ReactNode }) {
  return (
    <Card className="w-full max-w-md overflow-hidden border border-slate-200 shadow-sm">
      <CardHeader className="space-y-3 pb-4 text-center">
        <img
          src="/logo_apogeu_nobg.png"
          alt="Rede de Ensino Apogeu"
          className="mx-auto h-12 w-auto object-contain"
        />
        <div>
          <CardTitle className="text-2xl font-bold text-primary">CRM Interno</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Faça login para acessar o sistema
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [accountDisabled, setAccountDisabled] = useState(false);
  const { signIn } = useAuth();
  useAuthLogoutNotice();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAccountDisabled(false);

    try {
      const { error } = await signIn(email, password);
      if (error) {
        if (error.message.includes('desativada')) {
          setAccountDisabled(true);
          toast.error('Conta Desativada', {
            description: 'Sua conta foi desativada. Entre em contato com o administrador.',
            duration: 8000,
          });
        } else {
          toast.error(getAuthErrorMessage(error, 'login'));
        }
      }
    } catch {
      toast.error('Ocorreu um problema inesperado. Tente entrar novamente em instantes.');
    } finally {
      setLoading(false);
    }
  };

  if (showForgotPassword) {
    return (
      <LoginShell>
        <ForgotPassword onBack={() => setShowForgotPassword(false)} />
      </LoginShell>
    );
  }

  return (
    <LoginShell>
      <LoginCard>
        {accountDisabled && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Conta Desativada</strong>
              <br />
              Sua conta foi desativada pelo administrador. Entre em contato para mais informações.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="seu@email.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-[#ffac1a] text-white hover:bg-[#e89b0f]"
            disabled={loading}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>

          <div className="text-center">
            <Button
              type="button"
              variant="link"
              onClick={() => setShowForgotPassword(true)}
              className="text-sm text-primary hover:text-primary/80"
            >
              Esqueci minha senha
            </Button>
          </div>
        </form>
      </LoginCard>
    </LoginShell>
  );
};
