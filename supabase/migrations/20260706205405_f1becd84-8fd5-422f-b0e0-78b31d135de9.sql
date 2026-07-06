CREATE TABLE public.mfa_backup_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mfa_backup_codes TO authenticated;
GRANT ALL ON public.mfa_backup_codes TO service_role;

ALTER TABLE public.mfa_backup_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own backup codes"
ON public.mfa_backup_codes FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX mfa_backup_codes_user_active_idx
ON public.mfa_backup_codes(user_id)
WHERE used_at IS NULL;