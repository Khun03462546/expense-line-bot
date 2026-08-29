import { prisma } from './prisma';
import { parseExpenseText } from './parser';
import { getSummaryForRange, type SummaryRange } from './summary';

const formatBaht = (value: number) => value.toLocaleString('th-TH', { maximumFractionDigits: 2 });

async function handleSearch(userId: string, text: string): Promise<string> {
  const keyword = text.replace(/^ค้นหา\s*/i, '').trim();

  if (!keyword) {
    return 'กรุณาระบุคำค้นหา เช่น "ค้นหา ข้าว" หรือ "ค้นหา เดือนที่แล้ว"';
  }

  const isLastMonth = keyword.includes('เดือนที่แล้ว');

  const transactions = isLastMonth
    ? await prisma.transaction.findMany({
        where: {
          userId,
          transactionDate: {
            gte: (() => {
              const now = new Date();
              return new Date(now.getFullYear(), now.getMonth() - 1, 1);
            })(),
            lte: (() => {
              const now = new Date();
              return new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
            })(),
          },
        },
        orderBy: { transactionDate: 'desc' },
        take: 20,
      })
    : await prisma.transaction.findMany({
        where: {
          userId,
          OR: [
            { description: { contains: keyword, mode: 'insensitive' } },
            { category: { contains: keyword, mode: 'insensitive' } },
          ],
        },
        orderBy: { transactionDate: 'desc' },
        take: 20,
      });

  if (transactions.length === 0) {
    return isLastMonth ? 'ไม่พบรายการในเดือนที่แล้ว' : `ไม่พบรายการที่ตรงกับ "${keyword}"`;
  }

  const lines = transactions.map((tx) => {
    const sign = tx.type === 'income' ? '+' : '-';
    const date = tx.transactionDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
    return `${sign}${formatBaht(Number(tx.amount))} • ${tx.description ?? tx.category ?? 'รายการ'} (${date})`;
  });

  const total = transactions.reduce(
    (sum, tx) => sum + (tx.type === 'income' ? Number(tx.amount) : -Number(tx.amount)),
    0,
  );

  return `🔍 พบ ${transactions.length} รายการ\n\n${lines.join('\n')}\n\nรวม: ${formatBaht(total)} บาท`;
}

async function handleEditLast(userId: string, text: string): Promise<string> {
  const match = text.match(/^แก้ล่าสุด\s+(\d+(?:\.\d+)?)/i);
  if (!match) {
    return 'ตัวอย่าง: แก้ล่าสุด 65';
  }

  const latest = await prisma.transaction.findFirst({
    where: { userId },
    orderBy: { transactionDate: 'desc' },
  });

  if (!latest) {
    return 'ยังไม่มีรายการให้แก้ไข';
  }

  const newAmount = Number(match[1]);
  await prisma.transaction.update({
    where: { id: latest.id },
    data: { amount: newAmount },
  });

  return `แก้รายการล่าสุด (${latest.description ?? 'รายการ'}) เป็น ${formatBaht(newAmount)} บาทแล้ว`;
}

async function handleDeleteLast(userId: string): Promise<string> {
  const latest = await prisma.transaction.findFirst({
    where: { userId },
    orderBy: { transactionDate: 'desc' },
  });

  if (!latest) {
    return 'ยังไม่มีรายการให้ลบ';
  }

  await prisma.transaction.delete({ where: { id: latest.id } });

  return `ลบรายการล่าสุด (${latest.description ?? 'รายการ'} ${formatBaht(Number(latest.amount))} บาท) แล้ว`;
}

async function handleBudget(userId: string, text: string): Promise<string> {
  const match = text.match(/^ตั้งงบ\s*([ก-๙a-z\s]*?)\s*(\d+(?:\.\d+)?)\s*$/i);
  if (!match) {
    return 'ตัวอย่าง: ตั้งงบอาหาร 5000';
  }

  const category = match[1].trim() || 'other';
  const amount = Number(match[2]);
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const existing = await prisma.budget.findFirst({ where: { userId, category, month, year } });

  if (existing) {
    await prisma.budget.update({ where: { id: existing.id }, data: { amount } });
  } else {
    await prisma.budget.create({ data: { userId, category, amount, month, year } });
  }

  return `ตั้งงบ ${category} เดือนนี้เป็น ${formatBaht(amount)} บาทแล้ว`;
}

