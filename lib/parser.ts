// Parser สำหรับแปลงข้อความธรรมชาติเป็นรายการธุรกรรม
// ตัวอย่าง: "จ่ายค่าข้าว 55 บาท" → income/expense + amount + description
export type ParsedTransaction = {
  type: 'income' | 'expense';
  amount: number;
  description: string;
  category: string;
};

export function parseExpenseText(text: string): ParsedTransaction | null {
  const normalized = text.trim().replace(/\s+/g, ' ');
  const amountMatch = normalized.match(/(\d+(?:\.\d+)?)/);

  if (!amountMatch) {
    return null;
  }

  const amount = Number(amountMatch[1]);
  const lower = normalized.toLowerCase();

  const incomeKeywords = ['รับ', 'รับเงิน', 'รายรับ', 'เงินเดือน', 'โบนัส', 'ขาย', 'ขายของ', 'ได้เงิน', 'ได้เงินมา'];
  const expenseKeywords = ['จ่าย', 'ค่า', 'ซื้อ', 'กิน', 'ใช้เงิน'];

  const hasIncomeKeyword = incomeKeywords.some((keyword) => lower.includes(keyword));
  const hasExpenseKeyword = expenseKeywords.some((keyword) => lower.includes(keyword));
  const type = hasIncomeKeyword && !hasExpenseKeyword ? 'income' : 'expense';

  let description = normalized
    .replace(/^จ่าย\s+/i, '')
    .replace(/^ค่า\s+/i, '')
    .replace(/^รับ\s+/i, '')
    .replace(/^รับเงิน\s+/i, '')
    .replace(/^ขาย\s+/i, '')
    .replace(/^ขายของ\s+/i, '')
    .replace(/\bบาท\b/gi, '')
    .replace(/฿/g, '')
    .replace(new RegExp(`\\b${amountMatch[1]}\\b`), '')
    .trim();

  description = description.replace(/\s+/g, ' ').trim() || 'รายการ';

  let category = 'other';
  if (/(ข้าว|กาแฟ|อาหาร|กิน|ชานม|ขนม)/i.test(lower)) {
    category = 'food';
  } else if (/(amazon|shop|shopping|ซื้อ|ร้าน)/i.test(lower)) {
    category = 'shopping';
  } else if (/(รถ|แท็กซี่|บัส|metro|train|น้ำมัน|fuel)/i.test(lower)) {
    category = 'transport';
  } else if (/(ค่าไฟ|ค่าน้ำ|internet|wifi|rent|ค่าเช่า|ค่าบริการ)/i.test(lower)) {
    category = 'bill';
  }

  return {
    type,
    amount,
    description,
    category,
  };
}
