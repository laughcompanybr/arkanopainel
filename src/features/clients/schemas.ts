import { z } from "zod";

const optionalTrim = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((v) => (v && v.length ? v : null))
  .nullable();

// Aceita CPF com ou sem máscara, valida 11 dígitos
const cpfRegex = /^\d{11}$/;
const optionalCpf = z
  .string()
  .optional()
  .transform((v) => (v ? v.replace(/\D/g, "") : ""))
  .refine((v) => v === "" || cpfRegex.test(v), { message: "CPF deve ter 11 dígitos" })
  .transform((v) => (v === "" ? null : v));

const optionalPhone = z
  .string()
  .optional()
  .transform((v) => (v ? v.replace(/\D/g, "") : ""))
  .refine((v) => v === "" || (v.length >= 10 && v.length <= 13), { message: "Telefone inválido" })
  .transform((v) => (v === "" ? null : v));

export const clientSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(120),
  cpf: optionalCpf,
  phone: optionalPhone,
  whatsapp: optionalPhone,
  instagram: z
    .string()
    .trim()
    .max(60)
    .optional()
    .transform((v) => (v ? v.replace(/^@/, "") : ""))
    .transform((v) => (v === "" ? null : v)),
  city: optionalTrim,
  state: z
    .string()
    .trim()
    .max(2)
    .optional()
    .transform((v) => (v ? v.toUpperCase() : ""))
    .transform((v) => (v === "" ? null : v)),
  notes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v && v.length ? v : null))
    .nullable(),
});

export type ClientInput = z.input<typeof clientSchema>;
export type ClientPayload = z.output<typeof clientSchema>;

export const clientFilterSchema = z.object({
  search: z.string().trim().max(120).optional(),
  state: z.string().trim().length(2).optional(),
  sort: z.enum(["name", "created_at", "updated_at"]).default("created_at"),
  order: z.enum(["asc", "desc"]).default("desc"),
  includeDeleted: z.boolean().default(false),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(5).max(100).default(20),
});

export type ClientFilter = z.infer<typeof clientFilterSchema>;
