import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { registerServiceWorker } from './lib/notify';
import './styles/app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);

// Registered after paint: it makes the app installable and lets notification clicks focus an
// open window, but nothing on screen waits for it.
if (import.meta.env.PROD) {
  window.addEventListener('load', () => void registerServiceWorker());
}
