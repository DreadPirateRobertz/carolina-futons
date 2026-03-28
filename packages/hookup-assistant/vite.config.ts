import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import mkcert from 'vite-plugin-mkcert';

<<<<<<< HEAD
export default defineConfig({
  plugins: [react(), mkcert()],
  server: { https: true, port: 3000 },
  test: {
    environment: 'jsdom',
    globals: true,
=======
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    mkcert(), // Enables HTTPS for local dev (required by Wix Custom Apps iframe)
  ],
  server: {
    port: 5173,
    https: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
>>>>>>> origin/polecat/chrome/CF-3avw@mmvdgu2t
  },
});
