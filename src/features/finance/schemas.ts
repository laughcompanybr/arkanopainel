import { z } from "zod";

export const EXPENSE_CATEGORIES = [
  "Operacional",
  "Marketing",
  "Logística",
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
  .refine((v) => v >= 0 && v <= 100_000_000, { message: "Valor inválido" });

export const expenseSchema = z.object({
  description: z.string().trim().max(200).optional().transform((v) => (v && v.length ? v : "Sem descrição")),
  amount: money,
  category: z.enum(EXPENSE_CATEGORIES).default("Operacional"),
  incurred_at: z.string().optional().transform((v) => (v && v.length ? v : new Date().toISOString().slice(0, 10))),
  receipt_url: z.string().trim().max(500).optional().nullable(),
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

/* -------- Manual financial movements -------- */
export const TX_STATUSES = ["pending", "paid", "overdue", "cancelled"] as const;
export const TX_METHODS = [
  "pix",
  "credit_card",
  "debit_card",
  "cash",
  "boleto",
  "transfer",
  "other",
] as const;

export const financialTxSchema = z.object({
  direction: z.enum(["in", "out"]),
  status: z.enum(TX_STATUSES).default("paid"),
  description: z.string().trim().max(200).optional().transform((v) => (v && v.length ? v : "Sem descrição")),
  category: z.string().trim().max(80).optional().nullable(),
  amount: money,
  method: z.enum(TX_METHODS).optional().nullable(),
  due_date: z.string().optional().nullable(),
  paid_at: z.string().optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  receipt_url: z.string().trim().max(500).optional().nullable(),
});
export type FinancialTxInput = z.input<typeof financialTxSchema>;

export const financialTxFilterSchema = z.object({
  from: z.string().min(10),
  to: z.string().min(10),
  direction: z.enum(["in", "out"]).optional(),
  status: z.enum(TX_STATUSES).optional(),
  search: z.string().trim().max(120).optional(),
});

export const payablesFilterSchema = z.object({
  search: z.string().trim().max(120).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  statusFilter: z.enum(["all", "overdue", "upcoming", "future", "no_date"]).default("all"),
});
export type PayablesFilter = z.input<typeof payablesFilterSchema>;

/* -------- Goals -------- */
export const goalSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  month: z
    .string()
    .min(7)
    .transform((v) => (v.length === 7 ? `${v}-01` : v.slice(0, 10))),
  sales_target: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === "" || v === null || v === undefined) return 0;
      const n = typeof v === "number" ? v : parseFloat(String(v).replace(/\./g, "").replace(",", "."));
      return Number.isFinite(n) ? n : 0;
    }),
  orders_target: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === "" || v === null || v === undefined) return 0;
      const n = typeof v === "number" ? v : parseInt(String(v), 10);
      return Number.isFinite(n) ? n : 0;
    }),
  profit_target: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === "" || v === null || v === undefined) return 0;
      const n = typeof v === "number" ? v : parseFloat(String(v).replace(/\./g, "").replace(",", "."));
      return Number.isFinite(n) ? n : 0;
    }),
  notes: z.string().trim().max(500).optional().nullable(),
});
export type GoalInput = z.input<typeof goalSchema>;

