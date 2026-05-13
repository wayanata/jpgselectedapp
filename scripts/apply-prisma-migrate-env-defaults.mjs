/**
 * Prisma `schema.prisma` uses `directUrl = env("DIRECT_URL")`. `prisma migrate deploy`
 * requires that variable to exist even though `prisma generate` does not.
 *
 * When operators only configure `DATABASE_URL` (e.g. Cloudflare Workers Builds),
 * default `DIRECT_URL` to the same value so migrate can run. For Neon with a pooled
 * `DATABASE_URL`, set `DIRECT_URL` explicitly to the non-pooler URL for best results.
 */
export function applyPrismaMigrateEnvDefaults() {
  const db = String(process.env.DATABASE_URL ?? "").trim();
  const direct = String(process.env.DIRECT_URL ?? "").trim();
  if (!direct && db) {
    process.env.DIRECT_URL = db;
    console.error(
      "[prisma migrate] DIRECT_URL unset; using DATABASE_URL for Prisma directUrl (set DIRECT_URL to Neon’s direct host if migrate misbehaves with the pooler)."
    );
  }
}
