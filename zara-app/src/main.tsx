import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './auth.css';
import App from './App.tsx';
import AuthGate from './AuthGate.tsx';

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate>
      <App />
    </AuthGate>
  </StrictMode>,
);
