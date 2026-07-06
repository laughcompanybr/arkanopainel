import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Loader2, ShieldCheck, KeyRound } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { AuthHero } from "@/components/auth/AuthHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { consumeBackupCode } from "@/lib/mfa.functions";

export const Route = createFileRoute("/mfa-verify")({
  ssr: false,
  component: MfaVerifyPage,
});

function MfaVerifyPage() {
  const navigate = useNavigate();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"totp" | "backup">("totp");
  const [backupCode, setBackupCode] = useState("");
  const consumeFn = useServerFn(consumeBackupCode);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === "aal2" || aal?.nextLevel !== "aal2") {
        navigate({ to: "/dashboard", replace: true });
        return;
      }
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.find((f) => f.status === "verified");
      if (!totp) {
        navigate({ to: "/dashboard", replace: true });
        return;
      }
      const { data: c, error } = await supabase.auth.mfa.challenge({ factorId: totp.id });
      if (cancelled) return;
      if (error || !c) {
        toast.error("Falha ao iniciar verificação", { description: error?.message });
        navigate({ to: "/auth", replace: true });
        return;
      }
      setFactorId(totp.id);
      setChallengeId(c.id);
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const verifyTotp = async () => {
    if (!factorId || !challengeId || code.length !== 6) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code });
    setBusy(false);
    if (error) {
      toast.error("Código incorreto", { description: error.message });
      setCode("");
      return;
    }
    toast.success("Verificado");
    navigate({ to: "/dashboard", replace: true });
  };

  const useBackup = async () => {
    if (backupCode.trim().length < 6) return;
    setBusy(true);
    try {
      await consumeFn({ data: { code: backupCode.trim() } });
      toast.success("Acesso restaurado", {
        description: "Reative o 2FA nas configurações.",
      });
      navigate({ to: "/dashboard", replace: true });
    } catch (e) {
      toast.error("Código inválido", { description: (e as Error).message });
      setBackupCode("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthHero
      eyebrow="Segurança"
      title="Confirme sua"
      highlight="identidade."
      tagline="Insira o código de 6 dígitos do seu aplicativo autenticador para acessar o painel."
    >
      <div className="bento-tile p-7 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full border border-gold/40 bg-gold/10">
            <ShieldCheck className="size-5 text-gold" />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-gold">
              Verificação em duas etapas
            </p>
            <h2 className="mt-0.5 font-display text-2xl leading-tight">
              {mode === "totp" ? "Insira o código" : "Código de recuperação"}
            </h2>
          </div>
        </div>

        {mode === "totp" ? (
          <motion.div
            key="totp"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label
                htmlFor="totp-code"
                className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
              >
                Código de 6 dígitos
              </Label>
              <Input
                id="totp-code"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => e.key === "Enter" && verifyTotp()}
                className="h-14 text-center font-mono text-2xl tracking-[0.5em]"
                autoFocus
              />
            </div>
            <Button
              className="h-11 w-full"
              onClick={verifyTotp}
              disabled={busy || code.length !== 6 || !factorId}
            >
              {busy ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
              Verificar
            </Button>
            <button
              type="button"
              className="mx-auto flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-gold"
              onClick={() => setMode("backup")}
            >
              <KeyRound className="size-3.5" /> Usar código de recuperação
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="backup"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <p className="text-sm text-muted-foreground">
              Insira um dos códigos de recuperação salvos ao ativar o 2FA. Ele funciona
              uma única vez e desativa a 2FA — você poderá reativá-la em seguida.
            </p>
            <div className="space-y-1.5">
              <Label
                htmlFor="backup-code"
                className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
              >
                Código de recuperação
              </Label>
              <Input
                id="backup-code"
                value={backupCode}
                onChange={(e) => setBackupCode(e.target.value)}
                placeholder="XXXX-XXXX"
                className="h-12 text-center font-mono tracking-widest uppercase"
                onKeyDown={(e) => e.key === "Enter" && useBackup()}
              />
            </div>
            <Button className="h-11 w-full" onClick={useBackup} disabled={busy}>
              {busy ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
              Restaurar acesso
            </Button>
            <button
              type="button"
              className="mx-auto flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-gold"
              onClick={() => setMode("totp")}
            >
              Voltar para o código do app
            </button>
          </motion.div>
        )}
      </div>
    </AuthHero>
  );
}
