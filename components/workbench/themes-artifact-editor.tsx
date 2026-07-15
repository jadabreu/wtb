import { ThemesEditor, ThemesToolbar } from "@/components/workbench/themes-editor";
import type { ArtifactEditorModel, ArtifactHeaderRenderer } from "@/components/workbench/artifact-editor-model";

type ThemesArtifactEditorProps = {
  editor: ArtifactEditorModel;
  renderHeader: ArtifactHeaderRenderer;
};

function ThemesArtifactEditor({ editor, renderHeader }: ThemesArtifactEditorProps) {
  const themes = editor.themes;

  return (
    <ThemesEditor
      header={renderHeader(
        themes.drafts.length > 0,
        themes.drafts.length > 0 ? "Saved" : "Open",
        <ThemesToolbar
          saving={editor.saving}
          dirty={themes.dirty}
          onAddTheme={themes.addTheme}
          onSaveThemes={() => void themes.save()}
          onCancelEdit={themes.cancel}
        />,
        `${themes.drafts.length} themes`
      )}
      themes={themes.drafts}
      idealStates={editor.state.idealStates}
      jobSteps={editor.state.jobSteps}
      saving={editor.saving}
      onAddTheme={themes.addTheme}
      onRemoveTheme={themes.removeTheme}
      onUpdateTheme={themes.updateTheme}
    />
  );
}

export { ThemesArtifactEditor };
