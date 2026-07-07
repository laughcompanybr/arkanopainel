
-- Manual financial movements (entradas/saídas/contas a pagar/receber)
DO $$ BEGIN
  CREATE TYPE public.fin_direction AS ENUM ('in','out');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.fin_tx_status AS ENUM ('pending','paid','overdue','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  direction public.fin_direction NOT NULL,
  status public.fin_tx_status NOT NULL DEFAULT 'paid',
  description TEXT NOT NULL,
  category TEXT,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  method TEXT,
  due_date DATE,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_transactions TO authenticated;
GRANT ALL ON public.financial_transactions TO service_role;

ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage financial_transactions" ON public.financial_transactions;
CREATE POLICY "Staff manage financial_transactions" ON public.financial_transactions
  FOR ALL TO authenticated
  USING (public.is_staff_or_admin(auth.uid()))
  WITH CHECK (public.is_staff_or_admin(auth.uid()));

DROP TRIGGER IF EXISTS set_updated_at ON public.financial_transactions;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS audit_financial_transactions ON public.financial_transactions;
CREATE TRIGGER audit_financial_transactions
  AFTER INSERT OR UPDATE OR DELETE ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit();

CREATE INDEX IF NOT EXISTS idx_fin_tx_paid_at ON public.financial_transactions(paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_fin_tx_due_date ON public.financial_transactions(due_date);
CREATE INDEX IF NOT EXISTS idx_fin_tx_status ON public.financial_transactions(status);
