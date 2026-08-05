CREATE TABLE IF NOT EXISTS public.monthly_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    year INTEGER NOT NULL,
    observations TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (month, year)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_reports TO authenticated;
GRANT ALL ON public.monthly_reports TO service_role;

ALTER TABLE public.monthly_reports ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated users to manage monthly reports' AND tablename = 'monthly_reports'
    ) THEN
        CREATE POLICY "Allow authenticated users to manage monthly reports"
        ON public.monthly_reports
        FOR ALL
        TO authenticated
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;
