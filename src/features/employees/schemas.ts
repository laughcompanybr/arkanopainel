import { z } from "zod";

const optionalStr = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v && v.length ? v : null))
    .nullable();

const optionalPhone = z
  .string()
  .nullish()
  .transform((v) => (v ? v.replace(/\D/g, "") : ""))
  .refine((v) => v === "" || (v.length >= 10 && v.length <= 13), { message: "Telefone inválido" })
  .transform((v) => (v === "" ? null : v));

const optionalEmail = z
  .string()
  .nullish()
  .transform((v) => (v ?? "").trim())
  .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: "E-mail inválido" })
  .transform((v) => (v === "" ? null : v));

const optionalMoney = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = typeof v === "number" ? v : parseFloat(String(v).replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  })
  .refine((v) => v === null || (v >= 0 && v <= 10_000_000), { message: "Valor inválido" });

const optionalPercent = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  })
  .refine((v) => v === null || (v >= 0 && v <= 100), { message: "Percentual entre 0 e 100" });

const optionalDate = z
  .string()
  .nullish()
  .transform((v) => (v && v.length ? v : null));

export const EMPLOYEE_STATUS = ["active", "inactive"] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUS)[number];

export const employeeSchema = z.object({
  full_name: z.string().trim().min(2, "Nome muito curto").max(140),
  role: optionalStr(120),
  email: optionalEmail,
  phone: optionalPhone,
  whatsapp: optionalPhone,
  hire_date: optionalDate,
  base_salary: optionalMoney,
  commission_percent: optionalPercent,
  status: z.enum(EMPLOYEE_STATUS).default("active"),
  notes: optionalStr(2000),
});

export type EmployeeInput = z.input<typeof employeeSchema>;
export type EmployeePayload = z.output<typeof employeeSchema>;

export const employeeFilterSchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.enum(EMPLOYEE_STATUS).optional(),
  includeDeleted: z.boolean().default(false),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(5).max(100).default(20),
  sort: z.enum(["full_name", "created_at", "hire_date"]).default("created_at"),
  order: z.enum(["asc", "desc"]).default("desc"),
});
export type EmployeeFilter = z.infer<typeof employeeFilterSchema>;
