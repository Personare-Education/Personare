import type React from "react";
import AppSidebar from "@/components/app-sidebar";
import DragWindowRegion from "@/components/drag-window-region";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useSidebarAutoCollapse } from "@/hooks/use-sidebar-auto-collapse";

export default function BaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Collapsed to icons in a narrow window (docs/specs/audit-a11y.md AC-5).
  const { onOpenChange, open } = useSidebarAutoCollapse();

  return (
    <div className="flex h-svh flex-col">
      <DragWindowRegion />
      <SidebarProvider
        className="min-h-0 flex-1"
        onOpenChange={onOpenChange}
        open={open}
      >
        <AppSidebar />
        {/* The whole panel (its background and corners) is what slides in
            a stack navigation, see src/utils/stack-transition.ts. */}
        <SidebarInset className="stack-content">
          <main className="h-full overflow-y-auto p-2">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
