import type { webhook } from '@line/bot-sdk';
import { prisma } from '@/lib/prisma';
import { lineClient, verifyLineSignature } from '@/lib/line';
import { handleUserMessage } from '@/lib/actions';

// Webhook สำหรับรับข้อความจาก LINE OA
// - ตรวจสอบ signature ก่อนเชื่อ payload ทุกครั้ง
// - สมัครผู้ใช้ใหม่อัตโนมัติเมื่อมีข้อความเข้ามาครั้งแรก
// - แยกข้อความเป็นคำสั่ง/รายรับ-รายจ่ายแล้วตอบกลับผ่าน LINE Messaging API
export async function POST(req: Request) {
  const signature = req.headers.get('x-line-signature');
  const rawBody = await req.text();

  if (!verifyLineSignature(rawBody, signature)) {
    return Response.json({ ok: false, error: 'invalid signature' }, { status: 401 });
  }

  let payload: { events?: webhook.Event[] };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  const events = payload.events ?? [];

  await Promise.all(
    events.map(async (event) => {
      try {
        await processEvent(event);
      } catch (error) {
        console.error('Failed to process LINE event', error);
      }
    }),
  );

  return Response.json({ ok: true });
}

async function processEvent(event: webhook.Event) {
  if (event.type !== 'message' || event.message.type !== 'text') return;
  if (!event.source || event.source.type !== 'user' || !event.source.userId) return;

  const lineUserId = event.source.userId;

  let user = await prisma.user.findUnique({ where: { lineUserId } });
  if (!user) {
    let displayName = 'LINE User';
    try {
      const profile = await lineClient.getProfile(lineUserId);
      displayName = profile.displayName || displayName;
    } catch (error) {
      console.error('Failed to fetch LINE profile', error);
    }
    user = await prisma.user.create({ data: { lineUserId, displayName } });
  }

  const replyText = await handleUserMessage(user.id, event.message.text);

  if (event.replyToken) {
    try {
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: replyText }],
      });
    } catch (error) {
      console.error('Failed to reply via LINE', error);
    }
  }
}
