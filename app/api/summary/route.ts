import { NextRequest } from 'next/server';
import { getSummaryForRange } from '@/lib/summary';

// API สำหรับสรุปข้อมูลตามช่วงเวลา
// รองรับคำสั่งเช่น วันนี้ เมื่อวาน อาทิตย์นี้ เดือนนี้ ปีนี้
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  const query = req.nextUrl.searchParams.get('q') || '';

  if (!userId) {
    return Response.json({ error: 'userId is required' }, { status: 400 });
  }

  const lower = query.toLowerCase();
  let range: 'today' | 'yesterday' | 'week' | 'month' | 'year' = 'month';

  if (lower.includes('วันนี้')) {
    range = 'today';
  } else if (lower.includes('เมื่อวาน')) {
    range = 'yesterday';
  } else if (lower.includes('อาทิตย์นี้')) {
    range = 'week';
  } else if (lower.includes('เดือนนี้')) {
    range = 'month';
  } else if (lower.includes('ปีนี้')) {
    range = 'year';
  }

  const summary = await getSummaryForRange(userId, range);
  return Response.json({
    summary,
    message: summary.message,
  });
}
