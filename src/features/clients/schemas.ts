import { z } from "zod";

const optionalTrim = z
  .string()
  .trim()
  .max(200)
  .nullish()
  .transform((v) => (v && v.length ? v : null))
  .nullable();

// Aceita CPF com ou sem máscara, valida 11 dígitos
const cpfRegex = /^\d{11}$/;
const optionalCpf = z
  .string()
  .nullish()
  .transform((v) => (v ? v.replace(/\D/g, "") : ""))
  .refine((v) => v === "" || cpfRegex.test(v), { message: "CPF deve ter 11 dígitos" })
  .transform((v) => (v === "" ? null : v));

const optionalPhone = z
  .string()
  .nullish()
  .transform((v) => (v ? v.replace(/\D/g, "") : ""))
  .refine((v) => v === "" || (v.length >= 10 && v.length <= 13), { message: "Telefone inválido" })
  .transform((v) => (v === "" ? null : v));

export const clientSchema = z.object({
  name: z
    .string()
    .trim()
    .max(120)
    .nullish()
    .transform((v) => (v && v.length ? v : "Sem nome")),
  cpf: optionalCpf,
  phone: optionalPhone,
  whatsapp: optionalPhone,
  instagram: z
    .string()
    .trim()
    .max(60)
    .nullish()
    .transform((v) => (v ? v.replace(/^@/, "") : ""))
    .transform((v) => (v === "" ? null : v)),
  zip: z
    .string()
    .nullish()
    .transform((v) => (v ? v.replace(/\D/g, "") : ""))
    .refine((v) => v === "" || v.length === 8, { message: "CEP deve ter 8 dígitos" })
    .transform((v) => (v === "" ? null : v)),
  street: optionalTrim,
  number: optionalTrim,
  complement: optionalTrim,
  district: optionalTrim,
  reference: optionalTrim,
  city: optionalTrim,
  state: z
    .string()
    .trim()
    .max(2)
    .nullish()
    .transform((v) => (v ? v.toUpperCase() : ""))
    .transform((v) => (v === "" ? null : v)),
  notes: z
    .string()
    .trim()
    .max(2000)
    .nullish()
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
