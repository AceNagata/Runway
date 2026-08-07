import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: '127.0.0.1' },
  // The local host for the built app. Bound to the loopback address only.
  preview: { port: 4173, host: '127.0.0.1' },
});
