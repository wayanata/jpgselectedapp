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

### Workers Builds settings (pick one)

**Important:** Plain **`npx wrangler deploy`** often fails on OpenNext projects: Wrangler detects OpenNext and jumps straight to **`opennextjs-cloudflare deploy`** **without** running `wrangler.jsonc`’s `build` step, which triggers *Could not find compiled Open Next config* when `.open-next/` was never built.

Use **`npm run deploy`** (build first, then **`opennextjs-cloudflare deploy`**). Do **not** set the deploy command to **`npx wrangler deploy`** alone.

**Option A — recommended (two steps in Cloudflare)**

| Step | Command |
|------|---------|
| Install | `npm ci` |
| Deploy | **`npm run deploy`** |

**Option B — one command from a clean clone**

```bash
npm run deploy:cf
```

(`deploy:cf` runs `npm ci` then `npm run deploy`.)

**Advanced:** `npm run deploy:wrangler` runs the build then **`wrangler deploy`** (same artifact layout; Wrangler may still delegate to OpenNext under the hood after the build exists).

1. **Wrangler config** is committed as `wrangler.jsonc` (`main`: `.open-next/worker.js`, `assets`: `.open-next/assets`).
2. Add the same env vars as locally (`AUTH_SECRET`, `DATABASE_URL`, Google OAuth, `NEXTAUTH_URL` / `AUTH_URL` for your production URL) in the dashboard under **Build variables and secrets**.

SQLite (`file:./dev.db`) does not run on Workers. For production on Cloudflare you will need a hosted database (for example **Neon** PostgreSQL, **Turso** with Prisma’s driver adapter, or **D1** with the Prisma D1 adapter) and a matching `DATABASE_URL` / adapter setup.

**Cloudflare Pages asset limit:** each uploaded file must be **≤ 25 MiB**. Large production source maps under `.next/` used to break deploys; this repo builds with **`next build --webpack`** (no production source maps) and runs **`scripts/strip-sourcemaps.mjs`** after OpenNext to delete any leftover `*.map` files.

## Notes

- Drive access is **read-only**. Thumbnails and “Open in Drive” links depend on the customer’s sharing settings and Google’s thumbnail URLs.
- The photographer URL includes a random slug — treat it like a secret capability link.
