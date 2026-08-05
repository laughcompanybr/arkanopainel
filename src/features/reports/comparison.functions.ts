import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { fetchMonthlyReport, type MonthlyReportData } from "./monthly.functions";

export interface ComparisonData {
  m1: MonthlyReportData;
  m2: MonthlyReportData;
  diff: {
    revenue: number;
    revenuePerc: number;
    profit: number;
    profitPerc: number;
    expenses: number;
    expensesPerc: number;
    orders: number;
    ordersPerc: number;
  };
}

export const compareMonthlyReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => 
    z.object({
      m1: z.object({ month: z.number(), year: z.number() }),
      m2: z.object({ month: z.number(), year: z.number() })
    }).parse(data)
  )
  .handler(async ({ data, context }): Promise<ComparisonData> => {
    const { supabase } = context;
    
    const [report1, report2] = await Promise.all([
      fetchMonthlyReport(supabase, data.m1.month, data.m1.year),
      fetchMonthlyReport(supabase, data.m2.month, data.m2.year)
    ]);

    const calcDiff = (v1: number, v2: number) => {
      const diff = v2 - v1;
      const perc = v1 === 0 ? (v2 === 0 ? 0 : 100) : (diff / Math.abs(v1)) * 100;
      return { diff, perc };
    };

    const rev = calcDiff(report1.revenue, report2.revenue);
    const prof = calcDiff(report1.profit, report2.profit);
    const exp = calcDiff(report1.expenses, report2.expenses);
    const ord = calcDiff(report1.ordersCount, report2.ordersCount);

    return {
      m1: report1,
      m2: report2,
      diff: {
        revenue: rev.diff,
        revenuePerc: rev.perc,
        profit: prof.diff,
        profitPerc: prof.perc,
        expenses: exp.diff,
        expensesPerc: exp.perc,
        orders: ord.diff,
        ordersPerc: ord.perc
      }
    };
  });
