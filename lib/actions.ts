import { prisma } from './prisma';
import { parseExpenseText, categorize } from './parser';
import { getSummaryForRange, type SummaryRange } from './summary';
import { advanceRecurringDate, FREQUENCY_LABELS, type RecurringFrequency } from './recurring';

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

  const rawCategory = match[1].trim();
  // แปลงเป็น category เดียวกับที่ธุรกรรมใช้ (food/shopping/transport/bill/other)
  // ไม่งั้นงบที่ตั้งด้วยคำไทยอิสระจะไม่ตรงกับ category ของรายการที่บันทึกไว้เลย
  const category = rawCategory ? categorize(rawCategory) : 'other';
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

  return `ตั้งงบ ${rawCategory || category} เดือนนี้เป็น ${formatBaht(amount)} บาทแล้ว`;
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

// เตือนเมื่อยอดใช้จ่ายหมวดนี้ในเดือนนี้ใกล้/เกินงบที่ตั้งไว้ (>=80% เตือน, >=100% เกินงบ)
async function getBudgetWarning(userId: string, category: string, now: Date): Promise<string | null> {
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const budget = await prisma.budget.findFirst({ where: { userId, category, month, year } });
  if (!budget) return null;

  const { _sum } = await prisma.transaction.aggregate({
    where: {
      userId,
      category,
      type: 'expense',
      transactionDate: { gte: new Date(year, month - 1, 1), lte: new Date(year, month, 0, 23, 59, 59, 999) },
    },
    _sum: { amount: true },
  });

  const spent = Number(_sum.amount ?? 0);
  const budgetAmount = Number(budget.amount);
  const ratio = budgetAmount > 0 ? spent / budgetAmount : 0;

  if (ratio >= 1) {
    return `⚠️ งบ ${category} เดือนนี้เกินแล้ว (${formatBaht(spent)}/${formatBaht(budgetAmount)} บาท)`;
  }
  if (ratio >= 0.8) {
    return `⚠️ งบ ${category} เดือนนี้ใกล้เต็มแล้ว (${formatBaht(spent)}/${formatBaht(budgetAmount)} บาท)`;
  }
  return null;
}

async function handleExpense(userId: string, text: string): Promise<string | null> {
  const parsed = parseExpenseText(text);
  if (!parsed) return null;

  const now = new Date();
  await prisma.transaction.create({
    data: {
      userId,
      type: parsed.type,
      amount: parsed.amount,
      description: parsed.description,
      category: parsed.category,
      transactionDate: now,
    },
  });

  const label = parsed.type === 'income' ? 'รายรับ' : 'รายจ่าย';
  let reply = `✅ บันทึก${label} ${formatBaht(parsed.amount)} บาท\n${parsed.description} • ${parsed.category}`;

  if (parsed.type === 'expense') {
    const warning = await getBudgetWarning(userId, parsed.category, now);
    if (warning) reply += `\n\n${warning}`;
  }

  return reply;
}

async function handleRecurringCreate(userId: string, text: string): Promise<string> {
  const match = text.match(/^ตั้งรายการซ้ำ\s+([ก-๙a-z0-9\s]+?)\s+(\d+(?:\.\d+)?)\s+ทุก(วัน|สัปดาห์|เดือน)\s*$/i);
  if (!match) {
    return 'ตัวอย่าง: ตั้งรายการซ้ำ ค่าเช่า 5000 ทุกเดือน (รองรับ ทุกวัน / ทุกสัปดาห์ / ทุกเดือน)';
  }

  const description = match[1].trim();
  const amount = Number(match[2]);
  const frequency: RecurringFrequency =
    match[3] === 'วัน' ? 'daily' : match[3] === 'สัปดาห์' ? 'weekly' : 'monthly';

  const nextRun = advanceRecurringDate(new Date(), frequency);

  await prisma.recurringTransaction.create({
    data: {
      userId,
      type: 'expense',
      description,
      amount,
      category: categorize(description),
      frequency,
      nextRun,
      enabled: true,
    },
  });

  const nextRunLabel = nextRun.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  return `🔁 ตั้งรายการซ้ำ "${description}" ${formatBaht(amount)} บาท ${FREQUENCY_LABELS[frequency]}แล้ว\nครั้งถัดไป: ${nextRunLabel}`;
}

