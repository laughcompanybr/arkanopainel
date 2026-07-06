import { PageHeader } from "@/components/common/PageHeader";
import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";

interface ComingSoonProps {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}

export function ComingSoon({ eyebrow, title, description, children }: ComingSoonProps) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <div className="glass-panel flex min-h-[360px] flex-col items-center justify-center rounded-3xl p-10 text-center">
        <div className="rounded-2xl border border-border bg-secondary/50 p-4">
          <Sparkles className="size-6 text-gold" />
        </div>
        <h2 className="mt-6 font-display text-2xl">Em construção</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Este módulo faz parte da próxima fase de entrega. A fundação
          (banco, autenticação, permissões e design system) já está pronta para receber a UI completa.
        </p>
        {children}
      </div>
    </>
  );
}
