import { createRoot } from 'react-dom/client'
import './i18n'
import './index.css'
import App from './App.tsx'
import { applyDarkMode, getInitialDarkMode } from './hooks/useDarkMode'

applyDarkMode(getInitialDarkMode())

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Ignore registration failures in unsupported environments.
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <App />,
)
