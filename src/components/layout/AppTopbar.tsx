import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { LogOut, Search, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { CommandPalette } from "./CommandPalette";
import { Breadcrumbs } from "./Breadcrumbs";
import { ThemeToggle } from "@/components/common/ThemeToggle";

export function AppTopbar({ userEmail }: { userEmail: string }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const initials = userEmail.slice(0, 2).toUpperCase();

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Sessão encerrada");
    navigate({ to: "/auth", replace: true });
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/70 px-4 backdrop-blur-xl">
      <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
      <div className="mx-2 hidden h-5 w-px bg-border md:block" />
      <Breadcrumbs />
      <button
        onClick={() => setPaletteOpen(true)}
        className="group ml-auto hidden h-9 w-full max-w-xs items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 text-left text-sm text-muted-foreground transition-colors hover:border-gold/40 hover:bg-secondary md:flex lg:max-w-sm"
      >
        <Search className="size-4" />
        <span className="flex-1 truncate">Buscar…</span>
        <kbd className="rounded border border-border bg-background/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </button>
      <div className="ml-auto flex items-center gap-1 md:ml-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setPaletteOpen(true)}
          aria-label="Buscar"
          className="h-9 w-9 text-muted-foreground md:hidden"
        >
          <Search className="size-4" />
        </Button>
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 px-2">
              <Avatar className="size-7">
                <AvatarFallback className="bg-secondary text-[11px] text-gold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm text-muted-foreground md:inline">
                {userEmail}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {userEmail}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate({ to: "/configuracoes" })}>
              <UserIcon className="mr-2 size-4" /> Perfil e preferências
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
              <LogOut className="mr-2 size-4" /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
  );
}
