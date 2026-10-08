import { ChevronsUpDown, Settings } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getSession } from "@/actions/auth";
import SettingsDialog from "@/components/settings-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

interface Session {
  avatarUrl: string | null;
  email: string;
  id: string;
  name: string;
}

export default function AccountMenu() {
  const { t } = useTranslation();
  const { isMobile } = useSidebar();
  const [session, setSession] = useState<Session | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const refreshSession = useCallback(() => {
    getSession().then(setSession);
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const handleDropdownOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        refreshSession();
      }
    },
    [refreshSession]
  );

  const handleSettingsClick = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const displayName = session?.name ?? t("accountMenuGuestLabel");
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu onOpenChange={handleDropdownOpenChange}>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                size="lg"
              >
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage
                    alt={displayName}
                    src={session?.avatarUrl ?? undefined}
                  />
                  <AvatarFallback className="rounded-lg">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-start text-sm leading-tight">
                  <span className="truncate font-medium">{displayName}</span>
                  <span className="truncate text-xs">
                    {session?.email ?? t("appName")}
                  </span>
                </div>
                <ChevronsUpDown className="ms-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
              side={isMobile ? "bottom" : "top"}
              sideOffset={4}
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-start text-sm">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage
                      alt={displayName}
                      src={session?.avatarUrl ?? undefined}
                    />
                    <AvatarFallback className="rounded-lg">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-start text-sm leading-tight">
                    <span className="truncate font-medium">{displayName}</span>
                    <span className="truncate text-xs">
                      {session?.email ?? t("appName")}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSettingsClick}>
                <Settings />
                {t("settingsPageTitle")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
      <SettingsDialog onOpenChange={setIsSettingsOpen} open={isSettingsOpen} />
    </>
  );
}
