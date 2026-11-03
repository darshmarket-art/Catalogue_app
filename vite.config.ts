import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { defineConfig } from 'vitest/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(() => {
  return {
    define: { __APP_VERSION__: JSON.stringify(JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')).version) },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    // A bare `vitest run` from the main checkout must not pick up the tests of agent worktrees under .claude/.
    test: { exclude: ['**/node_modules/**', '**/dist/**', '.claude/**'] },
    // The Maison layout chunk is named maison-<hash>, so the server can preload it for Maison stores (renderIndexHtml).
    build: {
      rollupOptions: {
        input: { main: path.resolve(__dirname, 'index.html'), console: path.resolve(__dirname, 'console.html') },
        output: { chunkFileNames: (c: { facadeModuleId: string | null }) => (c.facadeModuleId?.split('\\').join('/').includes('/layouts/maison/index') ? 'assets/maison-[hash].js' : 'assets/[name]-[hash].js') }
      }
    },
    server: {
      // Dev behind a tunnel or preview proxy: VITE_ALLOW_ANY_HOST=true lets Vite answer for any Host header (default: localhost only).
      allowedHosts: process.env.VITE_ALLOW_ANY_HOST === 'true' ? (true as const) : undefined,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
