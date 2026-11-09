/** Reads one cookie from a request, or null. */
export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq !== -1 && part.slice(0, eq).trim() === name) {
      try {
        return decodeURIComponent(part.slice(eq + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * A Set-Cookie value. Always HttpOnly (no script access), Secure (HTTPS only;
 * browsers also accept it on http://localhost) and SameSite=Lax (not sent on
 * cross-site POSTs, which blocks cross-site request forgery).
 */
export function serializeCookie(
  name: string,
  value: string,
  { maxAgeSeconds, path = '/' }: { maxAgeSeconds: number; path?: string },
): string {
  return `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=${path}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearCookie(name: string, path = '/'): string {
  return serializeCookie(name, '', { maxAgeSeconds: 0, path });
}
