import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAuthorized, unauthorizedResponse } from '@/lib/auth';
import { createTransactionSchema } from '@/lib/validation';

// API สำหรับจัดการรายการธุรกรรม
// GET: ดึงรายการรายรับรายจ่ายของผู้ใช้ตาม userId
// POST: เพิ่มรายการใหม่ลงฐานข้อมูล
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return unauthorizedResponse();
  }

  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) {
    return Response.json({ error: 'userId is required' }, { status: 400 });
  }

  const transactions = await prisma.transaction.findMany({
    where: { userId },
    orderBy: { transactionDate: 'desc' },
  });

  return Response.json({ transactions });
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return unauthorizedResponse();
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 });
  }

  const parsed = createTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const transaction = await prisma.transaction.create({ data: parsed.data });

  return Response.json({ transaction });
}
