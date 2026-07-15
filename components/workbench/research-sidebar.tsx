import Link from "next/link";
import { ArrowLeft, Check, CopyPlus, Library, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProjectActionsMenu } from "@/components/workbench/project-actions-menu";
import { WorkbenchSidebar } from "@/components/workbench/workbench";
import type { Project } from "@/lib/types";

type ResearchSidebarProps = {
  active: "outcome" | "prompts";
  projects?: Project[];
  activeProject?: Project;
  completedFields?: number;
  totalFields?: number;
  loading?: boolean;
  saving?: boolean;
  collapsed?: boolean;
  onLoadProject?: (projectId: number) => void;
  onCreateProject?: () => void;
  onDeleteProject?: (project: Project) => void;
  onToggleCollapsed?: () => void;
};

function ResearchSidebar({
  active,
  projects = [],
  activeProject,
  completedFields = 0,
  totalFields = 0,
  loading = false,
  saving = false,
  collapsed = false,
  onLoadProject,
  onCreateProject,
  onDeleteProject,
  onToggleCollapsed
}: ResearchSidebarProps) {
  const showProjectControls = !collapsed && active === "outcome" && projects.length > 0 && onLoadProject && onCreateProject && onDeleteProject;

  return (
    <WorkbenchSidebar className="project-sidebar" aria-label="Navigation" data-collapsed={collapsed ? "true" : undefined}>
      <div className="sidebar-brand">
        <div className="sidebar-logo-mark">W</div>
        {!collapsed ? (
          <div>
            <strong>What to Build?</strong>
            <small>Research workbench</small>
          </div>
        ) : null}
        {onToggleCollapsed ? (
          <Button
            className="sidebar-collapse-button"
            type="button"
            variant="ghost"
            size="icon-sm"
            title={collapsed ? "Expand navigation" : "Collapse navigation"}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            onClick={onToggleCollapsed}
          >
            {collapsed ? <PanelLeftOpen data-icon="inline-start" /> : <PanelLeftClose data-icon="inline-start" />}
          </Button>
        ) : null}
      </div>
      <nav className="sidebar-nav" aria-label="Main navigation">
        {!collapsed ? <p className="sidebar-section-label">Workbench</p> : null}
        <Button
          className={`sidebar-nav-item ${active === "outcome" ? "active" : ""}`}
          type="button"
          variant="ghost"
          asChild={active !== "outcome"}
          title="Outcome Mapping"
          aria-label={collapsed ? "Outcome Mapping" : undefined}
        >
          {active === "outcome" ? (
            <>
              <Check data-icon="inline-start" />
              {!collapsed ? <span>Outcome Mapping</span> : null}
            </>
          ) : (
            <Link href="/" title="Outcome Mapping" aria-label={collapsed ? "Outcome Mapping" : undefined}>
              <ArrowLeft data-icon="inline-start" />
              {!collapsed ? <span>Outcome Mapping</span> : null}
            </Link>
          )}
        </Button>
        <Button
          className={`sidebar-nav-item ${active === "prompts" ? "active" : ""}`}
          type="button"
          variant="ghost"
          asChild={active !== "prompts"}
          title="Prompts"
          aria-label={collapsed ? "Prompts" : undefined}
        >
          {active === "prompts" ? (
            <>
              <CopyPlus data-icon="inline-start" />
              {!collapsed ? <span>Prompts</span> : null}
            </>
          ) : (
            <Link href="/actions" title="Prompts" aria-label={collapsed ? "Prompts" : undefined}>
              <Library data-icon="inline-start" />
              {!collapsed ? <span>Prompts</span> : null}
            </Link>
          )}
        </Button>
      </nav>
      {showProjectControls ? (
        <section className="sidebar-project-controls" aria-label="Research project">
          <p className="sidebar-section-label">Project</p>
          <Select
            value={activeProject ? String(activeProject.id) : ""}
            disabled={loading || saving}
            onValueChange={(value) => onLoadProject(Number(value))}
          >
            <SelectTrigger className="sidebar-project-select" aria-label="Select research project">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {projects.map((project) => (
                  <SelectItem value={String(project.id)} key={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <div className="sidebar-project-actions">
            <Badge title={`${completedFields}/${totalFields} fields complete`} variant={saving ? "secondary" : "outline"}>
              {saving ? "Saving" : `${completedFields}/${totalFields} complete`}
            </Badge>
            <ProjectActionsMenu
              projectName={activeProject?.name}
              completed={completedFields}
              total={totalFields}
              saving={saving}
              canDelete={projects.length > 1 && Boolean(activeProject)}
              onCreate={onCreateProject}
              onDelete={() => activeProject && onDeleteProject(activeProject)}
            />
          </div>
        </section>
      ) : null}
      <div className="sidebar-spacer" />
    </WorkbenchSidebar>
  );
}

export { ResearchSidebar };
