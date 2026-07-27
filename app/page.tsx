import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 p-8">
      <section>
        <h1 className="text-3xl font-bold">Expense Line Bot</h1>
        <p className="mt-2 text-gray-600">
          ฟีเจอร์ผู้ใช้สำหรับสมัครอัตโนมัติ บันทึกรายรับรายจ่าย ดูสรุป และตั้งค่า budget
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border p-4">
          <h2 className="font-semibold">Webhook</h2>
          <p className="text-sm text-gray-600">สมัครผู้ใช้เมื่อ LINE OA เชื่อมต่อ</p>
        </div>
        <div className="rounded-xl border p-4">
          <h2 className="font-semibold">Transactions</h2>
          <p className="text-sm text-gray-600">บันทึกรายรับรายจ่ายและดูรายการ</p>
        </div>
        <div className="rounded-xl border p-4">
          <h2 className="font-semibold">Budgets</h2>
          <p className="text-sm text-gray-600">ตั้งค่า budget รายเดือนตามหมวดหมู่</p>
        </div>
      </section>

      <section className="flex gap-3">
        <Link href="/api/webhook" className="rounded-lg bg-black px-4 py-2 text-white">
          Test Webhook
        </Link>
        <Link href="/api/transactions" className="rounded-lg border px-4 py-2">
          View Transactions
        </Link>
      </section>
    </main>
  );
}
