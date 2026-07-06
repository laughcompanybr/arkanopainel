import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Registra na trilha de auditoria uma tentativa de acesso negada por RLS
 * (permission denied em is_staff_or_admin / has_role). Executado com a
 * identidade do usuário autenticado; grava actor + rota + detalhe técnico.
 *
 * Não lança erro se o insert falhar — a trilha é best-effort para não
 * quebrar o fluxo de UI de "Acesso restrito".
 */
export const logPermissionDenied = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      route: z.string().min(1).max(300),
      functionName: z.string().max(120).optional(),
      message: z.string().max(500).optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    try {
      const { supabaseAdmin } = await import(
        "@/integrations/supabase/client.server"
      );
      await supabaseAdmin.from("audit_log").insert({
        table_name: "access_denied",
        record_id: context.userId,
        operation: "INSERT",
        actor: context.userId,
        new_data: {
          kind: "permission_denied",
          route: data.route,
          function: data.functionName ?? null,
          message: data.message ?? null,
          at: new Date().toISOString(),
        },
      });
      return { logged: true } as const;
    } catch {
      return { logged: false } as const;
    }
  });
