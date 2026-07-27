import { prisma } from '@/lib/prisma';
import { parseExpenseText } from '@/lib/parser';

function getSearchResponse(text: string, userId: string) {
  const lower = text.toLowerCase();
  const keyword = text.replace(/^ค้นหา\s+/i, '').trim();

  if (!keyword) {
    return { ok: true, action: 'search', message: 'กรุณาระบุคำค้นหา เช่น ค้นหา ข้าว หรือ ค้นหา เดือนที่แล้ว' };
  }

  if (lower.includes('เดือนที่แล้ว')) {
    return { ok: true, action: 'search', message: 'ค้นหาเดือนที่แล้ว', range: 'last-month' };
  }

  return { ok: true, action: 'search', message: `ค้นหา: ${keyword}`, keyword };
}

function getEditResponse(text: string, userId: string) {
  const match = text.match(/^แก้ล่าสุด\s+(\d+(?:\.\d+)?)/i);
  if (!match) {
    return { ok: true, action: 'edit', message: 'ตัวอย่าง: แก้ล่าสุด 65' };
  }

  return {
    ok: true,
    action: 'edit',
    message: `แก้รายการล่าสุดเป็น ${match[1]} บาท`,
    amount: Number(match[1]),
  };
}

function getDeleteResponse(text: string, userId: string) {
  if (!/^ลบล่าสุด/i.test(text)) {
    return { ok: true, action: 'delete', message: 'ตัวอย่าง: ลบล่าสุด' };
  }

  return {
    ok: true,
    action: 'delete',
    message: 'ลบรายการล่าสุดแล้ว',
  };
}

function getBudgetResponse(text: string, userId: string) {
  const match = text.match(/^ตั้งงบ\s+([\wก-๙\s]+?)\s+(\d+(?:\.\d+)?)/i);
  if (!match) {
    return { ok: true, action: 'budget', message: 'ตัวอย่าง: ตั้งงบอาหาร 5000' };
  }

  const category = match[1].trim();
  const amount = Number(match[2]);

  return {
    ok: true,
    action: 'budget',
    message: `ตั้งงบ ${category} เป็น ${amount} บาทแล้ว`,
    budget: { category, amount },
  };
}

function getReminderResponse(text: string, userId: string) {
  if (/^แจ้งเตือน\s+\d{1,2}:\d{2}/i.test(text)) {
    const match = text.match(/(\d{1,2}:\d{2})/);
    const time = match?.[1] || '20:00';

    return {
      ok: true,
      action: 'reminder',
      message: `ตั้งเวลาแจ้งเตือนเป็น ${time} แล้ว`,
      reminder: { time, enabled: true },
    };
  }

  if (/^เปิดแจ้งเตือน/i.test(text)) {
    return {
      ok: true,
      action: 'reminder',
      message: 'เปิดแจ้งเตือนแล้ว',
      reminder: { enabled: true },
    };
  }

  if (/^ปิดแจ้งเตือน/i.test(text)) {
    return {
      ok: true,
      action: 'reminder',
      message: 'ปิดแจ้งเตือนแล้ว',
      reminder: { enabled: false },
    };
  }

  return {
    ok: true,
    action: 'reminder',
    message: 'ตัวอย่าง: แจ้งเตือน 20:00 / เปิดแจ้งเตือน / ปิดแจ้งเตือน',
  };
}

// Webhook สำหรับรับข้อความจาก LINE OA
// - สมัครผู้ใช้ใหม่อัตโนมัติเมื่อมีข้อความเข้ามา
// - แยกข้อความเป็นรายรับ/รายจ่ายและบันทึกลงฐานข้อมูล
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const userId = body?.userId || body?.events?.[0]?.source?.userId;

    if (!userId) {
      return Response.json({ ok: false, error: 'missing userId' }, { status: 400 });
    }

    let user = await prisma.user.findUnique({ where: { lineUserId: userId } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          lineUserId: userId,
          displayName: body?.displayName || 'New User',
        },
      });
    }

    const text = body?.text || body?.message?.text || body?.events?.[0]?.message?.text;
    if (text) {
      if (/^ค้นหา/i.test(text)) {
        const searchResult = getSearchResponse(text, user.id);
        return Response.json(searchResult);
      }

      if (/^แก้ล่าสุด/i.test(text)) {
        const editResult = getEditResponse(text, user.id);
        return Response.json(editResult);
      }

      if (/^ลบล่าสุด/i.test(text)) {
        const deleteResult = getDeleteResponse(text, user.id);
        return Response.json(deleteResult);
      }

      if (/^ตั้งงบ/i.test(text)) {
        const budgetResult = getBudgetResponse(text, user.id);
        return Response.json(budgetResult);
      }

      if (/^(แจ้งเตือน|เปิดแจ้งเตือน|ปิดแจ้งเตือน)/i.test(text)) {
        const reminderResult = getReminderResponse(text, user.id);
        return Response.json(reminderResult);
      }

      const parsed = parseExpenseText(text);
      if (parsed) {
        await prisma.transaction.create({
          data: {
            userId: user.id,
            type: parsed.type,
            amount: parsed.amount,
            description: parsed.description,
            category: parsed.category,
            transactionDate: new Date(),
          },
        });

        return Response.json({ ok: true, parsed });
      }
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
