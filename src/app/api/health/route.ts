/** Confirms the Worker responds; does not expose configuration. */
export function GET() {
  return Response.json({ ok: true });
}
