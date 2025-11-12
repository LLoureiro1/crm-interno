import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { toast } from '@/components/ui/sonner'

declare global {
  interface Window {
    deferredPrompt?: any
  }
}

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
    toast('Aplicativo atualizado', {
      description: 'Versão mais recente instalada.',
    })
  })
}

window.addEventListener('beforeinstallprompt', (e: Event) => {
  e.preventDefault()
  const isSmartphone = /Android.*Mobile|iPhone|Windows Phone|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  if (!isSmartphone) return
  // @ts-ignore - use the actual type em navegadores compatíveis
  window.deferredPrompt = e
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

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone

if (isIOS && !isStandalone) {
  setTimeout(() => {
    toast('Adicionar à Tela Inicial', {
      description: 'No Safari: Compartilhar → Adicionar à Tela de Início.'
    })
  }, 2000)
}
