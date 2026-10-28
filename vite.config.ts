import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  appType: 'mpa',
  build: {
    // Served from this Mac, so bundle size does not matter.
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        remote: resolve(import.meta.dirname, 'remote.html'),
      },
    },
  },
});
