import type { messagingApi } from '@line/bot-sdk';
import type { SummaryRange } from './summary';

export type BotReply = messagingApi.Message;

type FlexBox = messagingApi.FlexBox;
type FlexComponent = messagingApi.FlexComponent;
type FlexBubble = messagingApi.FlexBubble;
type FlexCarousel = messagingApi.FlexCarousel;

const COLOR = {
  income: '#06C755',
  expense: '#E5484D',
  warning: '#B7791F',
  warningBg: '#FFF7E6',
  heading: '#1A1A1A',
  subtext: '#8C8C8C',
  border: '#EEEEEE',
  primary: '#3B82F6',
  purple: '#8B5CF6',
  gold: '#D97706',
  teal: '#0D9488',
  pink: '#DB2777',
  chipBg: '#F5F6F8',
};

const CATEGORY_LABELS: Record<string, string> = {
  food: 'อาหาร',
  shopping: 'ช้อปปิ้ง',
  transport: 'เดินทาง',
  bill: 'บิล/ค่าบริการ',
  other: 'อื่นๆ',
};

export const formatBaht = (value: number) => value.toLocaleString('th-TH', { maximumFractionDigits: 2 });
export const categoryLabel = (category: string) => CATEGORY_LABELS[category] ?? category;

function text(content: string, opts: Partial<messagingApi.FlexText> = {}): messagingApi.FlexText {
  return { type: 'text', text: content, wrap: true, ...opts };
}

function box(layout: FlexBox['layout'], contents: FlexComponent[], opts: Partial<FlexBox> = {}): FlexBox {
  return { type: 'box', layout, contents, ...opts };
}

function separator(): messagingApi.FlexSeparator {
  return { type: 'separator', margin: 'md', color: COLOR.border };
}

function row(label: string, value: string, valueColor?: string): FlexBox {
  return box('horizontal', [
    text(label, { flex: 1, size: 'sm', color: COLOR.subtext }),
    text(value, { size: 'sm', align: 'end', weight: 'bold', ...(valueColor ? { color: valueColor } : {}) }),
  ]);
}

function header(label: string, accentColor: string): FlexBox {
  return box('vertical', [text(label, { color: '#FFFFFF', weight: 'bold', size: 'sm' })], {
    backgroundColor: accentColor,
    paddingAll: 'md',
  });
}

function bubble(headerBox: FlexBox, bodyBox: FlexBox, footerBox?: FlexBox, size: FlexBubble['size'] = 'kilo'): FlexBubble {
  return {
    type: 'bubble',
    size,
    header: headerBox,
    body: bodyBox,
    ...(footerBox ? { footer: footerBox } : {}),
  };
}

function flexReply(altText: string, contents: FlexBubble | FlexCarousel): BotReply {
  return { type: 'flex', altText, contents };
}

export function textReply(content: string): BotReply {
  return { type: 'text', text: content };
}

export function expenseReply(params: {
  isIncome: boolean;
  amount: number;
  description: string;
  category: string;
  warning?: string | null;
}): BotReply {
  const accent = params.isIncome ? COLOR.income : COLOR.expense;
  const label = params.isIncome ? '✅ บันทึกรายรับแล้ว' : '✅ บันทึกรายจ่ายแล้ว';

  const bodyContents: FlexComponent[] = [
    text(`${formatBaht(params.amount)} บาท`, { size: 'xxl', weight: 'bold', color: accent }),
    text(`${params.description} • ${categoryLabel(params.category)}`, { size: 'sm', color: COLOR.subtext, margin: 'sm' }),
  ];

  if (params.warning) {
    bodyContents.push(separator());
    bodyContents.push(
      box('vertical', [text(`⚠️ ${params.warning}`, { size: 'xs', color: COLOR.warning, wrap: true })], {
        backgroundColor: COLOR.warningBg,
        paddingAll: 'sm',
        cornerRadius: 'md',
        margin: 'md',
      }),
    );
  }

  return flexReply(
    `${label} ${formatBaht(params.amount)} บาท`,
    bubble(header(label, accent), box('vertical', bodyContents, { paddingAll: 'lg', spacing: 'sm' })),
  );
}

const RANGE_LABELS: Record<SummaryRange, string> = {
  today: 'วันนี้',
  yesterday: 'เมื่อวาน',
  week: 'อาทิตย์นี้',
  month: 'เดือนนี้',
  year: 'ปีนี้',
};

export function summaryReply(range: SummaryRange, income: number, expense: number): BotReply {
  const balance = income - expense;
  const balanceColor = balance >= 0 ? COLOR.income : COLOR.expense;

  const bodyBox = box(
    'vertical',
    [
      row('รายรับ', `+${formatBaht(income)}`, COLOR.income),
      row('รายจ่าย', `-${formatBaht(expense)}`, COLOR.expense),
      separator(),
      row('คงเหลือ', formatBaht(balance), balanceColor),
    ],
    { paddingAll: 'lg', spacing: 'md' },
  );

  return flexReply(
    `📊 สรุป${RANGE_LABELS[range]}`,
    bubble(header(`📊 สรุป${RANGE_LABELS[range]}`, COLOR.heading), bodyBox),
  );
}

