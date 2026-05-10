/**
 * Read `process.env` at call time. Next/Webpack can inline `process.env.KEY` from the **build**
 * host's environment, which breaks Cloudflare when compile has secrets but page-data workers do not.
 */
export function readProcessEnv(name: string): string | undefined {
  const fn = new Function(`
    var v = typeof process !== "undefined" && process.env
      ? process.env[${JSON.stringify(name)}]
      : undefined;
    return typeof v === "string" ? v : undefined;
  `) as () => string | undefined;
  return fn();
}
