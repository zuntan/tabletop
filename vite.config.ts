import { defineConfig } from 'vite';

export default defineConfig(({mode})=>({
  base:mode==='pages'?'./':'/',
  server: { host: '127.0.0.1' },
  build: {
    outDir:mode==='pages'?'dist-pages':'dist',
    target: 'es2022',
    rollupOptions: { output: { banner: '/*! Tabletop: third-party code is mechanically bundled/minified. Copyrights, licenses and source availability: licenses/THIRD_PARTY_NOTICES.txt in this distribution */' } },
  },
}));
