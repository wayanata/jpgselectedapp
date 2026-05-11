/**
 * Read `process.env` at call time using a **dynamic** key so Next/Webpack does not inline
 * `process.env.KEY` from the build host (which breaks Cloudflare when secrets exist only at runtime).
 *
 * Uses `Reflect.get` (not `new Function`) so restricted Workers / edge runtimes do not reject eval-like code.
 */
export function readProcessEnv(name: string): string | undefined {
  try {
    if (typeof process === "undefined" || !process.env) return undefined;
    const v = Reflect.get(process.env, name);
    return typeof v === "string" ? v : undefined;
  } catch {
    return undefined;
  }
}
