export async function POST() {
  return Response.json({ ok: true });
}
console.log('Secret exists:', !!process.env.LINE_CHANNEL_SECRET);
console.log('Secret length:', process.env.LINE_CHANNEL_SECRET?.length)