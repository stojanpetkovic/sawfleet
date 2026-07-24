export const prerender = false;

// Public, unauthenticated healthcheck for the hosting platform (Railway).
// Deliberately does no DB/auth work — just confirms the server is up.
export async function GET() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
