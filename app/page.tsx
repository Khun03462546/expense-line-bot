export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 p-8">
      <section>
        <h1 className="text-3xl font-bold">Expense Line Bot</h1>
        <p className="mt-2 text-gray-600">
          ฟีเจอร์ผู้ใช้สำหรับสมัครอัตโนมัติ บันทึกรายรับรายจ่าย ดูสรุป และตั้งค่า budget ผ่าน LINE OA
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border p-4">
          <h2 className="font-semibold">Webhook</h2>
          <p className="text-sm text-gray-600">
            รับ event จาก LINE OA ที่ <code>/api/webhook</code> (POST เท่านั้น ตรวจ signature ทุกครั้ง)
          </p>
        </div>
        <div className="rounded-xl border p-4">
          <h2 className="font-semibold">Transactions / Budgets / Summary</h2>
          <p className="text-sm text-gray-600">
            REST API ภายในที่ <code>/api/transactions</code>, <code>/api/budgets</code>, <code>/api/summary</code> —
            ต้องแนบ header <code>x-api-key</code> ที่ตรงกับ <code>INTERNAL_API_KEY</code>
          </p>
        </div>
        <div className="rounded-xl border p-4">
          <h2 className="font-semibold">DB Health</h2>
          <p className="text-sm text-gray-600">
            เช็คการเชื่อมต่อฐานข้อมูลได้ที่ <code>/api/db</code>
          </p>
        </div>
      </section>
    </main>
  );
}
