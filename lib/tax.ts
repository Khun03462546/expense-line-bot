import { prisma } from './prisma';

// อัตราภาษีเงินได้บุคคลธรรมดาแบบขั้นบันได (ประเทศไทย) — ใช้มาตั้งแต่ปีภาษี 2560 ถึงปัจจุบัน
const TAX_BRACKETS = [
  { upTo: 150_000, rate: 0 },
  { upTo: 300_000, rate: 0.05 },
  { upTo: 500_000, rate: 0.1 },
  { upTo: 750_000, rate: 0.15 },
  { upTo: 1_000_000, rate: 0.2 },
  { upTo: 2_000_000, rate: 0.25 },
  { upTo: 5_000_000, rate: 0.3 },
  { upTo: Infinity, rate: 0.35 },
];

const PERSONAL_ALLOWANCE = 60_000;
const SPOUSE_ALLOWANCE = 60_000;
const CHILD_ALLOWANCE_PER_CHILD = 30_000;
const STANDARD_DEDUCTION_RATE = 0.5;
const STANDARD_DEDUCTION_CAP = 100_000;

export type TaxBracketResult = { from: number; to: number; rate: number; taxable: number; tax: number };

export function calculateProgressiveTax(netIncome: number): { tax: number; brackets: TaxBracketResult[] } {
  let remaining = Math.max(0, netIncome);
  let from = 0;
  let totalTax = 0;
  const brackets: TaxBracketResult[] = [];

  for (const bracket of TAX_BRACKETS) {
    const bracketSize = bracket.upTo - from;
    const taxable = Math.min(remaining, bracketSize);

    if (taxable > 0) {
      const tax = taxable * bracket.rate;
      totalTax += tax;
      brackets.push({ from, to: bracket.upTo, rate: bracket.rate, taxable, tax });
    }

    remaining -= taxable;
    from = bracket.upTo;
    if (remaining <= 0) break;
  }

  return { tax: totalTax, brackets };
}

export type TaxSummary = {
  year: number;
  totalIncome: number;
  standardDeduction: number;
  personalAllowance: number;
  spouseAllowance: number;
  childAllowance: number;
  otherDeductions: number;
  netIncome: number;
  tax: number;
  brackets: TaxBracketResult[];
};

// ประมาณภาษีเงินได้บุคคลธรรมดาที่ต้องจ่ายสำหรับปีนั้น ๆ จากข้อมูลรายรับที่บันทึกไว้ + ค่าลดหย่อนที่ผู้ใช้กรอกเอง
// หมายเหตุ: เป็นการประมาณอย่างง่าย ใช้สมมติฐานว่าเงินได้ทั้งหมดหักค่าใช้จ่ายแบบเหมา 50% (สูงสุด 100,000)
// ตามเงินได้ประเภทที่ 1-2 (เงินเดือน/ฟรีแลนซ์) ไม่ได้แยกประเภทเงินได้หรือคำนวณค่าลดหย่อนเฉพาะทาง
// (RMF/SSF/ประกันชีวิตแยกเพดาน ฯลฯ) อย่างละเอียดครบทุกกรณีตามกฎหมายจริง
export async function getTaxSummary(userId: string, year: number): Promise<TaxSummary> {
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31, 23, 59, 59, 999);

  const [{ _sum: incomeSum }, profile, { _sum: deductionSum }] = await Promise.all([
    prisma.transaction.aggregate({
      where: { userId, type: 'income', transactionDate: { gte: start, lte: end } },
      _sum: { amount: true },
    }),
    prisma.taxProfile.findUnique({ where: { userId } }),
    prisma.taxDeduction.aggregate({
      where: { userId, year },
      _sum: { amount: true },
    }),
  ]);

  const totalIncome = Number(incomeSum.amount ?? 0);
  const standardDeduction = Math.min(totalIncome * STANDARD_DEDUCTION_RATE, STANDARD_DEDUCTION_CAP);
  const spouseAllowance = profile?.maritalStatus === 'married' ? SPOUSE_ALLOWANCE : 0;
  const childAllowance = (profile?.children ?? 0) * CHILD_ALLOWANCE_PER_CHILD;
  const otherDeductions = Number(deductionSum.amount ?? 0);

  const netIncome = Math.max(
    0,
    totalIncome - standardDeduction - PERSONAL_ALLOWANCE - spouseAllowance - childAllowance - otherDeductions,
  );

  const { tax, brackets } = calculateProgressiveTax(netIncome);

  return {
    year,
    totalIncome,
    standardDeduction,
    personalAllowance: PERSONAL_ALLOWANCE,
    spouseAllowance,
    childAllowance,
    otherDeductions,
    netIncome,
    tax,
    brackets,
  };
}
