
-- Create enum if not exists (checked in case previous failed midway)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_priority') THEN
        CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_type') THEN
        CREATE TYPE task_type AS ENUM ('call', 'meeting', 'return', 'follow_up', 'proposal', 'other');
    END IF;
END $$;

-- Add missing columns to tasks
ALTER TABLE public.tasks 
    ADD COLUMN IF NOT EXISTS priority task_priority DEFAULT 'medium',
    ADD COLUMN IF NOT EXISTS type task_type DEFAULT 'other';

-- Ensure permissions
GRANT ALL ON public.tasks TO authenticated, service_role;
GRANT SELECT ON public.tasks TO anon;
