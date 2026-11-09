const ROOM_WS_PATH = /^\/api\/rooms\/([A-Za-z0-9_-]{1,64})\/ws$/;

/** Top-level HTTP routing. Keep handlers thin; real logic lives in the room or in core. */
export async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === 'GET' && url.pathname === '/api/health') {
    return Response.json({ status: 'ok' });
  }

  const roomMatch = ROOM_WS_PATH.exec(url.pathname);
  if (roomMatch) {
    const roomId = roomMatch[1]!;
    const stub = env.PUZZLE_ROOM.getByName(roomId);
    return stub.fetch(request);
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}
