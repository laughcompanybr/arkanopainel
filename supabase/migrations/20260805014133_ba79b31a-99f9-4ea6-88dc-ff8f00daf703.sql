
CREATE TABLE IF NOT EXISTS public.monthly_report_overrides (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    month integer NOT NULL CHECK (month >= 1 AND month <= 12),
    year integer NOT NULL,
    revenue_override numeric,
    expenses_override numeric,
    profit_override numeric,
    orders_count_override integer,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(month, year)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_report_overrides TO authenticated;
GRANT ALL ON public.monthly_report_overrides TO service_role;

ALTER TABLE public.monthly_report_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage monthly overrides"
ON public.monthly_report_overrides
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
