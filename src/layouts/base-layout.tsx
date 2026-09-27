import type React from "react";
import AppSidebar from "@/components/app-sidebar";
import DragWindowRegion from "@/components/drag-window-region";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function BaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-svh flex-col">
      <DragWindowRegion />
      <SidebarProvider className="min-h-0 flex-1">
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
