import { useEffect, useState } from 'react';
import { sanitizeTrackingCode } from '../utils/sanitization';

const TRACKING_CODE_KEY = 'student_tracking_code';
const TRACKING_CODE_EXPIRY_KEY = 'student_tracking_code_expiry';
const TRACKING_CODE_EXPIRY_DAYS = 30; // Código expira em 30 dias

export interface TrackingCodeData {
  code: string | null;
  isExpired: boolean;
  source: 'url' | 'localStorage' | null;
}

/**
 * Hook para gerenciar códigos de rastreamento de origem dos cadastros
 * Captura códigos de parâmetros URL (tracking, utm_source) e persiste no localStorage
 */
export const useTrackingCode = () => {
  const [trackingData, setTrackingData] = useState<TrackingCodeData>({
    code: null,
    isExpired: false,
    source: null
  });

  /**
   * Extrai código de rastreamento da URL atual
   */
  const extractTrackingCodeFromURL = (): string | null => {
    if (typeof window === 'undefined') return null;
    
    const urlParams = new URLSearchParams(window.location.search);
    
    // Prioridade: tracking > utm_source
    const trackingCode = urlParams.get('tracking') || urlParams.get('utm_source');
    
    return trackingCode ? sanitizeTrackingCode(trackingCode) : null;
  };

  /**
   * Verifica se o código armazenado está expirado
   */
  const isTrackingCodeExpired = (): boolean => {
    const expiryStr = localStorage.getItem(TRACKING_CODE_EXPIRY_KEY);
    if (!expiryStr) return true;
    
    const expiryDate = new Date(expiryStr);
    return new Date() > expiryDate;
  };

  /**
   * Obtém código de rastreamento do localStorage
   */
  const getStoredTrackingCode = (): string | null => {
    if (isTrackingCodeExpired()) {
      clearTrackingCode();
      return null;
    }
    
    return localStorage.getItem(TRACKING_CODE_KEY);
  };

  /**
   * Armazena código de rastreamento no localStorage com data de expiração
   */
  const storeTrackingCode = (code: string): void => {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + TRACKING_CODE_EXPIRY_DAYS);
    
    localStorage.setItem(TRACKING_CODE_KEY, code);
    localStorage.setItem(TRACKING_CODE_EXPIRY_KEY, expiryDate.toISOString());
  };

  /**
   * Remove código de rastreamento do localStorage
   */
  const clearTrackingCode = (): void => {
    localStorage.removeItem(TRACKING_CODE_KEY);
    localStorage.removeItem(TRACKING_CODE_EXPIRY_KEY);
  };

  /**
   * Obtém o código de rastreamento atual (URL ou localStorage)
   */
  const getCurrentTrackingCode = (): TrackingCodeData => {
    // Primeiro, verifica se há código na URL
    const urlCode = extractTrackingCodeFromURL();
    if (urlCode) {
      return {
        code: urlCode,
        isExpired: false,
        source: 'url'
      };
    }

    // Se não há código na URL, verifica localStorage
    const storedCode = getStoredTrackingCode();
    const isExpired = isTrackingCodeExpired();
    
    return {
      code: storedCode,
      isExpired,
      source: storedCode ? 'localStorage' : null
    };
  };

  /**
   * Processa e armazena código de rastreamento da URL
   */
  const processURLTrackingCode = (): void => {
    const urlCode = extractTrackingCodeFromURL();
    
    if (urlCode) {
      // Novo código da URL sempre sobrescreve o armazenado
      storeTrackingCode(urlCode);
      
      // Remove parâmetros da URL para limpeza (opcional)
      if (window.history && window.history.replaceState) {
        const url = new URL(window.location.href);
        url.searchParams.delete('tracking');
        url.searchParams.delete('utm_source');
        window.history.replaceState({}, '', url.toString());
      }
    }
  };

  // Efeito para processar código na inicialização
  useEffect(() => {
    processURLTrackingCode();
    setTrackingData(getCurrentTrackingCode());
  }, []);

  // Efeito para monitorar mudanças na URL
  useEffect(() => {
    const handleLocationChange = () => {
      processURLTrackingCode();
      setTrackingData(getCurrentTrackingCode());
    };

    // Escuta mudanças no histórico (para SPAs)
    window.addEventListener('popstate', handleLocationChange);
    
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  return {
    /**
     * Dados do código de rastreamento atual
     */
    trackingData,
    
    /**
     * Código de rastreamento ativo (null se expirado ou inexistente)
     */
    activeTrackingCode: trackingData.isExpired ? null : trackingData.code,
    
    /**
     * Força atualização dos dados de rastreamento
     */
    refreshTrackingCode: () => {
      setTrackingData(getCurrentTrackingCode());
    },
    
    /**
     * Remove código de rastreamento armazenado
     */
    clearTrackingCode,
    
    /**
     * Armazena manualmente um código de rastreamento
     */
    setTrackingCode: (code: string) => {
      const sanitizedCode = sanitizeTrackingCode(code);
      if (sanitizedCode) {
        storeTrackingCode(sanitizedCode);
        setTrackingData(getCurrentTrackingCode());
      }
    }
  };
};