import type { webhook } from '@line/bot-sdk';
import { prisma } from '@/lib/prisma';
import { lineClient, verifyLineSignature } from '@/lib/line';
import { handleUserMessage, getWelcomeReply } from '@/lib/actions';
import type { BotReply } from '@/lib/flex';

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
  if (event.type === 'follow') return processFollowEvent(event);
  if (event.type === 'message') return processMessageEvent(event);
}

async function processFollowEvent(event: webhook.FollowEvent) {
  await ensureUser(event.source);
  await reply(event.replyToken, getWelcomeReply());
}

async function processMessageEvent(event: webhook.MessageEvent) {
  if (event.message.type !== 'text') return;

  const user = await ensureUser(event.source);
  if (!user) return;

  const botReply = await handleUserMessage(user.id, event.message.text);
  await reply(event.replyToken, botReply);
}

async function ensureUser(source: webhook.Event['source']) {
  if (!source || source.type !== 'user' || !source.userId) return null;
  const lineUserId = source.userId;

  const existing = await prisma.user.findUnique({ where: { lineUserId } });
  if (existing) return existing;

  let displayName = 'LINE User';
  try {
    const profile = await lineClient.getProfile(lineUserId);
    displayName = profile.displayName || displayName;
  } catch (error) {
    console.error('Failed to fetch LINE profile', error);
  }
  return prisma.user.create({ data: { lineUserId, displayName } });
}

async function reply(replyToken: string | undefined, message: BotReply) {
  if (!replyToken) return;
  try {
    await lineClient.replyMessage({ replyToken, messages: [message] });
  } catch (error) {
    console.error('Failed to reply via LINE', error);
  }
}
