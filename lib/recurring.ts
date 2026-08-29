import { addDays, addMonths, addWeeks } from 'date-fns';

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly';

export const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  daily: 'ทุกวัน',
  weekly: 'ทุกสัปดาห์',
  monthly: 'ทุกเดือน',
};

const advanceByFrequency: Record<RecurringFrequency, (date: Date) => Date> = {
  daily: (date) => addDays(date, 1),
  weekly: (date) => addWeeks(date, 1),
  monthly: (date) => addMonths(date, 1),
};

export function advanceRecurringDate(date: Date, frequency: string): Date {
  const advance = advanceByFrequency[frequency as RecurringFrequency] ?? advanceByFrequency.monthly;
  return advance(date);
}