async function handleReminder(userId: string, text: string): Promise<string> {
  const timeMatch = text.match(/^แจ้งเตือน\s+(\d{1,2}:\d{2})/i);
  const isEnable = /^เปิดแจ้งเตือน/i.test(text);
  const isDisable = /^ปิดแจ้งเตือน/i.test(text);

  if (!timeMatch && !isEnable && !isDisable) {
    return 'ตัวอย่าง: แจ้งเตือน 20:00 / เปิดแจ้งเตือน / ปิดแจ้งเตือน';
  }

  const existing = await prisma.reminder.findFirst({ where: { userId, type: 'daily-summary' } });
  const time = timeMatch?.[1] ?? existing?.time ?? process.env.DEFAULT_REMINDER_TIME ?? '20:00';
  const enabled = !isDisable;

  if (existing) {
    await prisma.reminder.update({ where: { id: existing.id }, data: { time, enabled } });
  } else {
    await prisma.reminder.create({ data: { userId, type: 'daily-summary', time, enabled } });
  }

  if (isDisable) return 'ปิดแจ้งเตือนแล้ว';
  if (timeMatch) return `ตั้งเวลาแจ้งเตือนเป็น ${time} แล้ว`;
  return `เปิดแจ้งเตือนแล้ว (เวลา ${time})`;
}

function rangeFromText(text: string): SummaryRange {
  if (text.includes('วันนี้')) return 'today';
  if (text.includes('เมื่อวาน')) return 'yesterday';
  if (text.includes('อาทิตย์นี้')) return 'week';
  if (text.includes('ปีนี้')) return 'year';
  return 'month';
}

async function handleExpense(userId: string, text: string): Promise<string | null> {
  const parsed = parseExpenseText(text);
  if (!parsed) return null;

  await prisma.transaction.create({
    data: {
      userId,
      type: parsed.type,
      amount: parsed.amount,
      description: parsed.description,
      category: parsed.category,
      transactionDate: new Date(),
    },
  });

  const label = parsed.type === 'income' ? 'รายรับ' : 'รายจ่าย';
  return `✅ บันทึก${label} ${formatBaht(parsed.amount)} บาท\n${parsed.description} • ${parsed.category}`;
}

const HELP_TEXT =
  'พิมพ์รายการ เช่น "จ่ายค่าข้าว 55 บาท" หรือดูสรุปด้วย "สรุปเดือนนี้"\nคำสั่งอื่น: ค้นหา / แก้ล่าสุด / ลบล่าสุด / ตั้งงบ / แจ้งเตือน';

// รับข้อความจากผู้ใช้ 1 ข้อความ แล้ว route ไปยัง action ที่เกี่ยวข้อง คืนค่าเป็นข้อความสำหรับตอบกลับ LINE
export async function handleUserMessage(userId: string, rawText: string): Promise<string> {
  const text = rawText.trim();
  if (!text) return HELP_TEXT;

  if (/^ค้นหา/i.test(text)) return handleSearch(userId, text);
  if (/^แก้ล่าสุด/i.test(text)) return handleEditLast(userId, text);
  if (/^ลบล่าสุด/i.test(text)) return handleDeleteLast(userId);
  if (/^ตั้งงบ/i.test(text)) return handleBudget(userId, text);
  if (/^(แจ้งเตือน|เปิดแจ้งเตือน|ปิดแจ้งเตือน)/i.test(text)) return handleReminder(userId, text);

  if (/^(สรุป|วันนี้|เมื่อวาน|อาทิตย์นี้|เดือนนี้|ปีนี้)/i.test(text)) {
    const summary = await getSummaryForRange(userId, rangeFromText(text));
    return summary.message;
  }

  const expenseReply = await handleExpense(userId, text);
  if (expenseReply) return expenseReply;

  return HELP_TEXT;
}
