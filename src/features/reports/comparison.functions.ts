import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const compareMonthlyReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => 
    z.object({
      m1: z.object({ month: z.number(), year: z.number() }),
      m2: z.object({ month: z.number(), year: z.number() })
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    // This will be implemented to return detailed comparison data
    return { success: true, data: {} };
  });
