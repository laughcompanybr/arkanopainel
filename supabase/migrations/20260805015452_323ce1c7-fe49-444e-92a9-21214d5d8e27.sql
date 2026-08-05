
-- Adicionar coluna de versão para optimistic locking
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS version integer DEFAULT 1 NOT NULL;

-- Criar tabela de auditoria para campos sensíveis (como due_time)
CREATE TABLE IF NOT EXISTS public.tasks_audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
    field_name text NOT NULL,
    old_value text,
    new_value text,
    changed_by uuid REFERENCES auth.users(id),
    changed_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT ON public.tasks_audit_log TO authenticated;
GRANT ALL ON public.tasks_audit_log TO service_role;

-- Trigger para registrar alterações no due_time
CREATE OR REPLACE FUNCTION public.audit_task_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Incrementar versão para optimistic locking se qualquer campo mudar
    NEW.version = OLD.version + 1;

    -- Auditoria específica para due_time
    IF (OLD.due_time IS DISTINCT FROM NEW.due_time) THEN
        INSERT INTO public.tasks_audit_log (task_id, field_name, old_value, new_value, changed_by)
        VALUES (NEW.id, 'due_time', OLD.due_time::text, NEW.due_time::text, auth.uid());
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_audit_task_changes ON public.tasks;
CREATE TRIGGER tr_audit_task_changes
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_task_changes();
