import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  FolderOpen,
  Settings,
  LogOut,
  User as UserIcon,
  ChevronUp,
  Activity,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const items = [
  { title: "Projetos", url: "/projetos", icon: FolderOpen },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
  { title: "Diagnóstico", url: "/diagnostico", icon: Activity },
];

export function AppSidebar() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const currentPath = useRouterState({ select: (s) => s.location.pathname });

  const isActive = (path: string) => currentPath.startsWith(path);

  const email = user?.email ?? "";
  const nome =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    email.split("@")[0] ??
    "Usuário";
  const iniciais = nome
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Sidebar collapsible="none">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-5">
        <div className="flex flex-col">
          <span className="text-3xl font-bold leading-none tracking-tight text-sidebar-foreground">
            Nexo
          </span>
          <span className="text-xs uppercase tracking-[0.2em] text-sidebar-foreground/70 mt-1.5">
            Cotações
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    className="h-10"
                  >
                    <Link to={item.url} className="flex items-center gap-3">
                      <item.icon className="h-4 w-4" />
                      <span className="text-sm">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="h-12 data-[state=open]:bg-sidebar-accent">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs font-medium">
                      {iniciais || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col flex-1 min-w-0 text-left">
                    <span className="text-sm font-medium truncate text-sidebar-foreground">
                      {nome}
                    </span>
                    <span className="text-xs truncate text-sidebar-foreground/70">
                      {email}
                    </span>
                  </div>
                  <ChevronUp className="h-4 w-4 text-sidebar-foreground/70" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="end"
                className="w-56"
              >
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{nome}</span>
                    <span className="text-xs text-muted-foreground">
                      {email}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/perfil" })}>
                  <UserIcon className="h-4 w-4 mr-2" />
                  Meu perfil
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await signOut();
                    navigate({ to: "/login" });
                  }}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
