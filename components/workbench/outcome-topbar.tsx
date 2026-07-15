import { WorkbenchTopbar } from "@/components/workbench/workbench";
import styles from "./outcome-topbar.module.css";

function OutcomeTopbar() {
  return (
    <WorkbenchTopbar
      className={styles.topbar}
      title="Outcome Mapping"
    />
  );
}

export { OutcomeTopbar };
