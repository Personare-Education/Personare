import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  resolveProgramColor,
  resolveProgramIcon,
} from "@/constants/program-appearance";

interface OrganizeHeaderProps {
  /** The screen's create button. */
  action?: ReactNode;
  /** The program's color; the brand's when it has none. */
  color: string | null;
  /** The breadcrumb items after "Programs" (each a BreadcrumbItem). */
  crumbs: ReactNode;
  /** The program's icon. */
  icon: string | null;
  /** The program's or the module's name. */
  title: string;
}

/**
 * The top of a program's and a module's screen
 * (docs/specs/organize-identity.md): the way back to Programs, the
 * program's tile in its color and icon -- the same as its card -- and the
 * name it is about as the title.
 */
export default function OrganizeHeader({
  action,
  color,
  crumbs,
  icon,
  title,
}: OrganizeHeaderProps) {
  const { t } = useTranslation();
  const Icon = resolveProgramIcon(icon);

  return (
    <header className="flex flex-col gap-3">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/programs">{t("navPrograms")}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          {crumbs}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-xl"
            data-slot="program-tile"
            style={{ backgroundColor: resolveProgramColor(color) }}
          >
            <Icon aria-hidden="true" className="size-5 text-white" />
          </span>
          <h1 className="min-w-0 truncate font-medium font-serif text-3xl tracking-[-0.02em]">
            {title}
          </h1>
        </div>
        {action}
      </div>
    </header>
  );
}
