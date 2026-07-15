import { Check, Ellipsis, FolderPlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import styles from "./project-actions-menu.module.css";

function ProjectActionsMenu({
  projectName,
  completed,
  total,
  saving,
  canDelete,
  onCreate,
  onDelete
}: {
  projectName?: string;
  completed: number;
  total: number;
  saving?: boolean;
  canDelete: boolean;
  onCreate: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className={styles.circleButton} type="button" variant="outline" aria-label="Project actions">
          <Ellipsis data-icon="inline-start" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={styles.menu}>
        <DropdownMenuLabel className={styles.label}>
          <span>Project</span>
          <small>{projectName || "No project selected"}</small>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={onCreate} disabled={saving}>
            <FolderPlus data-icon="inline-start" />
            New project
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" disabled={saving || !canDelete} onSelect={onDelete}>
            <Trash2 data-icon="inline-start" />
            Delete project
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <Check data-icon="inline-start" />
          {completed}/{total} complete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { ProjectActionsMenu };
