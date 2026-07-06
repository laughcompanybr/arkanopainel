import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { clientSchema, clientFilterSchema } from "./schemas";

const idInput = z.object({ id: z.string().uuid() });

export const listClients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => clientFilterSchema.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;

    let q = supabase
      .from("clients")
      .select("id, name, cpf, phone, whatsapp, instagram, city, state, notes, created_at, updated_at, deleted_at", {
        count: "exact",
      });

    if (!data.includeDeleted) q = q.is("deleted_at", null);
    if (data.search) {
      const s = data.search.replace(/[%,]/g, " ").trim();
      q = q.or(
        `name.ilike.%${s}%,cpf.ilike.%${s}%,phone.ilike.%${s}%,whatsapp.ilike.%${s}%,instagram.ilike.%${s}%,city.ilike.%${s}%`,
      );
    }
    if (data.state) q = q.eq("state", data.state);

    q = q.order(data.sort, { ascending: data.order === "asc" }).range(from, to);

    const { data: rows, error, count } = await q;
    if (error) throw error;
    return { rows: rows ?? [], count: count ?? 0, page: data.page, pageSize: data.pageSize };
  });

export const getClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => idInput.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [clientRes, attachmentsRes, historyRes, ordersRes] = await Promise.all([
      supabase.from("clients").select("*").eq("id", data.id).maybeSingle(),
      supabase
        .from("client_attachments")
        .select("id, filename, mime, size, kind, storage_path, created_at")
        .eq("client_id", data.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("audit_log")
        .select("id, operation, actor, changed_at, old_data, new_data")
        .eq("table_name", "clients")
        .eq("record_id", data.id)
        .order("changed_at", { ascending: false })
        .limit(50),
      supabase
        .from("orders")
        .select("id, order_number, status, sale_price, created_at")
        .eq("client_id", data.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (clientRes.error) throw clientRes.error;
    if (!clientRes.data) throw new Error("Cliente não encontrado");

    return {
      client: clientRes.data,
      attachments: attachmentsRes.data ?? [],
      history: historyRes.data ?? [],
      orders: ordersRes.data ?? [],
    };
  });

export const createClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => clientSchema.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("clients")
      .insert({ ...data, created_by: userId })
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id };
  });

export const updateClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => clientSchema.extend({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error } = await context.supabase.from("clients").update(rest).eq("id", id);
    if (error) throw error;
    return { ok: true };
  });

export const softDeleteClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => idInput.parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("clients")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const restoreClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => idInput.parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("clients")
      .update({ deleted_at: null })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

const attachmentInput = z.object({
  client_id: z.string().uuid(),
  storage_path: z.string().min(1).max(500),
  filename: z.string().max(200).nullable().optional(),
  mime: z.string().max(120).nullable().optional(),
  size: z.number().int().nonnegative().nullable().optional(),
  kind: z.string().max(60).nullable().optional(),
});

export const addClientAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => attachmentInput.parse(v))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("client_attachments")
      .insert({ ...data, uploaded_by: context.userId })
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id };
  });

export const deleteClientAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid(), storage_path: z.string() }).parse(v))
  .handler(async ({ data, context }) => {
    await context.supabase.storage.from("client-files").remove([data.storage_path]);
    const { error } = await context.supabase.from("client_attachments").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const signAttachmentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ storage_path: z.string() }).parse(v))
  .handler(async ({ data, context }) => {
    const { data: signed, error } = await context.supabase.storage
      .from("client-files")
      .createSignedUrl(data.storage_path, 60 * 10);
    if (error) throw error;
    return { url: signed.signedUrl };
  });
