import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function ArtifactCard({
  children,
  className,
  variant = "panel",
  density = "comfortable"
}: {
  children: ReactNode;
  className?: string;
  variant?: "plain" | "panel" | "editor";
  density?: "compact" | "comfortable";
}) {
  return (
    <Card
      data-variant={variant}
      data-density={density}
      className={cn("gap-0 overflow-hidden rounded-lg py-0 shadow-xs", className)}
    >
      {children}
    </Card>
  );
}

function ArtifactHeader({
  title,
  eyebrow,
  description,
  status,
  statusVariant = "secondary",
  actions,
  className
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  status?: string;
  statusVariant?: "default" | "secondary" | "outline" | "destructive";
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <CardHeader className={cn("flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{eyebrow}</p> : null}
        <h3 className="truncate text-lg font-semibold tracking-tight">{title}</h3>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {(status || actions) ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {status ? <Badge variant={statusVariant}>{status}</Badge> : null}
          {actions}
        </div>
      ) : null}
    </CardHeader>
  );
}

function ArtifactBody({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return <CardContent className={cn("p-4", className)}>{children}</CardContent>;
}

function EmptyArtifactState({
  title,
  description,
  action,
  className
}: {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-dashed bg-muted/20 p-4", className)}>
      <strong className="text-sm font-medium">{title}</strong>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

function CandidateCard({
  children,
  actions,
  className
}: {
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("grid gap-3 rounded-lg p-4 shadow-xs sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start", className)}>
      <div className="min-w-0">{children}</div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </Card>
  );
}

export { ArtifactCard, ArtifactHeader, ArtifactBody, EmptyArtifactState, CandidateCard };
