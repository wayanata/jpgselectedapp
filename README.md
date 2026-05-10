# Drive selections

Web app for photography workflows: **customers** sign in with Google, browse **Google Drive**, and select images. **Photographers** open a private link (`/p/…`) to review picks and sort them into workflow folders (unsorted vs custom buckets). Folder labels are stored in this app only — they do not move files inside Google Drive.

## Setup

1. **Node.js 20+** recommended.

2. **Google Cloud**
   - Create a project (or pick one).
   - Enable **Google Drive API**: APIs & Services → Library → “Google Drive API” → Enable.
   - APIs & Services → Credentials → Create credentials → **OAuth client ID** → Application type **Web application**.
   - Authorized redirect URI (local dev):  
     `http://localhost:3000/api/auth/callback/google`
   - Copy the client ID and client secret.

3. **Environment** — copy `env.example` to `.env` and fill in:

   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (or use `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`; Auth.js recognizes those names too).
   - `AUTH_SECRET` — run `openssl rand -base64 32`.
   - `DATABASE_URL` — default `file:./dev.db` matches the SQLite file next to `prisma/schema.prisma`.
   - `NEXTAUTH_URL` — e.g. `http://localhost:3000` for local development.

4. **Install and database**

   ```bash
   npm install
   npx prisma migrate dev
   ```

5. **Run**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Customers use **I’m selecting photos** → Google sign-in. After saving selections, copy the **Photographer link** and send it to your editor.

## Deploy to Cloudflare Workers

This app uses the [**OpenNext Cloudflare**](https://opennext.js.org/cloudflare) adapter. The `.open-next/` folder is created by **`npm run build:cloudflare`** (OpenNext), not by `next build` alone.

**`wrangler.jsonc` includes `build.command`** so a plain **`npx wrangler deploy`** (after **`npm ci`** / **`npm install`**) runs **`npm run build:cloudflare` first**, then uploads the Worker and assets. Without dependencies installed, deploy cannot build.

If an older log showed only `npx wrangler deploy` and *Could not detect a directory containing static files*, that was from **before** this `build` block existed, or from an environment that never ran `npm install`.

### Workers Builds settings (pick one)

**Option A — separate build + deploy (recommended)**

| Step | Command |
|------|---------|
| Install / build | `npm ci && npm run build:cloudflare` |
| Deploy | `npx wrangler deploy` |

**Option B — single command** (use if your project only runs **one** custom command before/instead of a separate build step)

```bash
npm run deploy:cf
```

That script runs `npm ci`, then `build:cloudflare`, then `wrangler deploy`. Equivalent one-liner:

```bash
npm ci && npm run build:cloudflare && npx wrangler deploy
```

1. **Wrangler config** is committed as `wrangler.jsonc` (`main`: `.open-next/worker.js`, `assets`: `.open-next/assets`).
2. Add the same env vars as locally (`AUTH_SECRET`, `DATABASE_URL`, Google OAuth, `NEXTAUTH_URL` / `AUTH_URL` for your production URL) in the dashboard under **Build variables and secrets**.

SQLite (`file:./dev.db`) does not run on Workers. For production on Cloudflare you will need a hosted database (for example **Neon** PostgreSQL, **Turso** with Prisma’s driver adapter, or **D1** with the Prisma D1 adapter) and a matching `DATABASE_URL` / adapter setup.

**Cloudflare Pages asset limit:** each uploaded file must be **≤ 25 MiB**. Large production source maps under `.next/` used to break deploys; this repo builds with **`next build --webpack`** (no production source maps) and runs **`scripts/strip-sourcemaps.mjs`** after OpenNext to delete any leftover `*.map` files.

## Notes

- Drive access is **read-only**. Thumbnails and “Open in Drive” links depend on the customer’s sharing settings and Google’s thumbnail URLs.
- The photographer URL includes a random slug — treat it like a secret capability link.
