# ADR 0003: Google sign-in in our own Worker

- **Status:** Accepted (implemented in M4, 2026-11-09)
- **Date:** 2026-11-09

## Context

Creating puzzle rooms must require sign-in (and later, image parsing costs money per puzzle), while
joining a room by link stays anonymous. The owner chose Google accounts, an email allowlist for creators,
free anonymous rooms for the built-in sample, and a "My puzzles" list.

## Decision

- **OAuth 2.0 authorization code flow with PKCE and `state`, implemented directly in the Worker** against
  Google's documented endpoints (`apps/worker/src/google.ts`, `authRoutes.ts`). It is two HTTP calls, so
  no library: fewer dependencies, and the security checks stay visible and tested.
- **ID token claims are checked (issuer, audience, expiry, verified email), but not the signature.** The
  token comes straight from Google's token endpoint over TLS in exchange for our client secret; OpenID
  Connect Core §3.1.3.7 allows TLS validation in place of the signature check in that case.
- **Server sessions in Cloudflare D1**: an opaque 32-byte random token in an `HttpOnly; Secure;
SameSite=Lax` cookie, with only its SHA-256 hash stored. 30 days, extended when `/api/me` sees a
  session with less than 15 days left. Sign-out deletes the row.
- **D1 also holds users and the room list**, because "rooms I created" spans rooms and can't come from
  per-room Durable Object storage.
- **The allowlist (`CREATOR_ALLOWLIST`) and the client secret are Cloudflare secrets**, so neither lands
  in the public repo. The client id is public and lives in `wrangler.jsonc`.
- **`APP_ORIGIN` is configured, not inferred**, so the redirect URI sent to Google is the address users
  see (localhost:5173 in dev, behind Vite's proxy) and can't be influenced by request headers.
- **Sample rooms are created from the server's own copy** of the sample, so the anonymous path never
  accepts a puzzle from the client.
- POSTs from another `Origin` are rejected, on top of `SameSite=Lax`.

## Alternatives considered

- **Hosted auth (Clerk, Auth0):** quickest, but adds a vendor, possible cost, and moves user accounts out
  of our hands.
- **Better Auth / Lucia-style frameworks:** capable, but more machinery than one OAuth provider needs.
- **Google Identity Services (One Tap, browser-side ID tokens):** needs Google's script on our pages and
  signature verification with Google's keys; the server-side redirect flow avoids both.
- **Cloudflare Access:** built for internal apps, not public sign-in.
- **Stateless signed cookies (JWT):** can't be revoked on sign-out without a deny list; D1 sessions are
  simple and revocable.

## Consequences

- One D1 database to create and migrate per environment (`wrangler d1 create`, `migrations apply`).
- Adding another provider later means another small module next to `google.ts`.
- Google OAuth client setup and redirect URIs are an owner task (see `docs/setup/google-sign-in.md`).
