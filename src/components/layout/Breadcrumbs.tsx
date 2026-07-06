import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";
import { NAV_ITEMS } from "./nav-config";

const STATIC_LABELS: Record<string, string> = {
  "reset-password": "Redefinir senha",
  auth: "Acesso",
  novo: "Novo",
  editar: "Editar",
};

function labelForSegment(segment: string, fullPath: string): string {
  const nav = NAV_ITEMS.find((n) => n.to === fullPath);
  if (nav) return nav.title;
  if (STATIC_LABELS[segment]) return STATIC_LABELS[segment];
  // fallback: capitalize
  return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
}

export function Breadcrumbs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs = segments.map((segment, i) => {
    const to = "/" + segments.slice(0, i + 1).join("/");
    return { segment, to, label: labelForSegment(segment, to) };
  });

  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-xs text-muted-foreground md:flex">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
      >
        <Home className="size-3.5" />
      </Link>
      {crumbs.map((c, idx) => {
        const last = idx === crumbs.length - 1;
        return (
          <span key={c.to} className="flex min-w-0 items-center gap-1.5">
            <ChevronRight className="size-3 shrink-0 text-muted-foreground/50" />
            {last ? (
              <span className="truncate font-medium text-foreground">{c.label}</span>
            ) : (
              <Link
                to={c.to}
                className="truncate transition-colors hover:text-foreground"
              >
                {c.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