async function handleRecurringList(userId: string): Promise<string> {
  const items = await prisma.recurringTransaction.findMany({
    where: { userId, enabled: true },
    orderBy: { nextRun: 'asc' },
  });

  if (items.length === 0) {
    return 'ยังไม่มีรายการซ้ำที่ตั้งไว้ ตัวอย่าง: ตั้งรายการซ้ำ ค่าเช่า 5000 ทุกเดือน';
  }

  const lines = items.map((item) => {
    const nextRunLabel = item.nextRun.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
    const frequencyLabel = FREQUENCY_LABELS[item.frequency as RecurringFrequency] ?? item.frequency;
    return `• ${item.description ?? 'รายการ'} ${formatBaht(Number(item.amount))} บาท ${frequencyLabel} (ถัดไป ${nextRunLabel})`;
  });

  return `🔁 รายการซ้ำที่ตั้งไว้\n\n${lines.join('\n')}`;
}

async function handleRecurringCancel(userId: string, text: string): Promise<string> {
  const keyword = text.replace(/^ยกเลิกรายการซ้ำ\s*/i, '').trim();
  if (!keyword) {
    return 'ตัวอย่าง: ยกเลิกรายการซ้ำ ค่าเช่า';
  }

  const match = await prisma.recurringTransaction.findFirst({
    where: { userId, enabled: true, description: { contains: keyword, mode: 'insensitive' } },
  });

  if (!match) {
    return `ไม่พบรายการซ้ำที่ตรงกับ "${keyword}"`;
  }

  await prisma.recurringTransaction.update({ where: { id: match.id }, data: { enabled: false } });

  return `ยกเลิกรายการซ้ำ "${match.description}" แล้ว`;
}

const HELP_TEXT =
  'พิมพ์รายการ เช่น "จ่ายค่าข้าว 55 บาท" หรือดูสรุปด้วย "สรุปเดือนนี้"\nคำสั่งอื่น: ค้นหา / แก้ล่าสุด / ลบล่าสุด / ตั้งงบ / แจ้งเตือน / ตั้งรายการซ้ำ / รายการซ้ำ / ยกเลิกรายการซ้ำ';

// รับข้อความจากผู้ใช้ 1 ข้อความ แล้ว route ไปยัง action ที่เกี่ยวข้อง คืนค่าเป็นข้อความสำหรับตอบกลับ LINE
export async function handleUserMessage(userId: string, rawText: string): Promise<string> {
  const text = rawText.trim();
  if (!text) return HELP_TEXT;

  if (/^ค้นหา/i.test(text)) return handleSearch(userId, text);
  if (/^แก้ล่าสุด/i.test(text)) return handleEditLast(userId, text);
  if (/^ลบล่าสุด/i.test(text)) return handleDeleteLast(userId);
  if (/^ตั้งงบ/i.test(text)) return handleBudget(userId, text);
  if (/^(แจ้งเตือน|เปิดแจ้งเตือน|ปิดแจ้งเตือน)/i.test(text)) return handleReminder(userId, text);
  if (/^ตั้งรายการซ้ำ/i.test(text)) return handleRecurringCreate(userId, text);
  if (/^ยกเลิกรายการซ้ำ/i.test(text)) return handleRecurringCancel(userId, text);
  if (/^รายการซ้ำ/i.test(text)) return handleRecurringList(userId);

  if (/^(สรุป|วันนี้|เมื่อวาน|อาทิตย์นี้|เดือนนี้|ปีนี้)/i.test(text)) {
    const summary = await getSummaryForRange(userId, rangeFromText(text));
    return summary.message;
  }

  const expenseReply = await handleExpense(userId, text);
  if (expenseReply) return expenseReply;

  return HELP_TEXT;
}
