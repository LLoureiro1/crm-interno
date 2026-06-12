import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { toast } from '@/components/ui/sonner'
import { supabase } from '@/integrations/supabase/client'

declare global {
  interface Window {
    deferredPrompt?: any
  }
}

const showBootError = (message: string) => {
  const root = document.getElementById('root')
  if (!root || root.childElementCount > 0) return
  root.innerHTML = `<div style="padding:1.5rem;font-family:system-ui,sans-serif;color:#1e293b"><h2 style="margin:0 0 .5rem;font-size:1.1rem">Erro ao carregar</h2><p style="margin:0 0 1rem;font-size:.9rem;color:#64748b">${message}</p><button type="button" onclick="location.reload()" style="padding:.5rem 1rem;border:0;border-radius:.5rem;background:#1437cc;color:#fff">Recarregar</button></div>`
}

window.addEventListener('error', (event) => {
  showBootError(event.message || 'Falha inesperada ao iniciar o app.')
})

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason
  const message = reason instanceof Error ? reason.message : String(reason)
  showBootError(message)
})

createRoot(document.getElementById("root")!).render(<App />);

if ('serviceWorker' in navigator && (window.isSecureContext || location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // Opcional: avisar sobre atualizações do SW
      registration.addEventListener?.('updatefound', () => {
        const newWorker = registration.installing
        if (!newWorker) return
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            toast('Atualização disponível', {
              description: 'Recarregue para aplicar a versão mais recente.',
              action: { label: 'Recarregar', onClick: () => location.reload() }
            })
          }
        })
      })
    }).catch(() => {})
  })

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const isSmartphone = /Android.*Mobile|iPhone|Windows Phone|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    if (!isSmartphone) return
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return
      toast('Aplicativo atualizado', {
        description: 'Versão mais recente instalada.',
      })
    })
  })
}

window.addEventListener('beforeinstallprompt', (e: Event) => {
  e.preventDefault()
  const isSmartphone = /Android.*Mobile|iPhone|Windows Phone|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  if (!isSmartphone) return
  // @ts-ignore
  window.deferredPrompt = e
  const pathname = window.location.pathname
  const blocked = pathname.startsWith('/inscricao') || pathname === '/confirmacao' || pathname === '/privacidade'
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session?.user || blocked) return
    toast('Instalar aplicativo', {
      description: 'Toque para instalar no seu dispositivo.',
      action: {
        label: 'Instalar',
        onClick: async () => {
          const prompt = window.deferredPrompt
          if (!prompt) return
          // @ts-ignore
          prompt.prompt()
          // @ts-ignore
          await prompt.userChoice
          window.deferredPrompt = undefined
        }
      }
    })
  })
})

const triggerInstallToastIfAllowed = () => {
  const isSmartphone = /Android.*Mobile|iPhone|Windows Phone|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  if (!isSmartphone || !window.deferredPrompt) return
  const pathname = window.location.pathname
  const blocked = pathname.startsWith('/inscricao') || pathname === '/confirmacao' || pathname === '/privacidade'
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session?.user || blocked) return
    toast('Instalar aplicativo', {
      description: 'Toque para instalar no seu dispositivo.',
      action: {
        label: 'Instalar',
        onClick: async () => {
          const prompt = window.deferredPrompt
          if (!prompt) return
          // @ts-ignore
          prompt.prompt()
          // @ts-ignore
          await prompt.userChoice
          window.deferredPrompt = undefined
        }
      }
    })
  })
}

const _pushState = history.pushState
history.pushState = function (...args) {
  // @ts-ignore
  _pushState.apply(this, args)
  window.dispatchEvent(new Event('routechange'))
}
const _replaceState = history.replaceState
history.replaceState = function (...args) {
  // @ts-ignore
  _replaceState.apply(this, args)
  window.dispatchEvent(new Event('routechange'))
}
window.addEventListener('popstate', () => {
  window.dispatchEvent(new Event('routechange'))
})
window.addEventListener('routechange', () => {
  triggerInstallToastIfAllowed()
})

const isIOS = /iPhone|iPod/.test(navigator.userAgent)
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone
if (isIOS && !isStandalone) {
  setTimeout(() => {
    const pathname = window.location.pathname
    const blocked = pathname.startsWith('/inscricao') || pathname === '/confirmacao' || pathname === '/privacidade'
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user || blocked) return
      toast('Adicionar à Tela Inicial', {
        description: 'No Safari: Compartilhar → Adicionar à Tela de Início.'
      })
    })
  }, 2000)
}
