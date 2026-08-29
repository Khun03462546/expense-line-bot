import { messagingApi, validateSignature } from '@line/bot-sdk';

const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const channelSecret = process.env.LINE_CHANNEL_SECRET;

if (!channelAccessToken) {
  throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not set');
}

if (!channelSecret) {
  throw new Error('LINE_CHANNEL_SECRET is not set');
}

const verifiedChannelSecret: string = channelSecret;

export const lineClient = new messagingApi.MessagingApiClient({ channelAccessToken });

// เทียบ signature จาก header `x-line-signature` กับ raw body โดยใช้ channel secret
// ต้องเช็คก่อนเชื่อ payload ทุกครั้ง ไม่งั้นใครก็ยิง POST ปลอมแทนผู้ใช้อื่นได้
export function verifyLineSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  return validateSignature(rawBody, verifiedChannelSecret, signature);
}
