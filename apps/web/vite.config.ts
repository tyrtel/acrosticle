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

export default defineConfig({
  customLogger: logger,
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // In dev, forward API + WebSocket traffic to `wrangler dev`.
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.ACROSTICLE_WORKER_PORT ?? '8787'}`,
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
