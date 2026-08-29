import { z } from 'zod';

export const createTransactionSchema = z.object({
  userId: z.string().min(1),
  type: z.enum(['income', 'expense']),
  amount: z.coerce.number().positive(),
  description: z.string().optional(),
  category: z.string().optional(),
  note: z.string().optional(),
  transactionDate: z.coerce.date(),
});

export const createBudgetSchema = z.object({
  userId: z.string().min(1),
  category: z.string().min(1),
  amount: z.coerce.number().positive(),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000),
});
