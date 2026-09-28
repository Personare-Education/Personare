import { Link } from "@tanstack/react-router";
import { BookOpen, CalendarDays } from "lucide-react";
import { useTranslation } from "react-i18next";
import AccountMenu from "@/components/account-menu";
import PersonareLogo from "@/components/personare-logo";
import { StreakWidget } from "@/components/streak-widget";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

const NAV_ITEMS = [
  { icon: BookOpen, labelKey: "navPrograms", to: "/" },
  { icon: CalendarDays, labelKey: "navCalendar", to: "/calendar" },
] as const;

export default function AppSidebar() {
  const { t } = useTranslation();
  const { toggleSidebar } = useSidebar();

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              aria-label="Toggle Sidebar"
              onClick={toggleSidebar}
              size="lg"
            >
              <div className="flex aspect-square size-8 items-center justify-center">
                <PersonareLogo className="size-6" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{t("appName")}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <TooltipProvider>
          <SidebarGroup>
            <SidebarGroupLabel>
              {t("navPlatformSectionLabel")}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_ITEMS.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild tooltip={t(item.labelKey)}>
                      <Link to={item.to}>
                        <item.icon />
                        <span>{t(item.labelKey)}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </TooltipProvider>
      </SidebarContent>
      <SidebarFooter>
        <StreakWidget />
        <AccountMenu />
      </SidebarFooter>
    </Sidebar>
  );
}
