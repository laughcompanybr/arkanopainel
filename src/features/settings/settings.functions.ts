import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CARD_FEE_KEY = "card_fee_percent";

/**
 * Zod schema for a percent-in-app_settings input. Ensures the incoming value
 * is a finite number between 0 and 100 before it can be persisted.
 */
const percentSchema = z.object({
  percent: z
    .number({ invalid_type_error: "Percentual inválido" })
    .min(0, { message: "Percentual não pode ser negativo" })
    .max(100, { message: "Percentual não pode exceder 100%" })
    .refine((n) => Number.isFinite(n), { message: "Percentual inválido" }),
});

function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

export const getCardFeePercent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("app_settings")
      .select("value")
      .eq("key", CARD_FEE_KEY)
      .maybeSingle();
    if (error) throw error;
    const value = (data?.value ?? {}) as { percent?: number };
    return { percent: Number(value.percent ?? 3.49) };
  });

export const setCardFeePercent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => percentSchema.parse(v))
  .handler(async ({ data, context }) => {
    const percent = clampPercent(data.percent);
    const { error } = await context.supabase
      .from("app_settings")
      .upsert(
        {
          key: CARD_FEE_KEY,
          value: { percent },
          description: "Taxa % padrão do cartão de crédito",
          updated_by: context.userId,
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: "key" },
      );
    if (error) throw new Error(error.message);
    return { ok: true, percent };
  });




export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, full_name, avatar_url, theme, created_at, updated_at")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z
      .object({
        full_name: z.string().trim().min(1).max(120),
        avatar_url: z.string().trim().url().max(500).optional().nullable(),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ full_name: data.full_name, avatar_url: data.avatar_url ?? null })
      .eq("id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const exportBackup = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = context.supabase;
    const [clients, suppliers, orders, payments, expenses] = await Promise.all([
      s.from("clients").select("*").is("deleted_at", null),
      s.from("suppliers").select("*").is("deleted_at", null),
      s.from("orders").select("*").is("deleted_at", null),
      s.from("payments").select("*"),
      s.from("expenses").select("*"),
    ]);
    const errs = [clients.error, suppliers.error, orders.error, payments.error, expenses.error].filter(Boolean);
    if (errs.length) throw errs[0];
    return {
      generated_at: new Date().toISOString(),
      version: 1,
      counts: {
        clients: clients.data?.length ?? 0,
        suppliers: suppliers.data?.length ?? 0,
        orders: orders.data?.length ?? 0,
        payments: payments.data?.length ?? 0,
        expenses: expenses.data?.length ?? 0,
      },
      data: {
        clients: clients.data ?? [],
        suppliers: suppliers.data ?? [],
        orders: orders.data ?? [],
        payments: payments.data ?? [],
        expenses: expenses.data ?? [],
      },
    };
  });

const clientRow = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(40).optional().nullable(),
  whatsapp: z.string().trim().max(40).optional().nullable(),
  instagram: z.string().trim().max(80).optional().nullable(),
  cpf: z.string().trim().max(20).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  state: z.string().trim().max(4).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const importClients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z.object({ rows: z.array(clientRow).min(1).max(2000) }).parse(v),
  )
  .handler(async ({ data, context }) => {
    const payload = data.rows.map((r) => ({
      name: r.name,
      phone: r.phone || null,
      whatsapp: r.whatsapp || null,
      instagram: r.instagram || null,
      cpf: r.cpf || null,
      city: r.city || null,
      state: r.state || null,
      notes: r.notes || null,
      created_by: context.userId,
    }));
    const { error, count } = await context.supabase
      .from("clients")
      .insert(payload, { count: "exact" });
    if (error) throw error;
    return { inserted: count ?? payload.length };
  });

const supplierRow = z.object({
  name: z.string().trim().min(1).max(200),
  company: z.string().trim().max(200).optional().nullable(),
  email: z.string().trim().email().max(255).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  whatsapp: z.string().trim().max(40).optional().nullable(),
  instagram: z.string().trim().max(80).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const importSuppliers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ rows: z.array(supplierRow).min(1).max(2000) }).parse(v))
  .handler(async ({ data, context }) => {
    const payload = data.rows.map((r) => ({
      ...r,
      company: r.company || null,
      email: r.email || null,
      phone: r.phone || null,
      whatsapp: r.whatsapp || null,
      instagram: r.instagram || null,
      notes: r.notes || null,
      created_by: context.userId,
    }));
    const { error, count } = await context.supabase
      .from("suppliers")
      .insert(payload, { count: "exact" });
    if (error) throw error;
    return { inserted: count ?? payload.length };
  });
