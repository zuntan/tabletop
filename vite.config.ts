import { defineConfig } from 'vite';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function commitHash() {
  const root = fileURLToPath(new URL('.', import.meta.url));
  if (!existsSync(new URL('.git', import.meta.url))) return '';
  try {
    const hash = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return /^[0-9a-f]{7,40}$/.test(hash) ? hash : '';
  } catch { return ''; }
}

export default defineConfig(({mode})=>({
  define: { __TABLETOP_COMMIT__: JSON.stringify(commitHash()) },
  base:mode==='pages'?'./':'/',
  server: { host: '127.0.0.1' },
  build: {
    outDir:mode==='pages'?'dist-pages':'dist',
    target: 'es2022',
    rollupOptions: { output: { banner: '/*! Tabletop: third-party code is mechanically bundled/minified. Copyrights, licenses and source availability: licenses/THIRD_PARTY_NOTICES.txt in this distribution */' } },
  },
}));
