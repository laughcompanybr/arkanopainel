import { z } from "zod";

export const EXPENSE_CATEGORIES = [
  "Operacional",
  "Marketing",
  "Logística",
  "Impostos",
  "Salários",
  "Comissões",
  "Outros",
] as const;

const money = z
  .union([z.string(), z.number()])
  .transform((v) => {
    if (v === "" || v === null || v === undefined) return 0;
    const n = typeof v === "number" ? v : parseFloat(String(v).replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  })
  .refine((v) => v > 0 && v <= 100_000_000, { message: "Valor inválido" });

export const expenseSchema = z.object({
  description: z.string().trim().min(1, "Descrição obrigatória").max(200),
  amount: money,
  category: z.enum(EXPENSE_CATEGORIES).default("Operacional"),
  incurred_at: z.string().min(1, "Data obrigatória"),
});
export type ExpenseInput = z.input<typeof expenseSchema>;

export const dateRangeSchema = z.object({
  from: z.string().min(10),
  to: z.string().min(10),
  granularity: z.enum(["day", "month"]).default("day"),
});
export type DateRange = z.infer<typeof dateRangeSchema>;

export const expenseFilterSchema = z.object({
  from: z.string().min(10),
  to: z.string().min(10),
  category: z.enum(EXPENSE_CATEGORIES).optional(),
});
