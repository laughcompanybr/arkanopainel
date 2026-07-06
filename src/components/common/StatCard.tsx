import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  accent?: "default" | "gold" | "success" | "warning";
  delay?: number;
}

const ACCENTS: Record<NonNullable<StatCardProps["accent"]>, string> = {
  default: "text-foreground",
  gold: "text-gold",
  success: "text-[color:var(--color-success)]",
  warning: "text-[color:var(--color-warning)]",
};

export function StatCard({ label, value, hint, icon: Icon, accent = "default", delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      className="glass-panel rounded-2xl p-5"
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
          {label}
        </p>
        {Icon ? (
          <div className="rounded-lg border border-border bg-secondary/50 p-1.5">
            <Icon className={cn("size-4", ACCENTS[accent])} />
          </div>
        ) : null}
      </div>
      <p className={cn("mt-4 font-display text-3xl leading-none", ACCENTS[accent])}>{value}</p>
      {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
    </motion.div>
  );
}
