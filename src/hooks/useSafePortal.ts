import { useEffect, useRef, useState, useCallback } from 'react';

interface SafePortalOptions {
  container?: HTMLElement;
  cleanupDelay?: number;
}

export const useSafePortal = (options: SafePortalOptions = {}) => {
  const { container, cleanupDelay = 200 } = options;
  const [isReady, setIsReady] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const cleanupTimeoutRef = useRef<NodeJS.Timeout>();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    
    const checkContainer = () => {
      try {
        const targetContainer = container || document.body;
        
        if (targetContainer && 
            targetContainer.nodeType === Node.ELEMENT_NODE && 
            document.contains(targetContainer)) {
          setPortalContainer(targetContainer);
          setIsReady(true);
        }
      } catch (error) {
        console.warn('Portal container verification failed:', error);
        setIsReady(false);
      }
    };

    // Verificação inicial
    checkContainer();

    // Verificação adicional com delay para garantir que o DOM está pronto
    const timeout = setTimeout(() => {
      if (mountedRef.current) {
        checkContainer();
      }
    }, 10);

    return () => {
      mountedRef.current = false;
      clearTimeout(timeout);
      
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
      }
      
      // Cleanup seguro do portal
      cleanupTimeoutRef.current = setTimeout(() => {
        setIsReady(false);
        setPortalContainer(null);
      }, cleanupDelay);
    };
  }, [container, cleanupDelay]);

  const safeCleanup = useCallback(() => {
    if (!mountedRef.current) return;
    
    setIsReady(false);
    
    cleanupTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current) {
        setPortalContainer(null);
      }
    }, cleanupDelay);
  }, [cleanupDelay]);

  return {
    isReady: isReady && mountedRef.current,
    portalContainer,
    safeCleanup,
    isMounted: mountedRef.current
  };
};

// Hook para gerenciamento seguro de elementos DOM
export const useSafeDOMOperation = () => {
  const safeRemoveChild = useCallback((parent: Node, child: Node) => {
    try {
      if (parent && child && parent.contains(child)) {
        parent.removeChild(child);
        return true;
      }
    } catch (error) {
      // Silenciosamente ignora erros de removeChild
      console.debug('Safe removeChild prevented error:', error);
    }
    return false;
  }, []);

  const safeAppendChild = useCallback((parent: Node, child: Node) => {
    try {
      if (parent && child && !parent.contains(child)) {
        parent.appendChild(child);
        return true;
      }
    } catch (error) {
      console.warn('Safe appendChild failed:', error);
    }
    return false;
  }, []);

  const safeReplaceChild = useCallback((parent: Node, newChild: Node, oldChild: Node) => {
    try {
      if (parent && newChild && oldChild && parent.contains(oldChild)) {
        parent.replaceChild(newChild, oldChild);
        return true;
      }
    } catch (error) {
      console.debug('Safe replaceChild prevented error:', error);
    }
    return false;
  }, []);

  return {
    safeRemoveChild,
    safeAppendChild,
    safeReplaceChild
  };
};