import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { registerServiceWorker } from './lib/notify';
import './styles/app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Registered after paint: it makes the app installable and lets notification clicks focus an
// open window, but nothing on screen waits for it.
if (import.meta.env.PROD) {
  window.addEventListener('load', () => void registerServiceWorker());
}
