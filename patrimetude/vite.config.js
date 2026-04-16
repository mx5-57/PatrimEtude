import { defineConfig } from 'vite';

export default defineConfig({
  // Empêche Vite d'obscurcir les noms de variables (utile pour le debug Tauri)
  build: {
    target: ['es2021', 'chrome100'],
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
});
