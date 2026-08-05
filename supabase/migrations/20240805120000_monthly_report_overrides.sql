CREATE TABLE IF NOT EXISTS public.monthly_report_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    year INTEGER NOT NULL,
    revenue_override NUMERIC,
    expenses_override NUMERIC,
    profit_override NUMERIC,
    orders_count_override INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(month, year)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_report_overrides TO authenticated;
GRANT ALL ON public.monthly_report_overrides TO service_role;

ALTER TABLE public.monthly_report_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own monthly overrides"
ON public.monthly_report_overrides
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
