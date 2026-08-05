-- Garantir que as colunas existam com tipos básicos antes de qualquer lógica complexa
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS client_id uuid;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS type text DEFAULT 'other';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS responsible_id uuid;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Adicionar constraints de chave estrangeira com verificação de existência
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

-- Índices idempotentes
CREATE INDEX IF NOT EXISTS tasks_client_id_idx ON public.tasks(client_id);
CREATE INDEX IF NOT EXISTS tasks_due_date_time_idx ON public.tasks(due_date, due_time);

-- Sincronização de segurança entre colunas de dono/responsável
UPDATE public.tasks
SET responsible_id = user_id
WHERE responsible_id IS NULL AND user_id IS NOT NULL;
