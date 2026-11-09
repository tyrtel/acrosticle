# Setting up sign-in and the production address

These are the owner steps for Google sign-in. Steps 1–3 are needed to try real sign-in locally; step 4
happens at deploy time. Console screens change over time: if a label differs, look for the closest match.

## 1. Cloudflare: choose the workers.dev subdomain

Your account gets one subdomain on `workers.dev`, shared by all your Workers. With the subdomain
**`tyrtel`**, the app's address will be **https://acrosticle.tyrtel.workers.dev** (the Worker is named
`acrosticle` in `apps/worker/wrangler.jsonc`).

1. Open the Cloudflare dashboard → **Workers & Pages**.
2. Next to **Your subdomain**, choose **Set up** (or **Change**), enter `tyrtel`, and confirm.
   - If you skip this, the first `wrangler deploy` asks you to pick a subdomain instead.
3. Changing it later breaks old links, and Google's redirect URIs would need updating, so pick one you're
   happy to keep. After the first deploy, `*.workers.dev` can return error 523 for about a minute; that
   clears on its own.

## 2. Google Cloud: project and OAuth client

1. Go to <https://console.cloud.google.com/> and create a project named **Acrosticle** (project picker at
   the top → **New project**).
2. Open **Google Auth Platform** (search for it) and click **Get started**:
   - **App name:** Acrosticle
   - **User support email:** your Gmail address
   - **Audience:** **External**
   - **Contact information:** your Gmail address
   - Agree to the policy and **Create**.
3. **Branding** page:
   - **Authorized domains:** add `tyrtel.workers.dev`. (If the console refuses it, skip it for now;
     localhost sign-in works without it, and we'll sort out the production domain at deploy time.)
   - **App home page:** https://acrosticle.tyrtel.workers.dev (optional for now).
4. **Data access:** the default `openid`, `email` and `profile` scopes are all we use. Don't add others.
5. **Audience:** leave the app in **Testing**. Because we only ask for name, email and profile, any Google
   account can sign in and sign-ins don't expire after 7 days, even in Testing.
6. **Clients** → **Create client**:
   - **Application type:** Web application
   - **Name:** Acrosticle web
   - **Authorized redirect URIs** (exactly, no trailing slash):
     - `http://localhost:5173/api/auth/google/callback`
     - `https://acrosticle.tyrtel.workers.dev/api/auth/google/callback`
   - No JavaScript origins are needed.
   - **Create.**
7. **Copy the client ID and client secret now.** Google shows the full secret only once (download the JSON
   if offered) and keep it in a password manager. If it's lost, add a new secret on the client's page.
8. Changes can take from 5 minutes to a few hours to take effect at Google.

## 3. Try sign-in locally

1. Write the local secrets file with the setup helper (it asks for the values; the secret is typed hidden):
   ```
   npm run setup:signin
   ```
   Or, if you downloaded the client's JSON from Google, let it read that file (it also checks the
   redirect URIs registered on the client):
   ```
   npm run setup:signin -- --from-json ~/Downloads/client_secret_XXXX.json
   ```
   This writes `apps/worker/.dev.vars` (git-ignored, readable only by you). You can also copy
   `apps/worker/.dev.vars.example` and fill it in by hand.
2. Restart `npm run dev` (the Worker reads `.dev.vars` only at startup).
3. In a second terminal, check everything:
   ```
   npm run doctor:signin
   ```
   It checks the file, that git ignores it, and, with the dev servers running, that the app sends Google
   the right client ID and redirect URI.
4. Open <http://localhost:5173> and click **Sign in with Google**. Signed in with an allowlisted email,
   **Import a puzzle file** is enabled and **My puzzles** lists the rooms you create.

**If something goes wrong:**

| What you see                                | What to do                                                                                                           |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Google says `redirect_uri_mismatch`         | Add `http://localhost:5173/api/auth/google/callback` exactly to the client's redirect URIs, then wait a few minutes. |
| Google says `invalid_client`                | The client ID or secret is wrong: run `npm run setup:signin` again.                                                  |
| The app says sign-in isn't set up           | Restart `npm run dev` after writing `.dev.vars`.                                                                     |
| Signed in, but Import says it isn't enabled | Your email isn't in `CREATOR_ALLOWLIST`: run `npm run setup:signin` again.                                           |

## 4. At deploy time

Run these from `apps/worker` after `npx wrangler login`:

1. Create the production database and paste the printed `database_id` into `wrangler.jsonc` (replacing the
   all-zeros placeholder):
   ```
   npx wrangler d1 create acrosticle
   ```
2. Apply the schema: `npm run db:migrate:remote`
3. Put the client id (public) in `wrangler.jsonc` → `vars.GOOGLE_CLIENT_ID`.
4. Set the secrets (each command prompts for the value):
   ```
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   npx wrangler secret put CREATOR_ALLOWLIST
   ```
5. Deploy. Serving the web app itself from the Worker (static assets) is set up in the deployment
   milestone.
