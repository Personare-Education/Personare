import { Settings } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import SettingsDialog from "@/components/settings-dialog";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Settings one click away, in the sidebar's footer, besides the account
 * menu (docs/specs/settings-in-sidebar.md). Collapsed, it is the gear with
 * a tooltip, like the other items.
 */
export default function SettingsSidebarItem() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const handleClick = useCallback(() => setOpen(true), []);

  return (
    <>
      {/* The footer sits outside the nav's TooltipProvider. */}
      <TooltipProvider>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleClick}
              tooltip={t("settingsPageTitle")}
            >
              <Settings />
              <span>{t("settingsPageTitle")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </TooltipProvider>
      <SettingsDialog onOpenChange={setOpen} open={open} />
    </>
  );
}
