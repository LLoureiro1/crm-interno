import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  errorType: 'dom' | 'general' | null;
  retryCount: number;
}

class ErrorBoundary extends Component<Props, State> {
  private retryTimeout: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      errorType: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Identifica o tipo de erro
    const isDOMError = error.message.includes('removeChild') || 
                      error.message.includes('replaceChild') ||
                      error.message.includes('appendChild') ||
                      error.message.includes('insertBefore') ||
                      error.message.includes('Failed to execute') ||
                      error.name === 'NotFoundError';

    return { 
      hasError: true, 
      errorType: isDOMError ? 'dom' : 'general',
      retryCount: 0
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Para erros de DOM, tenta recuperação automática
    if (this.state.errorType === 'dom') {
      console.debug('DOM manipulation error caught:', error.message);
      
      // Recuperação automática para erros de DOM
      this.retryTimeout = setTimeout(() => {
        if (this.state.retryCount < 3) {
          this.setState(prevState => ({ 
            hasError: false, 
            errorType: null,
            retryCount: prevState.retryCount + 1
          }));
        }
      }, 100);
      
      return;
    }
    
    // Para outros erros, registra e notifica
    console.error('Error caught by boundary:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  handleRetry = () => {
    this.setState({ 
      hasError: false, 
      errorType: null,
      retryCount: 0
    });
  };

  render() {
    if (this.state.hasError) {
      // Para erros de DOM, não mostra UI de erro - apenas tenta recuperar
      if (this.state.errorType === 'dom') {
        return this.props.children;
      }

      // Para outros erros, mostra fallback personalizado ou padrão
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Algo deu errado</h2>
            <p className="text-gray-600 mb-4">Ocorreu um erro inesperado.</p>
            <button 
              onClick={this.handleRetry}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;