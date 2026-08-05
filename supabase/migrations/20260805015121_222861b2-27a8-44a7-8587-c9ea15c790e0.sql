ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS due_time time;
GRANT ALL ON public.tasks TO authenticated, service_role;