export function searchReply(params: {
  keyword: string;
  transactions: Array<{ type: string; amount: number; description: string | null; category: string | null; transactionDate: Date }>;
  total: number;
}): BotReply {
  const shown = params.transactions.slice(0, 10);
  const hiddenCount = params.transactions.length - shown.length;

  const rows: FlexComponent[] = shown.map((tx) => {
    const isIncome = tx.type === 'income';
    const date = tx.transactionDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
    return box('horizontal', [
      text(`${tx.description ?? tx.category ?? 'รายการ'} · ${date}`, { flex: 1, size: 'xs', color: COLOR.subtext }),
      text(`${isIncome ? '+' : '-'}${formatBaht(tx.amount)}`, {
        size: 'xs',
        weight: 'bold',
        align: 'end',
        color: isIncome ? COLOR.income : COLOR.expense,
      }),
    ]);
  });

  if (hiddenCount > 0) {
    rows.push(text(`และอีก ${hiddenCount} รายการ`, { size: 'xs', color: COLOR.subtext, margin: 'sm' }));
  }

  const bodyBox = box('vertical', rows, { paddingAll: 'lg', spacing: 'sm' });
  const footerBox = box('vertical', [row('รวม', formatBaht(params.total), params.total >= 0 ? COLOR.income : COLOR.expense)], {
    paddingAll: 'lg',
    paddingTop: 'none',
  });

  return flexReply(
    `🔍 พบ ${params.transactions.length} รายการ`,
    bubble(header(`🔍 พบ ${params.transactions.length} รายการ: "${params.keyword}"`, COLOR.heading), bodyBox, footerBox),
  );
}

export function budgetReply(category: string, amount: number): BotReply {
  const label = `🎯 ตั้งงบ ${category}`;
  const bodyBox = box('vertical', [text(`${formatBaht(amount)} บาท / เดือน`, { size: 'lg', weight: 'bold', color: COLOR.heading })], {
    paddingAll: 'lg',
  });

  return flexReply(`${label} เป็น ${formatBaht(amount)} บาทแล้ว`, bubble(header(label, COLOR.heading), bodyBox));
}

export function budgetListReply(items: Array<{ category: string; amount: number; spent: number }>): BotReply {
  const label = '🎯 งบเดือนนี้';
  const rows = items.map((item) => {
    const ratio = item.amount > 0 ? item.spent / item.amount : 0;
    const valueColor = ratio >= 1 ? COLOR.expense : ratio >= 0.8 ? COLOR.warning : COLOR.heading;
    return box('horizontal', [
      text(categoryLabel(item.category), { flex: 1, size: 'xs', color: COLOR.subtext }),
      text(`${formatBaht(item.spent)} / ${formatBaht(item.amount)}`, {
        size: 'xs',
        weight: 'bold',
        align: 'end',
        color: valueColor,
      }),
    ]);
  });

  return flexReply(label, bubble(header(label, COLOR.heading), box('vertical', rows, { paddingAll: 'lg', spacing: 'sm' })));
}

export function reminderReply(message: string, enabled: boolean): BotReply {
  const label = '🔔 แจ้งเตือน';
  const bodyBox = box('vertical', [text(message, { size: 'md', color: COLOR.heading })], { paddingAll: 'lg' });

  return flexReply(message, bubble(header(label, enabled ? COLOR.income : COLOR.subtext), bodyBox));
}

export function recurringCreatedReply(params: {
  description: string;
  amount: number;
  frequencyLabel: string;
  nextRunLabel: string;
}): BotReply {
  const label = '🔁 ตั้งรายการซ้ำแล้ว';
  const bodyBox = box(
    'vertical',
    [
      text(params.description, { size: 'md', weight: 'bold', color: COLOR.heading }),
      row('จำนวน', `${formatBaht(params.amount)} บาท`),
      row('ความถี่', params.frequencyLabel),
      row('ครั้งถัดไป', params.nextRunLabel),
    ],
    { paddingAll: 'lg', spacing: 'sm' },
  );

  return flexReply(
    `${label}: ${params.description} ${formatBaht(params.amount)} บาท`,
    bubble(header(label, COLOR.heading), bodyBox),
  );
}

type HelpSection = { icon: string; title: string; accent: string; example: string; items: string[] };

