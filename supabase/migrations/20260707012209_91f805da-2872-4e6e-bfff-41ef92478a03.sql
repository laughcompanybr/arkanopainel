
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- Storage policies for finance-receipts (private bucket)
DROP POLICY IF EXISTS "finance-receipts read" ON storage.objects;
CREATE POLICY "finance-receipts read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'finance-receipts');

DROP POLICY IF EXISTS "finance-receipts insert" ON storage.objects;
CREATE POLICY "finance-receipts insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'finance-receipts');

DROP POLICY IF EXISTS "finance-receipts update" ON storage.objects;
CREATE POLICY "finance-receipts update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'finance-receipts');

DROP POLICY IF EXISTS "finance-receipts delete" ON storage.objects;
CREATE POLICY "finance-receipts delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'finance-receipts');
