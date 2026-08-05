ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS client_id uuid,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS responsible_id uuid,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tasks_client_id_fkey'
      AND conrelid = 'public.tasks'::regclass
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS tasks_client_id_idx ON public.tasks(client_id);
CREATE INDEX IF NOT EXISTS tasks_due_date_time_idx ON public.tasks(due_date, due_time);

UPDATE public.tasks
SET responsible_id = user_id
WHERE responsible_id IS NULL AND user_id IS NOT NULL;