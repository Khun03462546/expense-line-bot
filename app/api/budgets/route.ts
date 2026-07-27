import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

// API สำหรับจัดการงบประมาณรายเดือน
// GET: ดึงงบประมาณของผู้ใช้ตาม userId
// POST: เพิ่มงบประมาณใหม่ในเดือน/ปีที่ระบุ
export async function GET(req: NextRequest) {
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
  try {
    const body = await req.json();
    const { userId, category, amount, month, year } = body;

    if (!userId || !category || !amount || !month || !year) {
      return Response.json({ error: 'missing required fields' }, { status: 400 });
    }

    const budget = await prisma.budget.create({
      data: {
        userId,
        category,
        amount: Number(amount),
        month: Number(month),
        year: Number(year),
      },
    });

    return Response.json({ budget });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
