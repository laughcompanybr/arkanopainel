-- Migration to ensure tasks table has user_id and fix permissions
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    due_date DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure user_id column exists (alias for ownership if needed)
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- If responsible_id exists, we can sync them or just ensure both are usable
-- Given the current app state, we'll make sure user_id is populated if empty and responsible_id exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'responsible_id') THEN
        UPDATE public.tasks SET user_id = responsible_id WHERE user_id IS NULL AND responsible_id IS NOT NULL;
    END IF;
END $$;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own tasks' AND tablename = 'tasks') THEN
        CREATE POLICY "Users can manage their own tasks"
        ON public.tasks
        FOR ALL
        TO authenticated
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;
