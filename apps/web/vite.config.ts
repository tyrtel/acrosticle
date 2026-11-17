import react from '@vitejs/plugin-react';
import { createLogger } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * Vite's proxy logs a stack trace every time a browser tab closes a room
 * WebSocket (ECONNRESET / EPIPE). That's normal, so drop just those messages.
 */
const logger = createLogger();
const logError = logger.error.bind(logger);
logger.error = (message, options) => {
  const details = `${message} ${options?.error?.message ?? ''}`;
  if (/ws proxy/.test(details) && /ECONNRESET|EPIPE/.test(details)) return;
  logError(message, options);
};

/**
 * One app, two sites: VITE_SITE=crossword builds Crosswordicle (into dist-crossword, on port
 * 5175 in dev); anything else builds Acrosticle (into dist, on port 5173). See src/lib/site.ts.
 */
const crossword = process.env.VITE_SITE === 'crossword';
process.env.VITE_SITE_NAME = crossword ? 'Crosswordicle' : 'Acrosticle';

export default defineConfig({
  customLogger: logger,
  build: { outDir: crossword ? 'dist-crossword' : 'dist' },
  plugins: [react()],
  server: {
    port: crossword ? 5175 : 5173,
    strictPort: true,
    // In dev, forward API + WebSocket traffic to `wrangler dev`.
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.ACROSTICLE_WORKER_PORT ?? (crossword ? '8789' : '8787')}`,
        ws: true,
      },
    },
  },
  test: {
    name: 'web',
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
