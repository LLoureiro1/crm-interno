import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Desregistra qualquer Service Worker legado que possa interferir em cache
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((regs) => {
      regs.forEach((r) => r.unregister());
    })
    .catch(() => {});
}

createRoot(document.getElementById("root")!).render(<App />);
