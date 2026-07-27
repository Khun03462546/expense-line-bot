export async function GET() {
  return Response.json({ transactions: [] });
}

export async function POST() {
  return Response.json({ ok: true });
}
