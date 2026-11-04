import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { buildCommit } from './scripts/build-info.mjs';

export default defineConfig(({mode})=>({
  define: { __TABLETOP_COMMIT__: JSON.stringify(buildCommit(fileURLToPath(new URL('.', import.meta.url)))) },
  base:mode==='pages'?'./':'/',
  server: { host: '127.0.0.1' },
  build: {
    outDir:mode==='pages'?'dist-pages':'dist',
    target: 'es2022',
    rollupOptions: { output: { banner: '/*! Tabletop: third-party code is mechanically bundled/minified. Copyrights, licenses and source availability: licenses/THIRD_PARTY_NOTICES.txt in this distribution */' } },
  },
}));
