
CREATE TABLE public.client_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  filename text,
  mime text,
  size bigint,
  kind text,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_attachments TO authenticated;
GRANT ALL ON public.client_attachments TO service_role;

ALTER TABLE public.client_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_attachments auth all" ON public.client_attachments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_client_attachments_client ON public.client_attachments(client_id, created_at DESC);

-- Storage policies for client-files bucket
CREATE POLICY "client-files read auth" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'client-files');

CREATE POLICY "client-files insert auth" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-files');

CREATE POLICY "client-files update auth" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'client-files');

CREATE POLICY "client-files delete auth" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'client-files');
