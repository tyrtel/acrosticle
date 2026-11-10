/**
 * Checks that a deployed Acrosticle works end to end.
 *
 *   npm run smoke                      # https://acrosticle.tyrtel.workers.dev
 *   npm run smoke -- http://localhost:8787
 *
 * Note: it creates one sample room each run (tiny, and anonymous).
 */
const BASE = (process.argv[2] ?? 'https://acrosticle.tyrtel.workers.dev').replace(/\/$/, '');
const CALLBACK = `${BASE}/api/auth/google/callback`;
let failures = 0;

async function check(name: string, test: () => Promise<string | void>): Promise<void> {
  try {
    const detail = await test();
    console.log(`  ✔ ${name}${detail ? ` (${detail})` : ''}`);
  } catch (error) {
    failures += 1;
    console.log(`  ✖ ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/** Retries briefly: a brand-new workers.dev site can answer 523 for about a minute. */
async function get(path: string, init?: RequestInit): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${BASE}${path}`, init);
    if (res.status !== 523 || attempt === 12) return res;
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
}

async function main(): Promise<void> {
  console.log(`Smoke-testing ${BASE}\n`);

  await check('API is up', async () => {
    const res = await get('/api/health');
    assert(res.ok, `/api/health answered ${res.status}`);
  });

  await check('serves the web app', async () => {
    const res = await get('/');
    const html = await res.text();
    assert(res.ok && html.includes('<div id="root">'), `/ answered ${res.status} without the app`);
  });

  await check('room links load the app (client-side routing)', async () => {
    const res = await get('/r/AAAAAAAAAAAAAAAAAAAAAA');
    assert(res.ok && (await res.text()).includes('<div id="root">'), `answered ${res.status}`);
  });

  await check('sign-in is configured', async () => {
    const me = (await (await get('/api/me')).json()) as { signInConfigured?: boolean };
    assert(me.signInConfigured, 'the Worker is missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
  });

  await check('"Sign in with Google" sends the production callback', async () => {
    const res = await get('/api/auth/google', { redirect: 'manual' });
    const location = res.headers.get('location') ?? '';
    assert(
      location.startsWith('https://accounts.google.com/'),
      `redirected to ${location || 'nowhere'}`,
    );
    const redirectUri = new URL(location).searchParams.get('redirect_uri');
    assert(redirectUri === CALLBACK, `redirect_uri is ${redirectUri ?? 'missing'}`);
  });

  let roomId = '';
  await check('anyone can start a sample room', async () => {
    const res = await get('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: BASE },
      body: JSON.stringify({ sample: 'diplo-crostic-37' }),
    });
    const body = await res.text();
    assert(res.status === 201, `answered ${res.status}: ${body}`);
    ({ roomId } = JSON.parse(body) as { roomId: string });
    return roomId;
  });

  await check('room lookups are fast (no stalls)', async () => {
    assert(roomId, 'no room was created');
    const times: number[] = [];
    for (let i = 0; i < 10; i++) {
      const started = performance.now();
      const res = await get(`/api/rooms/${roomId}`);
      times.push(performance.now() - started);
      assert(res.ok, `lookup answered ${res.status}`);
    }
    const slowest = Math.max(...times);
    assert(slowest < 3_000, `slowest of 10 lookups took ${Math.round(slowest)} ms`);
    const median = [...times].sort((a, b) => a - b)[5] ?? 0;
    return `median ${Math.round(median)} ms, slowest ${Math.round(slowest)} ms`;
  });

  await check('importing a puzzle requires sign-in', async () => {
    const res = await get('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: BASE },
      body: JSON.stringify({ puzzle: { grid: { columns: 1, rows: ['1A'] }, clues: [] } }),
    });
    assert(res.status === 401, `answered ${res.status}`);
  });

  await check('joining the room over WebSocket gets the puzzle', async () => {
    assert(roomId, 'no room was created');
    const url = `${BASE.replace(/^http/, 'ws')}/api/rooms/${roomId}/ws`;
    const snapshot = await new Promise<{ puzzle?: { title?: string } }>((resolve, reject) => {
      const ws = new WebSocket(url);
      const timer = setTimeout(() => reject(new Error('no snapshot within 10s')), 10_000);
      ws.onopen = () => ws.send(JSON.stringify({ type: 'join', name: 'Smoke test' }));
      ws.onmessage = (event) => {
        const message = JSON.parse(String(event.data)) as {
          type: string;
          puzzle?: { title?: string };
        };
        if (message.type === 'snapshot') {
          clearTimeout(timer);
          ws.close();
          resolve(message);
        }
      };
      ws.onerror = () => reject(new Error('WebSocket error'));
    });
    return snapshot.puzzle?.title;
  });

  console.log('');
  if (failures > 0) {
    console.log(`✖ ${failures} check${failures === 1 ? '' : 's'} failed.`);
    process.exit(1);
  }
  console.log(`✔ All good. Live at ${BASE}`);
}

void main();
