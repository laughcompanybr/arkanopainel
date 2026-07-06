import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { supplierSchema, supplierFilterSchema } from "./schemas";

const idInput = z.object({ id: z.string().uuid() });

export const listSuppliers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => supplierFilterSchema.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;

    let q = supabase
      .from("suppliers")
      .select(
        "id, name, company, email, phone, whatsapp, instagram, avg_delivery_days, notes, created_at, updated_at, deleted_at",
        { count: "exact" },
      );

    if (!data.includeDeleted) q = q.is("deleted_at", null);
    if (data.search) {
      const s = data.search.replace(/[%,]/g, " ").trim();
      q = q.or(
        `name.ilike.%${s}%,company.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%,whatsapp.ilike.%${s}%,instagram.ilike.%${s}%`,
      );
    }

    q = q.order(data.sort, { ascending: data.order === "asc", nullsFirst: false }).range(from, to);

    const { data: rows, error, count } = await q;
    if (error) throw error;
    return { rows: rows ?? [], count: count ?? 0, page: data.page, pageSize: data.pageSize };
  });

export const getSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => idInput.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [supplierRes, historyRes, ordersRes] = await Promise.all([
      supabase.from("suppliers").select("*").eq("id", data.id).maybeSingle(),
      supabase
        .from("audit_log")
        .select("id, operation, actor, changed_at, old_data, new_data")
        .eq("table_name", "suppliers")
        .eq("record_id", data.id)
        .order("changed_at", { ascending: false })
        .limit(50),
      supabase
        .from("orders")
        .select("id, order_number, status, sale_price, cost_price, created_at, client_id, clients(name)")
        .eq("supplier_id", data.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (supplierRes.error) throw supplierRes.error;
    if (!supplierRes.data) throw new Error("Fornecedor não encontrado");

    const orders = ordersRes.data ?? [];
    const totals = orders.reduce(
      (acc, o) => {
        acc.count += 1;
        acc.revenue += Number(o.sale_price ?? 0);
        acc.cost += Number(o.cost_price ?? 0);
        return acc;
      },
      { count: 0, revenue: 0, cost: 0 },
    );

    return {
      supplier: supplierRes.data,
      history: historyRes.data ?? [],
      orders,
      totals,
    };
  });

export const createSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => supplierSchema.parse(v))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("suppliers")
      .insert({ ...data, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id };
  });

export const updateSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => supplierSchema.extend({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error } = await context.supabase.from("suppliers").update(rest).eq("id", id);
    if (error) throw error;
    return { ok: true };
  });

export const softDeleteSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => idInput.parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("suppliers")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const restoreSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => idInput.parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("suppliers")
      .update({ deleted_at: null })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
