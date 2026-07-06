import { createServerFn } from "@tanstack/react-start";
import { createHash, randomBytes } from "node:crypto";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Hash used to store recovery codes at rest. */
function hashCode(raw: string) {
  return createHash("sha256").update(raw.trim().toLowerCase()).digest("hex");
}

/** 10 short alphanumeric codes, e.g. `A3F9-K21X`. */
function newCodes(): string[] {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    const buf = randomBytes(8);
    let out = "";
    for (let b = 0; b < 8; b++) out += alphabet[buf[b] % alphabet.length];
    codes.push(`${out.slice(0, 4)}-${out.slice(4)}`);
  }
  return codes;
}

/**
 * Replaces the caller's unused backup codes with a fresh batch of 10.
 * Returns the plain-text codes ONCE — the client must display them
 * immediately; the server only stores their SHA-256 hashes.
 */
export const regenerateBackupCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const codes = newCodes();

    // Wipe previous unused codes for this user (used ones stay for audit).
    const { error: delErr } = await supabase
      .from("mfa_backup_codes")
      .delete()
      .eq("user_id", userId)
      .is("used_at", null);
    if (delErr) throw delErr;

    const rows = codes.map((c) => ({ user_id: userId, code_hash: hashCode(c) }));
    const { error: insErr } = await supabase.from("mfa_backup_codes").insert(rows);
    if (insErr) throw insErr;

    return { codes };
  });

/**
 * Consumes a recovery code. On success the code is marked used AND every
 * MFA factor for the account is unenrolled server-side (admin API), so the
 * user regains access with password-only and can re-enroll TOTP after.
 */
export const consumeBackupCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => {
    if (!input?.code || typeof input.code !== "string" || input.code.length < 6) {
      throw new Error("Código inválido");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const target = hashCode(data.code);

    const { data: match, error: findErr } = await supabase
      .from("mfa_backup_codes")
      .select("id")
      .eq("user_id", userId)
      .eq("code_hash", target)
      .is("used_at", null)
      .limit(1)
      .maybeSingle();
    if (findErr) throw findErr;
    if (!match) throw new Error("Código inválido ou já utilizado");

    const { error: updErr } = await supabase
      .from("mfa_backup_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("id", match.id);
    if (updErr) throw updErr;

    // Unenroll every MFA factor via admin API so the user can sign in with
    // password alone until they re-enroll. Loading admin client inside the
    // handler keeps it out of the client bundle graph.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: fRes, error: fErr } = await supabaseAdmin.auth.admin.mfa.listFactors({ userId });
    if (fErr) throw fErr;
    const factors = fRes?.factors ?? [];
    for (const f of factors) {
      await supabaseAdmin.auth.admin.mfa.deleteFactor({ userId, id: f.id });
    }

    return { ok: true, removedFactors: factors.length };
  });

/** Number of unused recovery codes remaining for the caller. */
export const remainingBackupCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { count, error } = await supabase
      .from("mfa_backup_codes")
      .select("id", { head: true, count: "exact" })
      .eq("user_id", userId)
      .is("used_at", null);
    if (error) throw error;
    return { remaining: count ?? 0 };
  });
