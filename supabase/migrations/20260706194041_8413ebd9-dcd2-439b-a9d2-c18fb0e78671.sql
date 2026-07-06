
ALTER FUNCTION public.tg_set_updated_at() SET search_path = public;

CREATE POLICY "order-files auth read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'order-files');
CREATE POLICY "order-files auth insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'order-files');
CREATE POLICY "order-files auth update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'order-files');
CREATE POLICY "order-files auth delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'order-files');
