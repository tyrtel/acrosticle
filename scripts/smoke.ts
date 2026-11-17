/**
 * Checks that a deployed site works end to end.
 *
 *   npm run smoke                      # https://acrosticle.tyrtel.workers.dev
 *   npm run smoke -- http://localhost:8787
 *   npm run smoke -- https://crosswordicle.tyrtel.workers.dev --crossword
 *
 */
const args = process.argv.slice(2);
const CROSSWORD = args.includes('--crossword');
const BASE = (
  args.find((arg) => !arg.startsWith('--')) ?? 'https://acrosticle.tyrtel.workers.dev'
).replace(/\/$/, '');
/** Crosswordicle signs in through Acrosticle, whose callback serves both sites. */
const SIGN_IN_ORIGIN = CROSSWORD ? 'https://acrosticle.tyrtel.workers.dev' : BASE;
const CALLBACK = `${SIGN_IN_ORIGIN}/api/auth/google/callback`;
const SAMPLE = CROSSWORD ? 'gridicles-mini-1' : 'diplo-crostic-37';
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
    let res = await get('/api/auth/google', { redirect: 'manual' });
    if (CROSSWORD) {
      // First a hand-off to Acrosticle, saying to come back here.
      const handOff = new URL(res.headers.get('location') ?? '', BASE);
      assert(
        handOff.origin === SIGN_IN_ORIGIN && handOff.searchParams.get('returnOrigin') === BASE,
        `handed off to ${handOff.toString()}`,
      );
      res = await fetch(handOff, { redirect: 'manual' });
    }
    const location = res.headers.get('location') ?? '';
    assert(
      location.startsWith('https://accounts.google.com/'),
      `redirected to ${location || 'nowhere'}`,
    );
    const redirectUri = new URL(location).searchParams.get('redirect_uri');
    assert(redirectUri === CALLBACK, `redirect_uri is ${redirectUri ?? 'missing'}`);
  });

  await check('starting a sample room requires an invited account', async () => {
    const res = await get('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: BASE },
      body: JSON.stringify({ sample: SAMPLE }),
    });
    assert(res.status === 401, `answered ${res.status}`);
  });

  await check('importing a puzzle requires sign-in', async () => {
    const res = await get('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: BASE },
      body: JSON.stringify({ puzzle: { grid: { columns: 1, rows: ['1A'] }, clues: [] } }),
    });
    assert(res.status === 401, `answered ${res.status}`);
  });

  // Rooms need an account now, so these use a room that doesn't exist: they still go all the
  // way to a Durable Object, which is what can stall.
  const missing = 'SmokeTestNoSuchRoom000';
  await check('room lookups are fast (no stalls)', async () => {
    const times: number[] = [];
    for (let i = 0; i < 10; i++) {
      const started = performance.now();
      const res = await get(`/api/rooms/${missing}`);
      times.push(performance.now() - started);
      assert(res.status === 404, `lookup answered ${res.status}`);
    }
    const slowest = Math.max(...times);
    assert(slowest < 3_000, `slowest of 10 lookups took ${Math.round(slowest)} ms`);
    const median = [...times].sort((a, b) => a - b)[5] ?? 0;
    return `median ${Math.round(median)} ms, slowest ${Math.round(slowest)} ms`;
  });

  await check('joining a room that does not exist is refused', async () => {
    const url = `${BASE.replace(/^http/, 'ws')}/api/rooms/${missing}/ws`;
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);
      const timer = setTimeout(() => reject(new Error('no answer within 10s')), 10_000);
      ws.onopen = () => reject(new Error('the socket opened'));
      ws.onerror = () => {
        clearTimeout(timer);
        resolve();
      };
    });
  });

  console.log('');
  if (failures > 0) {
    console.log(`✖ ${failures} check${failures === 1 ? '' : 's'} failed.`);
    process.exit(1);
  }
  console.log(`✔ All good. Live at ${BASE}`);
}

void main();
