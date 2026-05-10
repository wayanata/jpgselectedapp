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

This app uses the [**OpenNext Cloudflare**](https://opennext.js.org/cloudflare) adapter. `npx wrangler deploy` alone fails until `.open-next/` exists — that output is created by the OpenNext build, not by `next build` alone.

1. **Wrangler config** is committed as `wrangler.jsonc` (`main`: `.open-next/worker.js`, `assets`: `.open-next/assets`).
2. In **Workers Builds** (or your CI), set:
   - **Build command:** `npm run build:cloudflare` (runs `prisma generate` + `opennextjs-cloudflare build`).
   - **Deploy command:** `npx wrangler deploy` (or use **`npm run deploy`**, which builds then deploys in one step).
3. Add the same env vars as locally (`AUTH_SECRET`, `DATABASE_URL`, Google OAuth, `NEXTAUTH_URL` / `AUTH_URL` for your production URL) in the dashboard under **Build variables and secrets**.

SQLite (`file:./dev.db`) does not run on Workers. For production on Cloudflare you will need a hosted database (for example **Neon** PostgreSQL, **Turso** with Prisma’s driver adapter, or **D1** with the Prisma D1 adapter) and a matching `DATABASE_URL` / adapter setup.

## Notes

- Drive access is **read-only**. Thumbnails and “Open in Drive” links depend on the customer’s sharing settings and Google’s thumbnail URLs.
- The photographer URL includes a random slug — treat it like a secret capability link.
