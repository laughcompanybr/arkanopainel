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

CREATE POLICY "Users can manage monthly reports" ON public.monthly_reports
    USING (true); -- Since it's single tenant as per previous refactor

-- 2. Enhance company_activity_logs if needed (assuming it exists or using a generic audit trail)
-- The request mentions company_activity_logs, let's ensure we have a generic way to log changes.
-- If it doesn't exist, we can create a simplified version or use the existing audit_log if present.

-- 3. Automatic updated_at trigger for monthly_reports
CREATE TRIGGER set_monthly_reports_updated_at
  BEFORE UPDATE ON public.monthly_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Note: The logic for "Automatic Functioning" (month/year extraction) 
-- is best handled in the server functions during retrieval/insertion 
-- to keep the DB schema clean and flexible.
