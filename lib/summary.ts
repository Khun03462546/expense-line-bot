import { prisma } from './prisma';

// Utility สำหรับคำนวณสรุปรายรับ-รายจ่ายตามช่วงเวลา
export type SummaryRange = 'today' | 'yesterday' | 'week' | 'month' | 'year';

export async function getSummaryForRange(userId: string, range: SummaryRange) {
  const now = new Date();
  let start: Date;
  let end: Date = new Date(now);

  if (range === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  } else if (range === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
    end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
  } else if (range === 'week') {
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start = new Date(now);
    start.setDate(now.getDate() + diff);
    start.setHours(0, 0, 0, 0);
    end = new Date(now);
    end.setHours(23, 59, 59, 999);
  } else if (range === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  } else {
    start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  }

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      transactionDate: {
        gte: start,
        lte: end,
      },
    },
    orderBy: { transactionDate: 'desc' },
  });

  const income = transactions.filter((tx) => tx.type === 'income').reduce((sum, tx) => sum + Number(tx.amount), 0);
  const expense = transactions.filter((tx) => tx.type === 'expense').reduce((sum, tx) => sum + Number(tx.amount), 0);

  const formatCurrency = (value: number) => new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(value);

  return {
    range,
    start,
    end,
    income,
    expense,
    balance: income - expense,
    transactions,
    message: `📊 ${getRangeLabel(range)}\n\nรายรับ\n${formatCurrency(income)}\n\nรายจ่าย\n${formatCurrency(expense)}\n\nคงเหลือ\n${formatCurrency(income - expense)}`,
  };
}

function getRangeLabel(range: SummaryRange) {
  switch (range) {
    case 'today':
      return 'วันนี้';
    case 'yesterday':
      return 'เมื่อวาน';
    case 'week':
      return 'อาทิตย์นี้';
    case 'month':
      return 'เดือนนี้';
    case 'year':
      return 'ปีนี้';
    default:
      return 'สรุป';
  }
}
