export const prerender = false;

export async function GET() {
  const jurisdictions = [
    "Broward County",
    "City of Boca Raton",
    "City of Coral Gables",
    "City of Doral",
    "City of Fort Lauderdale",
    "City of Hallandale Beach",
    "City of Miami",
    "City of Miami Gardens",
    "City of Naples",
    "City of Oakland Park",
    "Collier County",
    "Miami-Dade County",
    "Palm Beach County",
    "Town of Jupiter",
    "Village of Wellington"
  ];
  
  return new Response(JSON.stringify({ ok: true, jurisdictions }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
