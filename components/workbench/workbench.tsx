import type { ReactNode } from "react";
import { CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function WorkbenchShell({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main className={cn("min-h-screen bg-muted/30 text-foreground", className)}>
      {children}
    </main>
  );
}

function WorkbenchFrame({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto flex min-h-screen w-full max-w-[1680px] flex-col gap-3 p-3 lg:p-4", className)}>
      {children}
    </div>
  );
}

function WorkbenchHeader({
  title,
  eyebrow,
  description,
  leading,
  actions,
  className
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  leading?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex min-h-20 flex-col gap-3 rounded-lg border bg-card px-4 py-3 shadow-xs lg:flex-row lg:items-center lg:justify-between", className)}>
      <div className="flex min-w-0 items-center gap-3">
        {leading ? <div className="shrink-0">{leading}</div> : null}
        <div className="min-w-0">
          {eyebrow ? <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{eyebrow}</p> : null}
          <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

function WorkbenchAppLayout({
  sidebar,
  children,
  sidebarCollapsed = false,
  className
}: {
  sidebar: ReactNode;
  children: ReactNode;
  sidebarCollapsed?: boolean;
  className?: string;
}) {
  const columnClass = sidebarCollapsed
    ? "lg:grid-cols-[72px_minmax(0,1fr)]"
    : "lg:grid-cols-[260px_minmax(0,1fr)]";

  return (
    <div
      className={cn("grid min-h-screen w-full grid-cols-1 lg:h-screen lg:overflow-hidden", columnClass, className)}
      data-sidebar-collapsed={sidebarCollapsed ? "true" : undefined}
    >
      {sidebar}
      <div className="flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden p-3 lg:p-4">
        {children}
      </div>
    </div>
  );
}

function WorkbenchSidebar({
  children,
  className,
  "aria-label": ariaLabel,
  "data-collapsed": dataCollapsed
}: {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
  "data-collapsed"?: string;
}) {
  return (
    <aside
      aria-label={ariaLabel}
      className={cn("flex min-h-0 flex-col overflow-hidden border bg-card text-card-foreground", className)}
      data-collapsed={dataCollapsed}
    >
      {children}
    </aside>
  );
}

function WorkbenchTopbar({
  title,
  description,
  eyebrow,
  actions,
  className
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex min-h-16 flex-col gap-3 rounded-lg border bg-card px-4 py-3 shadow-xs lg:flex-row lg:items-center lg:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{eyebrow}</p> : null}
        <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

function WorkbenchGrid({
  children,
  columns = "default",
  className
}: {
  children: ReactNode;
  columns?: "default" | "wideCenter" | "single";
  className?: string;
}) {
  const columnClass =
    columns === "single"
      ? "grid-cols-1"
      : columns === "wideCenter"
        ? "grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)_420px]"
        : "grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)_380px]";

  return (
    <section className={cn("grid min-h-0 flex-1 gap-3", columnClass, className)}>
      {children}
    </section>
  );
}

function WorkbenchPanel({
  children,
  className,
  as = "section"
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "aside";
}) {
  const Component = as;
  return (
    <Component
      data-slot="card"
      className={cn("flex min-h-0 flex-col overflow-hidden rounded-lg border bg-card text-card-foreground shadow-xs", className)}
    >
      {children}
    </Component>
  );
}

function PanelHeader({
  title,
  eyebrow,
  description,
  actions,
  className
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <CardHeader className={cn("flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{eyebrow}</p> : null}
        <h2 className="truncate text-lg font-semibold tracking-tight">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </CardHeader>
  );
}

function PanelBody({
  children,
  className,
  scroll = false
}: {
  children: ReactNode;
  className?: string;
  scroll?: boolean;
}) {
  return (
    <CardContent className={cn("min-h-0 p-4", scroll && "overflow-auto", className)}>
      {children}
    </CardContent>
  );
}

function PanelToolbar({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("flex flex-wrap items-center gap-2", className)}>{children}</div>;
}

export {
  WorkbenchShell,
  WorkbenchFrame,
  WorkbenchHeader,
  WorkbenchAppLayout,
  WorkbenchSidebar,
  WorkbenchTopbar,
  WorkbenchGrid,
  WorkbenchPanel,
  PanelHeader,
  PanelBody,
  PanelToolbar
};
