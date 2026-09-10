# 💸 Expense LINE Bot

บอท LINE สำหรับบันทึกรายรับ-รายจ่ายด้วยข้อความภาษาไทยธรรมดา พร้อมตั้งงบประมาณ, ตั้งเตือนสรุปประจำวัน, และรายการที่ตัดซ้ำอัตโนมัติ — ไม่ต้องเปิดแอปแยก แชทกับ LINE Official Account ได้เลย

สร้างด้วย [Next.js](https://nextjs.org) (App Router) + [Prisma](https://www.prisma.io) + PostgreSQL ([Supabase](https://supabase.com)) และ [LINE Messaging API](https://developers.line.biz/en/docs/messaging-api/)

---

## ✨ ฟีเจอร์

พิมพ์คุยกับบอทตรง ๆ เป็นภาษาไทย ไม่ต้องจำ syntax ซับซ้อน:

| หมวด | ตัวอย่างคำสั่ง | คำอธิบาย |
| --- | --- | --- |
| 📝 บันทึกรายการ | `จ่ายค่าข้าว 55 บาท`, `ได้เงินเดือน 20000 บาท` | บันทึกรายรับ/รายจ่าย พร้อมจัดหมวดหมู่อัตโนมัติ |
| 📊 ดูสรุป | `วันนี้`, `เมื่อวาน`, `อาทิตย์นี้`, `เดือนนี้`, `ปีนี้` | สรุปรายรับ-รายจ่าย-คงเหลือของช่วงเวลานั้น |
| 🔍 ค้นหา & แก้ไข | `ค้นหา ข้าว`, `แก้ล่าสุด 65`, `ลบล่าสุด` | ค้นหารายการย้อนหลัง แก้ไข/ลบรายการล่าสุด |
| 🎯 งบประมาณ | `ตั้งงบอาหาร 5000`, `ดูงบ`, `ลบงบอาหาร` | ตั้งงบรายหมวดต่อเดือน พร้อมเตือนอัตโนมัติเมื่อใช้ใกล้/เกินงบ (≥80% / ≥100%) |
| 🔔 แจ้งเตือน | `แจ้งเตือน 20:00`, `เปิดแจ้งเตือน`, `ปิดแจ้งเตือน` | ตั้งเวลาให้บอทส่งสรุปรายวันอัตโนมัติ |
| 🔁 รายการซ้ำ | `ตั้งรายการซ้ำ ค่าเช่า 5000 ทุกเดือน`, `รายการซ้ำ`, `ยกเลิกรายการซ้ำ ค่าเช่า` | ตั้งรายการที่เกิดซ้ำ (ทุกวัน/สัปดาห์/เดือน) ให้บันทึกให้อัตโนมัติ |

เมื่อมีคนเพิ่มบอทเป็นเพื่อน หรือพิมพ์คำสั่งที่บอทไม่รู้จัก บอทจะตอบกลับเป็น **Flex Message แบบ Carousel** สรุปคำสั่งทั้งหมดให้เลื่อนดูได้ทันที

## 🛠️ Tech Stack

- **Framework:** Next.js 16 (App Router, Route Handlers)
- **Database:** PostgreSQL ผ่าน [Prisma ORM](https://www.prisma.io)
- **Messaging:** [@line/bot-sdk](https://github.com/line/line-bot-sdk-nodejs) — Webhook + Flex Message
- **Validation:** Zod
- **Language:** TypeScript

## 🚀 เริ่มต้นใช้งาน (Local Development)

### 1. ติดตั้ง dependencies

```bash
npm install
```

### 2. ตั้งค่า environment variables

สร้างไฟล์ `.env` ที่ root ของโปรเจกต์:

```bash
# ฐานข้อมูล PostgreSQL
DATABASE_URL="postgresql://user:password@host:5432/dbname"

# LINE Messaging API (จาก LINE Developers Console)
LINE_CHANNEL_ACCESS_TOKEN=""
LINE_CHANNEL_SECRET=""

# ป้องกัน REST API ภายใน (transactions/budgets/summary) ด้วย shared secret
INTERNAL_API_KEY=""

# ป้องกัน endpoint /api/cron ที่ Vercel Cron เรียกเข้ามา
CRON_SECRET=""

# ค่าเริ่มต้น
DEFAULT_REMINDER_TIME="20:00"
DEFAULT_TIMEZONE="Asia/Bangkok"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 3. สร้างตารางในฐานข้อมูล

```bash
npx prisma migrate deploy
npx prisma generate
```

### 4. รันเซิร์ฟเวอร์

```bash
npm run dev
```

เปิด [http://localhost:3000](http://localhost:3000) — แต่ตัวบอทจริงจะทำงานผ่าน LINE Webhook ที่ `POST /api/webhook` ดังนั้นต้อง expose local server ออกอินเทอร์เน็ต (เช่นด้วย [ngrok](https://ngrok.com)) แล้วตั้ง Webhook URL ใน LINE Developers Console ให้ชี้มาที่ `https://<your-url>/api/webhook`

## 🗂️ โครงสร้างโปรเจกต์

```
app/
  api/
    webhook/       # LINE webhook หลัก — รับข้อความ/follow event แล้ว route ไปยังคำสั่งที่เกี่ยวข้อง
    cron/          # Vercel Cron เรียกทุกวัน — ส่งสรุปประจำวัน + สร้างรายการซ้ำที่ถึงกำหนด
    transactions/  # REST API: รายการรายรับ-รายจ่าย (ป้องกันด้วย INTERNAL_API_KEY)
    budgets/       # REST API: งบประมาณ
    summary/       # REST API: สรุปตามช่วงเวลา
    db/            # Health check การเชื่อมต่อฐานข้อมูล
lib/
  actions.ts       # ตัว router คำสั่งแชททั้งหมด + logic ของแต่ละคำสั่ง
  flex.ts          # ตัวสร้าง LINE Flex Message ทุกแบบที่บอทตอบกลับ
  parser.ts        # แปลงข้อความอิสระเป็นรายการรายรับ/รายจ่าย + จัดหมวดหมู่
  summary.ts       # คำนวณสรุปยอดตามช่วงเวลา
  recurring.ts     # logic รายการซ้ำ (คำนวณวันที่ครั้งถัดไป)
  cron.ts          # งานที่รันตาม cron (แจ้งเตือนรายวัน, สร้างรายการซ้ำ)
  line.ts          # LINE client + ตรวจสอบ signature ของ webhook
  auth.ts          # ป้องกัน REST API ภายในด้วย shared secret
  validation.ts     # Zod schema สำหรับ REST API
prisma/
  schema.prisma    # โมเดลฐานข้อมูล (User, Transaction, Budget, Reminder, RecurringTransaction)
  migrations/      # ประวัติ migration ของฐานข้อมูล
```

## ⏰ Cron Job

`vercel.json` ตั้งให้ Vercel เรียก `GET /api/cron` วันละครั้ง (13:00 UTC = 20:00 เวลาไทย) เพื่อ:

- ส่งสรุปรายวันให้ผู้ใช้ที่ตั้งแจ้งเตือนไว้ตรงช่วงเวลานั้น (±20 นาที)
- สร้างรายการจาก `RecurringTransaction` ที่ถึงกำหนด แล้วเลื่อนวันที่ครั้งถัดไป

> Vercel Hobby plan จำกัด cron ให้รันได้วันละครั้ง จึงรองรับเฉพาะผู้ใช้ที่ตั้งเวลาแจ้งเตือนใกล้ช่วง 20:00 เท่านั้น หากต้องการรองรับทุกช่วงเวลา ต้องอัปเกรดเป็น Pro plan (ปรับ schedule ให้ถี่ขึ้น) หรือใช้ external scheduler (เช่น GitHub Actions cron / cron-job.org) ยิงมาที่ endpoint นี้แทน

## 📦 Deploy

โปรเจกต์นี้ออกแบบมาให้ deploy บน [Vercel](https://vercel.com) — อย่าลืมตั้ง environment variables ทั้งหมดด้านบนใน Vercel Project Settings และตั้ง Webhook URL ใน LINE Developers Console ให้ชี้มาที่โดเมนที่ deploy แล้ว
