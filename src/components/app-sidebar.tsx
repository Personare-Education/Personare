import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, CalendarDays, Sunrise } from "lucide-react";
import { useTranslation } from "react-i18next";
import AccountMenu from "@/components/account-menu";
import PersonareLogo from "@/components/personare-logo";
import { RankWidget } from "@/components/rank-widget";
import { StreakWidget } from "@/components/streak-widget";
import { useDirection } from "@/components/ui/direction";
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
import { useDueCount } from "@/hooks/use-due-count";

// Today first: the app opens on it (docs/specs/today-review-queue.md AC-1).
const NAV_ITEMS = [
  { icon: Sunrise, labelKey: "navToday", to: "/" },
  { icon: BookOpen, labelKey: "navPrograms", to: "/programs" },
  { icon: CalendarDays, labelKey: "navCalendar", to: "/calendar" },
] as const;

/**
 * Whether a nav item is the current page (docs/specs/sidebar-current-page.md):
 * Today only at "/", the others at their path and anything below it.
 */
export function isCurrentNavItem(to: string, pathname: string): boolean {
  if (to === "/") {
    return pathname === "/";
  }
  return pathname === to || pathname.startsWith(`${to}/`);
}

export default function AppSidebar() {
  const { t } = useTranslation();
  const { toggleSidebar } = useSidebar();
  // At the reading start: on the right for Arabic
  // (docs/specs/settings-language-text-size-version.md AC-5).
  const side = useDirection() === "rtl" ? "right" : "left";
  const dueCount = useDueCount();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <Sidebar collapsible="icon" side={side} variant="inset">
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
              <div className="grid flex-1 text-start text-sm leading-tight">
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
                    <SidebarMenuButton
                      asChild
                      isActive={isCurrentNavItem(item.to, pathname)}
                      tooltip={t(item.labelKey)}
                    >
                      <Link to={item.to}>
                        <item.icon />
                        <span>{t(item.labelKey)}</span>
                        {item.to === "/" && dueCount > 0 ? (
                          <span className="ms-auto rounded-full bg-brand px-1.5 font-medium text-[0.6875rem] text-white tabular-nums leading-5">
                            {dueCount}
                          </span>
                        ) : null}
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
        <RankWidget />
        <AccountMenu />
      </SidebarFooter>
    </Sidebar>
  );
}
