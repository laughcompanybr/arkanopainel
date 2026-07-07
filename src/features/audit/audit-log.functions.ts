import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const auditFilterSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(10).max(100).default(30),
  route: z.string().trim().max(200).optional(),
  actor: z.string().trim().max(80).optional(),
  record_id: z.string().trim().max(80).optional(),
  table_name: z.string().trim().max(80).optional(),
  operation: z.string().trim().max(40).optional(),
  from: z.string().trim().max(10).optional(),
  to: z.string().trim().max(10).optional(),
  onlyReceipts: z.boolean().default(false),
});

export type AuditFilter = z.infer<typeof auditFilterSchema>;

export const listAuditLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => auditFilterSchema.parse(v ?? {}))
  .handler(async ({ data, context }) => {
    // Read policy already restricts to admins; a non-admin gets an empty result.
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;

    let q = context.supabase
      .from("audit_log")
      .select("id, table_name, record_id, operation, actor, old_data, new_data, changed_at", {
        count: "exact",
      })
      .order("changed_at", { ascending: false });

    if (data.table_name) q = q.eq("table_name", data.table_name);
    if (data.operation) q = q.eq("operation", data.operation);
    if (data.record_id) q = q.eq("record_id", data.record_id);
    if (data.actor) q = q.eq("actor", data.actor);
    if (data.from) q = q.gte("changed_at", `${data.from}T00:00:00.000Z`);
    if (data.to) q = q.lte("changed_at", `${data.to}T23:59:59.999Z`);
    if (data.onlyReceipts) q = q.eq("operation", "RECEIPT_ATTACHED");
    if (data.route) {
      // Route is stored in new_data->>route for receipt/manual entries
      q = q.filter("new_data->>route", "ilike", `%${data.route}%`);
    }

    const { data: rows, error, count } = await q.range(from, to);
    if (error) throw error;

    // enrich actor with profile name if available
    const actorIds = Array.from(
      new Set((rows ?? []).map((r) => r.actor).filter(Boolean) as string[]),
    );
    let actors: Record<string, string> = {};
    if (actorIds.length) {
      const { data: profiles } = await context.supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", actorIds);
      actors = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name ?? ""]));
    }
    return {
      rows: (rows ?? []).map((r) => ({ ...r, actor_name: r.actor ? actors[r.actor] ?? null : null })),
      total: count ?? 0,
      page: data.page,
      pageSize: data.pageSize,
    };
  });
