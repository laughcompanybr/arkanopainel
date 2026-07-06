import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { orderSchema, orderFilterSchema, paymentSchema, ORDER_STATUS } from "./schemas";

const idInput = z.object({ id: z.string().uuid() });

export const listOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => orderFilterSchema.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;

    let q = supabase
      .from("orders")
      .select(
        "id, order_number, status, brand, model, reference, sale_price, cost_price, amount_received, profit, purchase_date, expected_delivery, tracking_code, notes, payment_method, created_at, updated_at, deleted_at, client_id, supplier_id, clients(id,name,whatsapp), suppliers(id,name)",
        { count: "exact" },
      );

    if (!data.includeDeleted) q = q.is("deleted_at", null);
    if (data.status) q = q.eq("status", data.status);
    if (data.client_id) q = q.eq("client_id", data.client_id);
    if (data.supplier_id) q = q.eq("supplier_id", data.supplier_id);
    if (data.search) {
      const s = data.search.replace(/[%,]/g, " ").trim();
      const asNum = parseInt(s, 10);
      const orFilters = [
        `brand.ilike.%${s}%`,
        `model.ilike.%${s}%`,
        `reference.ilike.%${s}%`,
        `tracking_code.ilike.%${s}%`,
        `notes.ilike.%${s}%`,
      ];
      if (Number.isFinite(asNum)) orFilters.push(`order_number.eq.${asNum}`);
      q = q.or(orFilters.join(","));
    }

    q = q.order(data.sort, { ascending: data.order === "asc", nullsFirst: false }).range(from, to);

    const { data: rows, error, count } = await q;
    if (error) throw error;
    return { rows: rows ?? [], count: count ?? 0, page: data.page, pageSize: data.pageSize };
  });

export const getOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => idInput.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [orderRes, paymentsRes, eventsRes, attachmentsRes] = await Promise.all([
      supabase
        .from("orders")
        .select("*, clients(id,name,whatsapp,phone,instagram), suppliers(id,name,company,whatsapp)")
        .eq("id", data.id)
        .maybeSingle(),
      supabase
        .from("payments")
        .select("id, direction, amount, method, paid_at, notes, created_at")
        .eq("order_id", data.id)
        .order("paid_at", { ascending: false }),
      supabase
        .from("order_events")
        .select("id, type, message, meta, actor, created_at")
        .eq("order_id", data.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("order_attachments")
        .select("id, filename, mime, size, kind, storage_path, created_at")
        .eq("order_id", data.id)
        .order("created_at", { ascending: false }),
    ]);

    if (orderRes.error) throw orderRes.error;
    if (!orderRes.data) throw new Error("Pedido não encontrado");

    const payments = paymentsRes.data ?? [];
    const totalIn = payments.filter((p) => p.direction === "in").reduce((a, b) => a + Number(b.amount), 0);
    const totalOut = payments.filter((p) => p.direction === "out").reduce((a, b) => a + Number(b.amount), 0);

    return {
      order: orderRes.data,
      payments,
      events: eventsRes.data ?? [],
      attachments: attachmentsRes.data ?? [],
      totals: {
        totalIn,
        totalOut,
        balance: Number(orderRes.data.sale_price ?? 0) - totalIn,
        profit: Number(orderRes.data.profit ?? 0),
      },
    };
  });

export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => orderSchema.parse(v))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("orders")
      .insert({ ...data, created_by: context.userId })
      .select("id, order_number")
      .single();
    if (error) throw error;
    return row;
  });

export const updateOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => orderSchema.extend({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error } = await context.supabase.from("orders").update(rest).eq("id", id);
    if (error) throw error;
    return { ok: true };
  });

export const changeOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid(), status: z.enum(ORDER_STATUS) }).parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("orders").update({ status: data.status }).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const softDeleteOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => idInput.parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("orders")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const restoreOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => idInput.parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("orders")
      .update({ deleted_at: null })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ---------------- payments ----------------
export const addPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => paymentSchema.extend({ order_id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("payments")
      .insert({ ...data, created_by: context.userId })
      .select("id, direction, amount")
      .single();
    if (error) throw error;

    if (data.direction === "in") {
      // Recalculate amount_received on the order
      const { data: sums } = await context.supabase
        .from("payments")
        .select("amount")
        .eq("order_id", data.order_id)
        .eq("direction", "in");
      const total = (sums ?? []).reduce((a, b) => a + Number(b.amount), 0);
      await context.supabase.from("orders").update({ amount_received: total }).eq("id", data.order_id);
    }

    await context.supabase.from("order_events").insert({
      order_id: data.order_id,
      type: "payment",
      message:
        data.direction === "in"
          ? `Pagamento recebido: R$ ${row.amount.toFixed(2)}`
          : `Pagamento efetuado: R$ ${row.amount.toFixed(2)}`,
      meta: { payment_id: row.id, direction: row.direction, amount: row.amount },
      actor: context.userId,
    });

    return { id: row.id };
  });

export const deletePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("payments")
      .select("order_id, direction")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await context.supabase.from("payments").delete().eq("id", data.id);
    if (error) throw error;

    if (row?.order_id && row.direction === "in") {
      const { data: sums } = await context.supabase
        .from("payments")
        .select("amount")
        .eq("order_id", row.order_id)
        .eq("direction", "in");
      const total = (sums ?? []).reduce((a, b) => a + Number(b.amount), 0);
      await context.supabase.from("orders").update({ amount_received: total }).eq("id", row.order_id);
    }
    return { ok: true };
  });

// ---------------- attachments ----------------
const attachmentInput = z.object({
  order_id: z.string().uuid(),
  storage_path: z.string().min(1).max(500),
  filename: z.string().max(200).nullable().optional(),
  mime: z.string().max(120).nullable().optional(),
  size: z.number().int().nonnegative().nullable().optional(),
  kind: z.string().max(60).nullable().optional(),
});

export const addOrderAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => attachmentInput.parse(v))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("order_attachments")
      .insert({ ...data, uploaded_by: context.userId })
      .select("id")
      .single();
    if (error) throw error;
    await context.supabase.from("order_events").insert({
      order_id: data.order_id,
      type: "attachment",
      message: `Anexo adicionado: ${data.filename ?? "arquivo"}`,
      actor: context.userId,
    });
    return { id: row.id };
  });

export const deleteOrderAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid(), storage_path: z.string() }).parse(v))
  .handler(async ({ data, context }) => {
    await context.supabase.storage.from("order-files").remove([data.storage_path]);
    const { error } = await context.supabase.from("order_attachments").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const signOrderAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ storage_path: z.string() }).parse(v))
  .handler(async ({ data, context }) => {
    const { data: signed, error } = await context.supabase.storage
      .from("order-files")
      .createSignedUrl(data.storage_path, 60 * 10);
    if (error) throw error;
    return { url: signed.signedUrl };
  });

// ---------------- lookups ----------------
export const listClientOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("clients")
      .select("id, name")
      .is("deleted_at", null)
      .order("name")
      .limit(500);
    if (error) throw error;
    return data ?? [];
  });

export const listSupplierOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("suppliers")
      .select("id, name")
      .is("deleted_at", null)
      .order("name")
      .limit(500);
    if (error) throw error;
    return data ?? [];
  });
