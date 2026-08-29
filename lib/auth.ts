const internalApiKey = process.env.INTERNAL_API_KEY;

if (!internalApiKey) {
  throw new Error('INTERNAL_API_KEY is not set');
}

// REST API เหล่านี้ (transactions/budgets/summary) รับแค่ userId เป็น query param
// ไม่มีระบบ login จริง จึงป้องกันด้วย shared secret ผ่าน header ก่อน แทนที่จะเปิดสาธารณะ
export function isAuthorized(req: Request): boolean {
  const provided = req.headers.get('x-api-key');
  return provided === internalApiKey;
}

export function unauthorizedResponse() {
  return Response.json({ error: 'unauthorized' }, { status: 401 });
}
