import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";

type ProjectToDelete = {
  id: number;
  name: string;
};

type ProjectDeleteDialogProps = {
  project: ProjectToDelete | null;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (projectId: number) => void;
};

function ProjectDeleteDialog({ project, saving, onOpenChange, onDelete }: ProjectDeleteDialogProps) {
  return (
    <AlertDialog open={Boolean(project)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete project?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes {project ? `"${project.name}"` : "this project"}, including its saved outcome fields and job map.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={saving || !project}
            variant="destructive"
            onClick={(event) => {
              event.preventDefault();
              if (project) onDelete(project.id);
            }}
          >
            Delete project
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { ProjectDeleteDialog, type ProjectToDelete };
