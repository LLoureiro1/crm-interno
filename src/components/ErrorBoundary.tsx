import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Ignorar erros específicos de removeChild
    if (error.message && error.message.includes('removeChild')) {
      console.log('Erro de removeChild capturado e ignorado:', error);
      // Resetar o estado para não mostrar a UI de fallback
      this.setState({ hasError: false });
      return;
    }
    
    console.error('Erro capturado pelo ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.props.fallback) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

export default ErrorBoundary;