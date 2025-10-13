
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { ForgotPassword } from './ForgotPassword';
import { AlertCircle } from 'lucide-react';

export const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [accountDisabled, setAccountDisabled] = useState(false);
  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAccountDisabled(false); // Reset do estado

    try {
      const { error } = await signIn(email, password);
      if (error) {
        // Verificar se é erro de usuário inativo
        if (error.message.includes('desativada')) {
          setAccountDisabled(true);
          toast.error('Conta Desativada', {
            description: 'Sua conta foi desativada. Entre em contato com o administrador.',
            duration: 8000,
          });
        } else {
          toast.error('Erro ao fazer login: ' + error.message);
        }
      }
    } catch (error) {
      toast.error('Erro inesperado ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center p-4">
        <ForgotPassword onBack={() => setShowForgotPassword(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-900">Laurel Escolar</CardTitle>
          <CardDescription>Faça login para acessar o sistema</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Alerta para conta desativada */}
          {accountDisabled && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Conta Desativada</strong><br />
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
              className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              disabled={loading}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
            
            <div className="text-center">
              <Button
                type="button"
                variant="link"
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-gray-600 hover:text-orange-500"
              >
                Esqueci minha senha
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
