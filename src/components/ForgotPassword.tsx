import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, ArrowLeft, Mail } from 'lucide-react';
import { getAuthErrorMessage } from '@/utils/authErrorMessages';

interface ForgotPasswordProps {
  onBack: () => void;
}

export const ForgotPassword = ({ onBack }: ForgotPasswordProps) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailExists, setEmailExists] = useState(true);
  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error, emailExists: exists } = await resetPassword(email);
      
      if (error) {
        toast.error(getAuthErrorMessage(error, 'reset'));
        return;
      }

      setEmailExists(exists);
      setEmailSent(true);
      
      if (exists) {
        toast.success('Email de reset enviado! Verifique sua caixa de entrada.');
      } else {
        toast.info('Se este email estiver cadastrado, você receberá um link de reset.');
      }
    } catch (error) {
      toast.error('Erro inesperado ao enviar email de reset');
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${
            emailExists ? 'bg-green-100' : 'bg-blue-100'
          }`}>
            <Mail className={`h-6 w-6 ${emailExists ? 'text-green-600' : 'text-blue-600'}`} />
          </div>
          <CardTitle className="text-xl">
            {emailExists ? 'Email Enviado!' : 'Processo Iniciado'}
          </CardTitle>
          <CardDescription>
            {emailExists ? (
              <>Enviamos um link de reset de senha para <strong>{email}</strong></>
            ) : (
              <>Processo de reset iniciado para <strong>{email}</strong></>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-gray-600 text-center">
            {emailExists ? (
              <>
                <p>Verifique sua caixa de entrada e clique no link para redefinir sua senha.</p>
                <p className="mt-2">O link expira em 1 hora.</p>
              </>
            ) : (
              <>
                <p>Se este email estiver cadastrado em nosso sistema, você receberá um link de reset de senha.</p>
                <p className="mt-2">Verifique sua caixa de entrada e spam. O link expira em 1 hora.</p>
                <p className="mt-2 text-xs text-gray-500">
                  Por segurança, não informamos se o email está cadastrado ou não.
                </p>
              </>
            )}
          </div>
          <Button
            onClick={onBack}
            variant="outline"
            className="w-full"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Login
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Esqueci Minha Senha</CardTitle>
        <CardDescription>
          Digite seu email para receber um link de reset de senha
        </CardDescription>
      </CardHeader>
      <CardContent>
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
          <Button
            type="submit"
            className="w-full bg-orange-500 hover:bg-orange-600 text-white"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              'Enviar Link de Reset'
            )}
          </Button>
          <Button
            type="button"
            onClick={onBack}
            variant="outline"
            className="w-full"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Login
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
