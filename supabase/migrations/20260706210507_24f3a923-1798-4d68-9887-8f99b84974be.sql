-- Garante EXECUTE para funções SECURITY DEFINER usadas nas policies RLS.
-- Sem estes grants, PostgREST retorna "permission denied for function ...".
GRANT EXECUTE ON FUNCTION public.is_staff_or_admin(uuid)
  TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)
  TO authenticated, service_role;

-- Validação leve: chamar as funções como superuser não deve levantar erro
-- (retorna false para um uuid inexistente). Falha o migration se algo estiver quebrado.
DO $$
BEGIN
  PERFORM public.is_staff_or_admin('00000000-0000-0000-0000-000000000000'::uuid);
  PERFORM public.has_role('00000000-0000-0000-0000-000000000000'::uuid, 'admin'::public.app_role);
END $$;

NOTIFY pgrst, 'reload schema';