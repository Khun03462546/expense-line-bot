import { runCronTasks } from '@/lib/cron';

// เรียกเป็นระยะโดย Vercel Cron (ดู vercel.json) เพื่อ:
// - ส่งสรุปประจำวันให้ผู้ใช้ที่ตั้งแจ้งเตือนไว้ตรงเวลา
// - สร้างรายการจาก RecurringTransaction ที่ถึงกำหนด แล้วเลื่อน nextRun
//
// ต้องตั้ง CRON_SECRET ไว้ทั้งใน env ของโปรเจกต์และใน Vercel — Vercel จะแนบ
// header `Authorization: Bearer <CRON_SECRET>` มาเองเมื่อยิง cron job
const CRON_WINDOW_MINUTES = 15;

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const result = await runCronTasks(new Date(), CRON_WINDOW_MINUTES);

  return Response.json({ ok: true, ...result });
}
