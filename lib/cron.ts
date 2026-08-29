import { addDays, addMonths, addWeeks } from 'date-fns';
import { prisma } from './prisma';
import { lineClient } from './line';
import { getSummaryForRange } from './summary';

// แอปนี้ตั้งเป้าผู้ใช้ในโซนเวลาเดียว (Asia/Bangkok, UTC+7 ไม่มี DST)
// จึงคำนวณเวลาแบบ offset คงที่แทนการพึ่ง IANA timezone library
const BANGKOK_OFFSET_MINUTES = 7 * 60;

function bangkokMinutesOfDay(date: Date): number {
  const bangkok = new Date(date.getTime() + BANGKOK_OFFSET_MINUTES * 60 * 1000);
  return bangkok.getUTCHours() * 60 + bangkok.getUTCMinutes();
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return ((h % 24) + 24) % 24 * 60 + ((m % 60) + 60) % 60;
}

// เช็คว่าเวลาที่ตั้งไว้ (reminder.time) ตกอยู่ใน window [now - windowMinutes, now] หรือไม่
// ต้องใช้ window เพราะ cron ไม่ได้รันทุกนาที การเทียบ HH:mm ตรงเป๊ะจะพลาดได้ง่าย
async function runDueReminders(now: Date, windowMinutes: number) {
  const nowMinutes = bangkokMinutesOfDay(now);
  const windowStart = nowMinutes - windowMinutes;

  const reminders = await prisma.reminder.findMany({
    where: { enabled: true, type: 'daily-summary' },
    include: { user: true },
  });

  let sent = 0;
  for (const reminder of reminders) {
    const target = parseTimeToMinutes(reminder.time);
    if (target <= windowStart || target > nowMinutes) continue;

    const summary = await getSummaryForRange(reminder.userId, 'today');
    try {
      await lineClient.pushMessage({
        to: reminder.user.lineUserId,
        messages: [{ type: 'text', text: `🔔 สรุปประจำวัน\n\n${summary.message}` }],
      });
      sent += 1;
    } catch (error) {
      console.error(`Failed to push reminder to user ${reminder.userId}`, error);
    }
  }

  return { checked: reminders.length, sent };
}

const advanceByFrequency: Record<string, (date: Date) => Date> = {
  daily: (date) => addDays(date, 1),
  weekly: (date) => addWeeks(date, 1),
  monthly: (date) => addMonths(date, 1),
};

async function runDueRecurringTransactions(now: Date) {
  const due = await prisma.recurringTransaction.findMany({
    where: { enabled: true, nextRun: { lte: now } },
  });

  let created = 0;
  for (const item of due) {
    const advance = advanceByFrequency[item.frequency.toLowerCase()] ?? advanceByFrequency.monthly;

    await prisma.$transaction([
      prisma.transaction.create({
        data: {
          userId: item.userId,
          type: item.type,
          amount: item.amount,
          description: item.description,
          category: item.category,
          transactionDate: now,
        },
      }),
      prisma.recurringTransaction.update({
        where: { id: item.id },
        data: { nextRun: advance(item.nextRun) },
      }),
    ]);

    created += 1;
  }

  return { checked: due.length, created };
}

export async function runCronTasks(now: Date, windowMinutes: number) {
  const [reminders, recurring] = await Promise.all([
    runDueReminders(now, windowMinutes),
    runDueRecurringTransactions(now),
  ]);

  return { reminders, recurring };
}
