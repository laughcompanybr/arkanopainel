import logo from "@/assets/arkano-logo.jpg";
import { cn } from "@/lib/utils";

interface ArkanoLogoProps {
  size?: number;
  className?: string;
  showWordmark?: boolean;
}

export function ArkanoLogo({ size = 36, className, showWordmark = true }: ArkanoLogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <img
        src={logo}
        alt="Arkano Club"
        width={size}
        height={size}
        className="rounded-lg ring-1 ring-border object-cover"
        style={{ width: size, height: size }}
      />
      {showWordmark ? (
        <div className="flex flex-col leading-none">
          <span className="font-display text-lg tracking-wide text-foreground">Arkano</span>
          <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Club
          </span>
        </div>
      ) : null}
    </div>
  );
}
