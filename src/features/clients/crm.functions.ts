import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const idInput = z.object({ id: z.string().uuid() });

export const getClientCRM = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => idInput.parse(v))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    
    const [clientRes, interactionsRes, tasksRes, ordersRes, tagsRes] = await Promise.all([
      supabase.from("clients").select("*").eq("id", data.id).maybeSingle(),
      supabase.from("client_interactions").select("*").eq("client_id", data.id).order("created_at", { ascending: false }),
      supabase.from("tasks").select("*").eq("client_id", data.id).order("due_date", { ascending: false }),
      supabase.from("orders").select("*").eq("client_id", data.id).is("deleted_at", null).order("created_at", { ascending: false }),
      supabase.from("client_tags").select("tag").eq("client_id", data.id)
    ]);

    if (clientRes.error) throw clientRes.error;
    if (!clientRes.data) throw new Error("Cliente não encontrado");

    const orders = ordersRes.data ?? [];
    const totalSpent = orders.reduce((sum: number, o: any) => sum + (Number(o.sale_price) * (Number(o.quantity) || 1)), 0);

    return {
      client: clientRes.data,
      interactions: interactionsRes.data ?? [],
      tasks: tasksRes.data ?? [],
      orders: orders,
      tags: (tagsRes.data as any[] ?? []).map(t => t.tag),
      commercial: {
        totalSpent,
      }
    };
  });

export const addInteraction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({
    client_id: z.string().uuid(),
    type: z.string(),
    message: z.string().min(1),
    meta: z.record(z.any()).optional()
  }).parse(v))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const { error } = await supabase
      .from("client_interactions")
      .insert({ ...data, actor_id: context.userId });
    if (error) throw error;
    return { ok: true };
  });

export const updateClientCRM = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({
    id: z.string().uuid(),
    status: z.enum(['lead', 'prospect', 'active', 'inactive', 'lost']).optional(),
    responsible_id: z.string().uuid().nullable().optional(),
    source: z.string().nullable().optional(),
    company_name: z.string().nullable().optional(),
  }).parse(v))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const { id, ...rest } = data;
    const { error } = await supabase.from("clients").update(rest).eq("id", id);
    if (error) throw error;
    return { ok: true };
  });
