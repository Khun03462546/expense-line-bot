import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

// API สำหรับจัดการรายการธุรกรรม
// GET: ดึงรายการรายรับรายจ่ายของผู้ใช้ตาม userId
// POST: เพิ่มรายการใหม่ลงฐานข้อมูล
export async function GET(req: NextRequest) {
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
  try {
    const body = await req.json();
    const { userId, type, amount, description, category, note, transactionDate } = body;

    if (!userId || !type || !amount || !transactionDate) {
      return Response.json({ error: 'missing required fields' }, { status: 400 });
    }

    const transaction = await prisma.transaction.create({
      data: {
        userId,
        type,
        amount: Number(amount),
        description,
        category,
        note,
        transactionDate: new Date(transactionDate),
      },
    });

    return Response.json({ transaction });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
