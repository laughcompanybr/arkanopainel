import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("tasks")
      .select("*, clients(name)")
      .order("due_date", { ascending: true })
      .order("due_time", { ascending: true });
    if (error) throw error;
    return data;
  });

const taskFields = {
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  client_id: z.string().uuid().nullable().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_time: z.string().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  type: z.enum(['call', 'meeting', 'return', 'follow_up', 'proposal', 'other']),
};

const normalize = (data: any) => ({
  ...data,
  description: data.description?.trim() ? data.description : null,
  client_id: data.client_id || null,
  due_time: data.due_time?.trim() ? data.due_time : null,
});

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object(taskFields).parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("tasks")
      .insert({ ...normalize(data), user_id: context.userId, responsible_id: context.userId });
    if (error) throw error;
    return { ok: true };
  });

export const updateTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid(), ...taskFields }).parse(v))
  .handler(async ({ data, context }) => {
    const { id, ...fields } = data;
    const { error } = await (context.supabase as any)
      .from("tasks")
      .update(normalize(fields))
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("tasks").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const updateTaskStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({
    id: z.string().uuid(),
    status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
  }).parse(v))
  .handler(async ({ data, context }) => {
    const updates: any = { status: data.status };
    updates.completed_at = data.status === 'completed' ? new Date().toISOString() : null;
    const { error } = await (context.supabase as any)
      .from("tasks")
      .update(updates)
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

