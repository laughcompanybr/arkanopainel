-- Garantir que todas as permissões básicas estão aplicadas corretamente de forma idempotente
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT table_name 
             FROM information_schema.tables 
             WHERE table_schema = 'public' 
             AND table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
        EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    END LOOP;
END $$;

-- Verificar e habilitar RLS em tabelas que possam ter sido criadas sem ele
ALTER TABLE IF EXISTS public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.monthly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.client_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.client_interactions ENABLE ROW LEVEL SECURITY;
