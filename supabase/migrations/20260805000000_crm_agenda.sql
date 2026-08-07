-- 1. Enums and Types
CREATE TYPE public.client_status AS ENUM ('lead', 'prospect', 'active', 'inactive', 'lost');
CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE public.task_type AS ENUM ('call', 'meeting', 'return', 'follow_up', 'proposal', 'other');

-- 2. Enhance Clients Table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS status public.client_status DEFAULT 'lead' NOT NULL;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS responsible_id uuid REFERENCES auth.users(id);
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS last_interaction_at timestamptz;

-- 3. Client Tags Table
CREATE TABLE public.client_tags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    tag text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT, DELETE ON public.client_tags TO authenticated;
GRANT ALL ON public.client_tags TO service_role;
ALTER TABLE public.client_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage tags for their clients" ON public.client_tags
    USING (EXISTS (SELECT 1 FROM public.clients WHERE id = client_tags.client_id));

-- 4. Client Interactions / Timeline
CREATE TABLE public.client_interactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    type text NOT NULL, -- 'note', 'status_change', 'system_event'
    message text,
    actor_id uuid REFERENCES auth.users(id),
    meta jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT ON public.client_interactions TO authenticated;
GRANT ALL ON public.client_interactions TO service_role;
ALTER TABLE public.client_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view interactions for their clients" ON public.client_interactions
    USING (EXISTS (SELECT 1 FROM public.clients WHERE id = client_interactions.client_id));

-- 5. Tasks / Agenda
CREATE TABLE public.tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text,
    client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
    responsible_id uuid REFERENCES auth.users(id) NOT NULL,
    due_date date NOT NULL,
    due_time time,
    priority public.task_priority DEFAULT 'medium' NOT NULL,
    status public.task_status DEFAULT 'pending' NOT NULL,
    type public.task_type DEFAULT 'other' NOT NULL,
    completed_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their tasks" ON public.tasks
    USING (responsible_id = auth.uid());

CREATE POLICY "Users can view tasks for their clients" ON public.tasks
    USING (EXISTS (SELECT 1 FROM public.clients WHERE id = tasks.client_id));

-- 6. Trigger for updated_at on tasks
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 7. Audit log trigger for client status changes (optional but good)
CREATE OR REPLACE FUNCTION public.log_client_interaction()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.client_interactions (client_id, type, message, actor_id, meta)
    VALUES (NEW.id, 'status_change', 'Status alterado de ' || OLD.status || ' para ' || NEW.status, auth.uid(), jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_client_status_change
  AFTER UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.log_client_interaction();
