-- 1. Ensure monthly_reports exists and has correct structure
CREATE TABLE IF NOT EXISTS public.monthly_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    month integer NOT NULL CHECK (month >= 1 AND month <= 12),
    year integer NOT NULL,
    observations text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(month, year)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_reports TO authenticated;
GRANT ALL ON public.monthly_reports TO service_role;
ALTER TABLE public.monthly_reports ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage monthly reports' AND tablename = 'monthly_reports') THEN
        CREATE POLICY "Users can manage monthly reports" ON public.monthly_reports
            USING (true);
    END IF;
END $$;

-- 2. Automatic updated_at trigger for monthly_reports
DROP TRIGGER IF EXISTS set_monthly_reports_updated_at ON public.monthly_reports;
CREATE TRIGGER set_monthly_reports_updated_at
  BEFORE UPDATE ON public.monthly_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
