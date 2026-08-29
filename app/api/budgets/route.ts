import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAuthorized, unauthorizedResponse } from '@/lib/auth';
import { createBudgetSchema } from '@/lib/validation';

// API สำหรับจัดการงบประมาณรายเดือน
// GET: ดึงงบประมาณของผู้ใช้ตาม userId
// POST: เพิ่มงบประมาณใหม่ในเดือน/ปีที่ระบุ
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return unauthorizedResponse();
  }

  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) {
    return Response.json({ error: 'userId is required' }, { status: 400 });
  }

  const budgets = await prisma.budget.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return Response.json({ budgets });
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

  const parsed = createBudgetSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const budget = await prisma.budget.create({ data: parsed.data });

  return Response.json({ budget });
}
