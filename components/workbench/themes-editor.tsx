import type { CSSProperties, ReactNode } from "react";
import { Plus, Save, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArtifactBody, ArtifactCard, EmptyArtifactState } from "@/components/workbench/artifact";
import { themeColorPalette } from "@/lib/artifact-normalizers";
import type { IdealState, JobStep, Theme } from "@/lib/types";
import styles from "./workflow-components.module.css";

type ThemeUsage = {
  idealCount: number;
  metricCount: number;
};

type ThemesEditorProps = {
  header: ReactNode;
  idealStates: IdealState[];
  jobSteps: JobStep[];
  saving: boolean;
  themes: Theme[];
  onAddTheme: () => void;
  onRemoveTheme: (themeId: number) => void;
  onUpdateTheme: (themeId: number, patch: Partial<Theme>) => void;
};

function usageLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function getThemeUsage(themeId: number, idealStates: IdealState[], jobSteps: JobStep[]): ThemeUsage {
  const idealCount = idealStates.filter((idealState) => idealState.themeIds.includes(themeId)).length;
  const metricCount = jobSteps.reduce(
    (total, jobStep) => total + jobStep.successMetrics.filter((metric) => metric.themeIds.includes(themeId)).length,
    0
  );

  return { idealCount, metricCount };
}

function ThemesEditor({
  header,
  idealStates,
  jobSteps,
  saving,
  themes,
  onAddTheme,
  onRemoveTheme,
  onUpdateTheme
}: ThemesEditorProps) {
  return (
    <ArtifactCard variant="editor" density="compact" className={styles.artifactCard}>
      {header}
      <ArtifactBody className="grid gap-3">
        {themes.length === 0 ? (
          <EmptyArtifactState
            title="No themes yet"
            description="Add reusable themes to organize related ideals and success metrics."
          />
        ) : (
          <div className={styles.themeList}>
            {themes.map((theme, index) => {
              const usage = getThemeUsage(theme.id, idealStates, jobSteps);

              return (
                <Card className={styles.themeCard} key={theme.id}>
                  <span
                    className={styles.themeSwatch}
                    style={{ "--theme-color": theme.color } as CSSProperties}
                    aria-hidden="true"
                  />
                  <div className={styles.themeFields}>
                    <Input
                      value={theme.title}
                      onChange={(event) => onUpdateTheme(theme.id, { title: event.target.value })}
                      placeholder={`Theme ${index + 1}`}
                      disabled={saving}
                      aria-label={`Theme ${index + 1} name`}
                    />
                    <Textarea
                      value={theme.description}
                      onChange={(event) => onUpdateTheme(theme.id, { description: event.target.value })}
                      placeholder="What this theme groups together"
                      disabled={saving}
                      rows={2}
                      aria-label={`Theme ${index + 1} description`}
                    />
                    <div className={styles.themeUsageRow}>
                      <Badge variant="secondary">{usageLabel(usage.idealCount, "ideal", "ideals")}</Badge>
                      <Badge variant="secondary">{usageLabel(usage.metricCount, "metric", "metrics")}</Badge>
                    </div>
                    <div className={styles.themePalette} aria-label={`Theme ${index + 1} color`}>
                      {themeColorPalette.map((color) => (
                        <button
                          className={styles.themeSwatchButton}
                          data-selected={theme.color === color ? "true" : undefined}
                          style={{ "--theme-color": color } as CSSProperties}
                          type="button"
                          title={`Use ${color}`}
                          aria-label={`Use ${color}`}
                          onClick={() => onUpdateTheme(theme.id, { color })}
                          disabled={saving}
                          key={color}
                        />
                      ))}
                    </div>
                  </div>
                  <Button
                    className={styles.iconButton}
                    type="button"
                    title="Delete theme"
                    aria-label="Delete theme"
                    onClick={() => onRemoveTheme(theme.id)}
                    disabled={saving}
                  >
                    <Trash2 data-icon="inline-start" />
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </ArtifactBody>
    </ArtifactCard>
  );
}

function ThemesToolbar({
  saving,
  dirty,
  onAddTheme,
  onCancelEdit,
  onSaveThemes
}: {
  saving: boolean;
  dirty: boolean;
  onAddTheme: () => void;
  onCancelEdit: () => void;
  onSaveThemes: () => void;
}) {
  return (
    <div className={styles.inlineToolbar}>
      <Button type="button" variant="outline" onClick={onAddTheme} disabled={saving}>
        <Plus data-icon="inline-start" />
        Theme
      </Button>
      {dirty ? (
        <>
          <Button type="button" onClick={onSaveThemes} disabled={saving}>
            <Save data-icon="inline-start" />
            Save themes
          </Button>
          <Button type="button" variant="outline" onClick={onCancelEdit} disabled={saving}>
            <X data-icon="inline-start" />
            Cancel
          </Button>
        </>
      ) : null}
    </div>
  );
}

export { ThemesEditor, ThemesToolbar };
