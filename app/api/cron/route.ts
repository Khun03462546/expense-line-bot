import { runCronTasks } from '@/lib/cron';

// เรียกเป็นระยะโดย Vercel Cron (ดู vercel.json) เพื่อ:
// - ส่งสรุปประจำวันให้ผู้ใช้ที่ตั้งแจ้งเตือนไว้ตรงเวลา
// - สร้างรายการจาก RecurringTransaction ที่ถึงกำหนด แล้วเลื่อน nextRun
//
// ต้องตั้ง CRON_SECRET ไว้ทั้งใน env ของโปรเจกต์และใน Vercel — Vercel จะแนบ
// header `Authorization: Bearer <CRON_SECRET>` มาเองเมื่อยิง cron job
//
// Vercel Hobby plan จำกัด cron ให้รันได้วันละครั้งเท่านั้น (ดู vercel.json:
// รันตอน 13:00 UTC = 20:00 เวลาไทย ตรงกับ DEFAULT_REMINDER_TIME) ผลคือ
// ผู้ใช้ที่ตั้งเวลาแจ้งเตือนช่วงอื่นนอกหน้าต่างนี้จะไม่ได้รับการแจ้งเตือนจริง
// ถ้าต้องการรองรับเวลาที่ผู้ใช้ตั้งเองได้ทุกช่วง ต้องอัปเกรดเป็น Pro plan
// (แล้วปรับ schedule ให้ถี่ขึ้น) หรือใช้ external scheduler (เช่น GitHub
// Actions cron / cron-job.org) ยิงมาที่ endpoint นี้แทน
const CRON_WINDOW_MINUTES = 20;

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const result = await runCronTasks(new Date(), CRON_WINDOW_MINUTES);

  return Response.json({ ok: true, ...result });
}
