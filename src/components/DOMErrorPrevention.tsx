import React, { useEffect, ReactNode } from 'react';

interface DOMErrorPreventionProps {
  children: ReactNode;
}

export const DOMErrorPrevention: React.FC<DOMErrorPreventionProps> = ({ children }) => {
  useEffect(() => {
    // Intercepta erros globais de DOM
    const originalRemoveChild = Node.prototype.removeChild;
    const originalReplaceChild = Node.prototype.replaceChild;
    const originalAppendChild = Node.prototype.appendChild;
    const originalInsertBefore = Node.prototype.insertBefore;

    // Override seguro para removeChild
    Node.prototype.removeChild = function<T extends Node>(child: T): T {
      try {
        if (this.contains(child)) {
          return originalRemoveChild.call(this, child);
        }
        return child;
      } catch (error) {
        console.debug('Prevented removeChild error:', error);
        return child;
      }
    };

    // Override seguro para replaceChild
    Node.prototype.replaceChild = function<T extends Node>(newChild: Node, oldChild: T): T {
      try {
        if (this.contains(oldChild)) {
          return originalReplaceChild.call(this, newChild, oldChild);
        }
        return oldChild;
      } catch (error) {
        console.debug('Prevented replaceChild error:', error);
        return oldChild;
      }
    };

    // Override seguro para appendChild
    Node.prototype.appendChild = function<T extends Node>(child: T): T {
      try {
        if (!this.contains(child)) {
          return originalAppendChild.call(this, child);
        }
        return child;
      } catch (error) {
        console.debug('Prevented appendChild error:', error);
        return child;
      }
    };

    // Override seguro para insertBefore
    Node.prototype.insertBefore = function<T extends Node>(newChild: T, referenceChild: Node | null): T {
      try {
        if (!this.contains(newChild) && (!referenceChild || this.contains(referenceChild))) {
          return originalInsertBefore.call(this, newChild, referenceChild);
        }
        return newChild;
      } catch (error) {
        console.debug('Prevented insertBefore error:', error);
        return newChild;
      }
    };

    // Intercepta erros não capturados
    const handleUnhandledError = (event: ErrorEvent) => {
      const error = event.error;
      if (error && (
        error.message?.includes('removeChild') ||
        error.message?.includes('replaceChild') ||
        error.message?.includes('appendChild') ||
        error.message?.includes('insertBefore') ||
        error.message?.includes('Failed to execute')
      )) {
        console.debug('Prevented unhandled DOM error:', error.message);
        event.preventDefault();
        return false;
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
        console.debug('Prevented unhandled DOM promise rejection:', reason.message);
        event.preventDefault();
        return false;
      }
    };

    window.addEventListener('error', handleUnhandledError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Cleanup
    return () => {
      Node.prototype.removeChild = originalRemoveChild;
      Node.prototype.replaceChild = originalReplaceChild;
      Node.prototype.appendChild = originalAppendChild;
      Node.prototype.insertBefore = originalInsertBefore;
      
      window.removeEventListener('error', handleUnhandledError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return <>{children}</>;
};