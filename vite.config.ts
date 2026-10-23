import { defineConfig } from 'vite';

export default defineConfig({
  server: { host: '127.0.0.1' },
  build: {
    target: 'es2022',
    rollupOptions: { output: { banner: '/*! Tabletop: third-party code is mechanically bundled/minified. Copyrights, licenses and source availability: /licenses/THIRD_PARTY_NOTICES.txt */' } },
  },
});
