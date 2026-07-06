import { z } from "zod";

const optionalTrim = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length ? v : null))
    .nullable();

const optionalPhone = z
  .string()
  .optional()
  .transform((v) => (v ? v.replace(/\D/g, "") : ""))
  .refine((v) => v === "" || (v.length >= 10 && v.length <= 13), { message: "Telefone inválido" })
  .transform((v) => (v === "" ? null : v));

const optionalEmail = z
  .string()
  .trim()
  .optional()
  .transform((v) => v ?? "")
  .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: "E-mail inválido" })
  .transform((v) => (v === "" ? null : v));

export const supplierSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(120),
  company: optionalTrim(160),
  email: optionalEmail,
  phone: optionalPhone,
  whatsapp: optionalPhone,
  instagram: z
    .string()
    .trim()
    .max(60)
    .optional()
    .transform((v) => (v ? v.replace(/^@/, "") : ""))
    .transform((v) => (v === "" ? null : v)),
  avg_delivery_days: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === "" || v === null) return null;
      const n = typeof v === "number" ? v : parseInt(v, 10);
      return Number.isFinite(n) ? n : null;
    })
    .refine((v) => v === null || (v >= 0 && v <= 365), { message: "Entre 0 e 365 dias" }),
  notes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v && v.length ? v : null))
    .nullable(),
});

export type SupplierInput = z.input<typeof supplierSchema>;
export type SupplierPayload = z.output<typeof supplierSchema>;

export const supplierFilterSchema = z.object({
  search: z.string().trim().max(120).optional(),
  sort: z.enum(["name", "created_at", "updated_at", "avg_delivery_days"]).default("created_at"),
  order: z.enum(["asc", "desc"]).default("desc"),
  includeDeleted: z.boolean().default(false),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(5).max(100).default(20),
});

export type SupplierFilter = z.infer<typeof supplierFilterSchema>;
