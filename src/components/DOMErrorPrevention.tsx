import React, { useEffect, ReactNode } from 'react';

interface DOMErrorPreventionProps {
  children: ReactNode;
}

export const DOMErrorPrevention: React.FC<DOMErrorPreventionProps> = ({ children }) => {
  useEffect(() => {
    // Apenas monitora erros DOM sem interferir nas operações nativas
    const handleUnhandledError = (event: ErrorEvent) => {
      const error = event.error;
      if (error && (
        error.message?.includes('removeChild') ||
        error.message?.includes('replaceChild') ||
        error.message?.includes('appendChild') ||
        error.message?.includes('insertBefore') ||
        error.message?.includes('Failed to execute')
      )) {
        // Apenas loga o erro sem impedir sua propagação
        console.warn('DOM error detectado:', error.message);
        // Não usamos event.preventDefault() para permitir que o React/Radix lidem com o erro
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      if (reason && typeof reason === 'object' && reason.message && (
        reason.message.includes('removeChild') ||
        reason.message.includes('replaceChild') ||
        reason.message.includes('appendChild') ||
        reason.message.includes('insertBefore')
      )) {
        // Apenas loga a rejeição sem impedir sua propagação
        console.warn('DOM promise rejection detectado:', reason.message);
        // Não usamos event.preventDefault() para permitir que o React/Radix lidem com a rejeição
      }
    };

    window.addEventListener('error', handleUnhandledError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Cleanup
    return () => {
      window.removeEventListener('error', handleUnhandledError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return <>{children}</>;
};