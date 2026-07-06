
-- 1) Helper role predicate
CREATE OR REPLACE FUNCTION public.is_staff_or_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('staff','admin')
  );
$$;

-- Lock down SECURITY DEFINER function execution
REVOKE EXECUTE ON FUNCTION public.is_staff_or_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff_or_admin(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_order_event() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_audit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;

-- 2) Tighten business tables — staff/admin only
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clients','orders','suppliers','payments','expenses',
    'order_events','order_attachments','client_attachments'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s auth all" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "clients auth all" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "orders auth all" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "suppliers auth all" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "payments auth all" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "expenses auth all" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "order_events auth all" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "attachments auth all" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "client_attachments auth all" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "staff manage %s" ON public.%I FOR ALL TO authenticated USING (public.is_staff_or_admin(auth.uid())) WITH CHECK (public.is_staff_or_admin(auth.uid()))',
      t, t
    );
  END LOOP;
END $$;

-- 3) app_settings SELECT restricted to staff/admin
DROP POLICY IF EXISTS "Authenticated can read settings" ON public.app_settings;
CREATE POLICY "Staff read settings" ON public.app_settings
  FOR SELECT TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));

-- 4) user_roles: prevent privilege escalation — only admins can write
DROP POLICY IF EXISTS "Admins manage user_roles" ON public.user_roles;
CREATE POLICY "Admins insert user_roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update user_roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete user_roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5) Storage buckets — staff/admin only
DROP POLICY IF EXISTS "client-files read auth" ON storage.objects;
DROP POLICY IF EXISTS "client-files insert auth" ON storage.objects;
DROP POLICY IF EXISTS "client-files update auth" ON storage.objects;
DROP POLICY IF EXISTS "client-files delete auth" ON storage.objects;
DROP POLICY IF EXISTS "order-files auth read" ON storage.objects;
DROP POLICY IF EXISTS "order-files auth insert" ON storage.objects;
DROP POLICY IF EXISTS "order-files auth update" ON storage.objects;
DROP POLICY IF EXISTS "order-files auth delete" ON storage.objects;

CREATE POLICY "client-files staff read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'client-files' AND public.is_staff_or_admin(auth.uid()));
CREATE POLICY "client-files staff insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-files' AND public.is_staff_or_admin(auth.uid()));
CREATE POLICY "client-files staff update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'client-files' AND public.is_staff_or_admin(auth.uid()));
CREATE POLICY "client-files staff delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'client-files' AND public.is_staff_or_admin(auth.uid()));

CREATE POLICY "order-files staff read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'order-files' AND public.is_staff_or_admin(auth.uid()));
CREATE POLICY "order-files staff insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'order-files' AND public.is_staff_or_admin(auth.uid()));
CREATE POLICY "order-files staff update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'order-files' AND public.is_staff_or_admin(auth.uid()));
CREATE POLICY "order-files staff delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'order-files' AND public.is_staff_or_admin(auth.uid()));
