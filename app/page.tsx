"use client";

import { useState } from "react";
import { AlertTriangle, PanelRightClose, PanelRightOpen } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  AgentSidebar,
  ArtifactEditorPanel,
  ArtifactNavigator,
  ProjectDeleteDialog,
  ResearchSidebar,
  WorkbenchAppLayout,
  WorkbenchFrame,
  WorkbenchShell,
} from "@/components/workbench";
import { useOutcomeWorkbench } from "@/hooks/use-outcome-workbench";
import { fieldKeys } from "@/lib/types";
import { getWorkflowStep, isWorkflowStepComplete, workflowSteps } from "@/lib/workflow";
import { cn } from "@/lib/utils";
import styles from "./outcome-page.module.css";

export default function Home() {
  const {
    activeProject,
    activeWorkflowStep,
    agentPendingMessage,
    agentRunning,
    agentRunMarkers,
    agentStatusMessage,
    agentStreamingMessage,
    artifactEditor,
    completedFields,
    createProject,
    deleteProject,
    error,
    loadProject,
    loading,
    missingWorkflowRequirements,
    projectToDelete,
    runAgentMessage,
    saving,
    selectWorkflowStep,
    setProjectToDelete,
    stopAgentRun,
    state
  } = useOutcomeWorkbench();

  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);

  return (
    <WorkbenchShell>
      <WorkbenchFrame className="max-w-none p-0 lg:p-0">
        <WorkbenchAppLayout
          className={styles.layout}
          sidebarCollapsed={leftSidebarCollapsed}
          sidebar={
            <ResearchSidebar
              active="outcome"
              projects={state.projects}
              activeProject={activeProject}
              completedFields={completedFields}
              totalFields={fieldKeys.length}
              loading={loading}
              saving={saving}
              collapsed={leftSidebarCollapsed}
              onLoadProject={(projectId) => void loadProject(projectId)}
              onCreateProject={() => void createProject()}
              onDeleteProject={(project) =>
                setProjectToDelete({ id: project.id, name: project.name })
              }
              onToggleCollapsed={() =>
                setLeftSidebarCollapsed((current) => !current)
              }
            />
          }
        >
          <>
            <div className={styles.workbench}>
              <div
                className={cn(
                  styles.workspace,
                  rightSidebarCollapsed && styles.workspaceRightCollapsed,
                )}
              >
                <AgentSidebar
                  className={styles.agentMain}
                  messages={state.agentMessages}
                  title="Outcome Mapping"
                  pendingMessage={agentPendingMessage}
                  running={agentRunning}
                  runMarkers={agentRunMarkers}
                  statusMessage={agentStatusMessage}
                  streamingMessage={agentStreamingMessage}
                  onSend={(message, reasoningEffort, options) => void runAgentMessage(message, reasoningEffort, options)}
                  onStop={stopAgentRun}
                />

                <div
                  className={styles.artifactInspector}
                  data-collapsed={rightSidebarCollapsed ? "true" : undefined}
                  role="complementary"
                  aria-label="Research artifacts"
                >
                  <Button
                    className={styles.rightSidebarToggleCollapsed}
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    title="Expand artifacts"
                    aria-label="Expand artifacts"
                    onClick={() => setRightSidebarCollapsed(false)}
                  >
                    <PanelRightOpen data-icon="inline-start" />
                  </Button>
                  <div className={styles.inspectorContent}>
                    <header className={styles.inspectorHeader}>
                      <div>
                        <h2>Artifacts</h2>
                        <p>Research state and manual edits</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        title="Collapse artifacts"
                        aria-label="Collapse artifacts"
                        onClick={() => setRightSidebarCollapsed(true)}
                      >
                        <PanelRightClose data-icon="inline-start" />
                      </Button>
                    </header>
                    <div
                      className={styles.content}
                      role="group"
                      aria-label={`${activeWorkflowStep.label} workflow`}
                    >
                      <ArtifactNavigator
                        className={styles.artifactMap}
                        steps={workflowSteps}
                        activeStepKey={activeWorkflowStep.key}
                        state={state}
                        isComplete={(step) =>
                          isWorkflowStepComplete(step, state)
                        }
                        onSelect={selectWorkflowStep}
                        activeDetail={
                          <div className={styles.artifactDetail}>
                            {error ? (
                              <Alert className={styles.alert} variant="destructive">
                                <AlertTriangle data-icon="inline-start" />
                                <AlertTitle>Something needs attention</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                              </Alert>
                            ) : null}

                            {missingWorkflowRequirements.length > 0 ? (
                              <Alert className={styles.alert}>
                                <AlertTriangle data-icon="inline-start" />
                                <AlertTitle>Related context missing</AlertTitle>
                                <AlertDescription>
                                  {missingWorkflowRequirements
                                    .map((key) => getWorkflowStep(key).label)
                                    .join(", ")}{" "}
                                  is still empty. You can work here now, then review
                                  this artifact again as the frame changes.
                                </AlertDescription>
                              </Alert>
                            ) : null}

                            <ArtifactEditorPanel editor={artifactEditor} />
                          </div>
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <ProjectDeleteDialog
              project={projectToDelete}
              saving={saving}
              onOpenChange={(open) => !open && setProjectToDelete(null)}
              onDelete={(projectId) => void deleteProject(projectId)}
            />
          </>
        </WorkbenchAppLayout>
      </WorkbenchFrame>
    </WorkbenchShell>
  );
}
