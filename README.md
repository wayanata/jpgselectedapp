# Drive selections

Web app for photography workflows: **photographers** sign in with Google once, attach a **Drive folder** per job, and share a **pick link** with clients (no Google login for clients). Clients browse that folder and select images. **Photographers** open a private link (`/p/…`) to review picks and sort them into workflow folders. Data lives in **PostgreSQL** (not in Drive — files are not moved).

## Setup

1. **Node.js 20+** recommended.

2. **Database (PostgreSQL)** — required for local dev and Cloudflare.

   - Create a free project at [Neon](https://neon.tech) (or any Postgres host).
   - Copy the connection string. For Neon it usually looks like:  
     `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`

3. **Google Cloud**
   - Create a project (or pick one).
   - Enable **Google Drive API**: APIs & Services → Library → “Google Drive API” → Enable.
   - APIs & Services → Credentials → Create credentials → **OAuth client ID** → Application type **Web application**.
   - Authorized redirect URI (local dev):  
     `http://localhost:3000/api/auth/callback/google`
   - Copy the client ID and client secret.

4. **Environment** — copy `env.example` to `.env` and fill in:

   - `DATABASE_URL` — your Postgres URL (`?sslmode=require` for Neon).
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (or `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`).
   - `AUTH_SECRET` — run `openssl rand -base64 32`.
   - `AUTH_USE_PRISMA_ADAPTER=1` — required for Postgres-backed Auth.js sessions (local + Worker); omit in CI so `next build` never opens the DB for auth.
   - `AUTH_URL` / `NEXTAUTH_URL` — e.g. `http://localhost:3000` for local development.

5. **Install and migrate**

   ```bash
   npm install
   npx prisma migrate deploy
   ```

6. **Run**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Photographers use **Studio** (`/studio`) → Google sign-in → create a job with a Drive folder link → share the **client pick** URL (`/pick/…`).

## Deploy to Cloudflare Workers

This app uses the [**OpenNext Cloudflare**](https://opennext.js.org/cloudflare) adapter. The `.open-next/` folder is created by **`npm run build:cloudflare`** (OpenNext), not by `next build` alone.

### Workers Builds settings (pick one)

**Important:** Plain **`npx wrangler deploy`** often fails on OpenNext projects: Wrangler detects OpenNext and jumps straight to **`opennextjs-cloudflare deploy`** **without** running `wrangler.jsonc`’s `build` step, which triggers *Could not find compiled Open Next config* when `.open-next/` was never built.

Use **`npm run deploy:full`** to build then upload, or run **`npm run build:cloudflare`** in one CI step and **`npm run deploy`** in the next (deploy only runs **`npx opennextjs-cloudflare deploy`**). Do **not** set the deploy command to **`npx wrangler deploy`** alone.

If you compose your own shell command for Cloudflare, always invoke the CLI with **`npx`** (e.g. **`npx opennextjs-cloudflare deploy`**). A bare **`opennextjs-cloudflare`** is not on `PATH` in Workers Builds.

**Option A — recommended (two steps in Cloudflare)**

| Step | Command |
|------|---------|
| Install | `npm ci` |
| Build | **`npm run build:cloudflare`** |
| Deploy | **`npx prisma migrate deploy && npm run deploy`** |

Run **`prisma migrate deploy`** once per new migration (same `DATABASE_URL` as the Worker).

**Option B — one command from a clean clone**

```bash
npm run deploy:cf
```

(`deploy:cf` runs `npm ci`, **`build:cloudflare`**, then **`deploy`**.)

**Advanced:** **`npm run deploy:wrangler:full`** builds then **`wrangler deploy`**; **`npm run deploy:wrangler`** uploads only (expects `.open-next/` already built).

**Worker size (Free tier):** Cloudflare counts the Worker **gzipped** bundle against a **3 MiB** limit. This repo drops unused Prisma **`query_engine_bg.wasm`** after OpenNext (`scripts/prune-prisma-worker-wasm.mjs`) and avoids the **`googleapis`** client in favor of small **`fetch`** calls to Drive so the bundle stays under that cap.

1. **Wrangler config** is committed as `wrangler.jsonc` (`main`: `.open-next/worker.js`, `assets`: `.open-next/assets`). It sets **`find_additional_modules`** and a **`CompiledWasm`** rule so Prisma’s **`query_compiler_bg.wasm`** is uploaded with the Worker (see [Wrangler: find additional modules](https://developers.cloudflare.com/workers/wrangler/configuration/#find-additional-modules)).
2. **Variables and secrets** on the Worker: `DATABASE_URL` (Postgres), `AUTH_USE_PRISMA_ADAPTER=1`, `AUTH_SECRET`, `AUTH_URL`, Google OAuth IDs/secrets, etc.  
   If the **Workers build** step still fails on `/api/auth`, ensure `AUTH_USE_PRISMA_ADAPTER` is **not** duplicated into **Build environment variables** (runtime-only is fine). The app reads these via runtime `process.env` so compile-time inlining does not force the Prisma adapter during `next build`.

Prisma uses **`engineType = "client"`** plus **`@prisma/adapter-neon`** with **HTTP** (`PrismaNeonHTTP`) so the Worker bundle does not need the native query-engine `.node` binary (see `src/lib/prisma.ts`). **`next.config.ts`** lists **`serverExternalPackages`** for `@prisma/client` / `.prisma/client` / `@prisma/adapter-neon` so OpenNext can bundle the **workerd** build of Prisma (see [OpenNext DB how-to](https://opennext.js.org/cloudflare/howtos/db)). Use a Neon connection string; a **pooler** hostname (`-pooler` in the host) is recommended for serverless.

**Cloudflare Pages asset limit:** each uploaded file must be **≤ 25 MiB**. Large production source maps under `.next/` used to break deploys; this repo builds with **`next build --webpack`** (no production source maps) and runs **`scripts/strip-sourcemaps.mjs`** after OpenNext to delete any leftover `*.map` files.

## Notes

- Drive access is **read-only**. Thumbnails and “Open in Drive” links depend on sharing settings and Google’s thumbnail URLs.
- The photographer and pick URLs include random segments — treat them like secret capability links.