const HELP_SECTIONS: HelpSection[] = [
  {
    icon: '📝',
    title: 'บันทึกรายการ',
    accent: COLOR.income,
    example: 'จ่ายค่าข้าว 55 บาท',
    items: ['จ่ายค่าข้าว 55 บาท', 'ได้เงินเดือน 20000 บาท'],
  },
  {
    icon: '📊',
    title: 'ดูสรุป',
    accent: COLOR.primary,
    example: 'สรุปเดือนนี้',
    items: ['วันนี้', 'เมื่อวาน', 'อาทิตย์นี้', 'เดือนนี้', 'ปีนี้'],
  },
  {
    icon: '🔍',
    title: 'ค้นหา & แก้ไข',
    accent: COLOR.purple,
    example: 'ค้นหา ข้าว',
    items: ['ค้นหา [คำ]', 'แก้ล่าสุด [จำนวน]', 'ลบล่าสุด'],
  },
  {
    icon: '🎯',
    title: 'งบประมาณ',
    accent: COLOR.gold,
    example: 'ตั้งงบอาหาร 5000',
    items: ['ตั้งงบ[หมวด] [จำนวน]', 'ดูงบ', 'ลบงบ[หมวด]'],
  },
  {
    icon: '🔔',
    title: 'แจ้งเตือน',
    accent: COLOR.teal,
    example: 'แจ้งเตือน 20:00',
    items: ['แจ้งเตือน HH:MM', 'เปิดแจ้งเตือน', 'ปิดแจ้งเตือน'],
  },
  {
    icon: '🔁',
    title: 'รายการซ้ำ',
    accent: COLOR.pink,
    example: 'ตั้งรายการซ้ำ ค่าเช่า 5000 ทุกเดือน',
    items: ['ตั้งรายการซ้ำ [ชื่อ] [จำนวน] ทุกวัน/สัปดาห์/เดือน', 'รายการซ้ำ', 'ยกเลิกรายการซ้ำ [ชื่อ]'],
  },
];

function chip(content: string, accent: string): FlexBox {
  return box('vertical', [text(content, { size: 'xs', color: COLOR.heading, wrap: true })], {
    backgroundColor: COLOR.chipBg,
    borderColor: accent,
    borderWidth: 'light',
    cornerRadius: 'md',
    paddingAll: 'sm',
  });
}

function welcomeCoverBubble(greeting: string): FlexBubble {
  const headerBox = box(
    'vertical',
    [
      text('👋', { size: '3xl' }),
      text(greeting, { color: '#FFFFFF', weight: 'bold', size: 'lg', margin: 'md' }),
    ],
    { backgroundColor: COLOR.income, paddingAll: 'xl' },
  );

  const bodyBox = box(
    'vertical',
    [
      text('เริ่มบันทึกได้เลยด้วยข้อความง่าย ๆ เช่น', { size: 'sm', color: COLOR.subtext }),
      chip(`💬 ${HELP_SECTIONS[0].example}`, COLOR.income),
      text('เลื่อนดูคำสั่งทั้งหมดทางขวา ➡️', { size: 'xs', color: COLOR.subtext, margin: 'lg', align: 'center' }),
    ],
    { paddingAll: 'lg', spacing: 'md' },
  );

  return bubble(headerBox, bodyBox);
}

function helpSectionBubble(section: HelpSection): FlexBubble {
  const headerBox = box(
    'vertical',
    [
      text(section.icon, { size: 'xxl' }),
      text(section.title, { color: '#FFFFFF', weight: 'bold', size: 'md', margin: 'sm' }),
    ],
    { backgroundColor: section.accent, paddingAll: 'lg' },
  );

  const bodyBox = box(
    'vertical',
    [
      ...section.items.map((item) =>
        box('horizontal', [
          text('•', { size: 'sm', color: section.accent, weight: 'bold', flex: 0 }),
          text(item, { size: 'xs', color: COLOR.heading, wrap: true, margin: 'sm', flex: 1 }),
        ]),
      ),
      chip(`💬 ${section.example}`, section.accent),
    ],
    { paddingAll: 'lg', spacing: 'sm' },
  );

  return bubble(headerBox, bodyBox);
}

export function helpReply(greeting?: string): BotReply {
  const bubbles = [...(greeting ? [welcomeCoverBubble(greeting)] : []), ...HELP_SECTIONS.map(helpSectionBubble)];

  return flexReply(
    greeting ? `${greeting} พิมพ์ "จ่ายค่าข้าว 55 บาท" เพื่อเริ่มบันทึกได้เลย` : 'คำสั่งทั้งหมดของบอท',
    { type: 'carousel', contents: bubbles },
  );
}

export function recurringListReply(
  items: Array<{ description: string | null; amount: number; frequencyLabel: string; nextRunLabel: string }>,
): BotReply {
  const label = '🔁 รายการซ้ำที่ตั้งไว้';
  const rows = items.map((item) =>
    box('horizontal', [
      text(`${item.description ?? 'รายการ'} · ${item.frequencyLabel}`, { flex: 1, size: 'xs', color: COLOR.subtext }),
      text(`${formatBaht(item.amount)}`, { size: 'xs', weight: 'bold', align: 'end', color: COLOR.heading }),
    ]),
  );

  return flexReply(label, bubble(header(label, COLOR.heading), box('vertical', rows, { paddingAll: 'lg', spacing: 'sm' })));
}

