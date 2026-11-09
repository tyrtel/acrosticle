import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

describe('HTTP routing', () => {
  it('GET /api/health returns ok', async () => {
    const res = await exports.default.fetch('https://acrosticle.test/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('returns 404 for unknown routes', async () => {
    const res = await exports.default.fetch('https://acrosticle.test/nope');
    expect(res.status).toBe(404);
  });

  it('rejects room requests that are not WebSocket upgrades', async () => {
    const res = await exports.default.fetch('https://acrosticle.test/api/rooms/abc/ws');
    expect(res.status).toBe(426);
  });
});
