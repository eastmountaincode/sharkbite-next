import type { ReactNode } from "react";
import styles from "./sharkbite.module.css";

type ModulePanelProps = {
  number: string;
  title: string;
  status?: string;
  toolbar?: ReactNode;
  children: ReactNode;
};

export function ModulePanel({ number, title, status, toolbar, children }: ModulePanelProps) {
  return (
    <section className={styles.module}>
      <header className={styles.moduleHeader}>
        <span className={styles.moduleNumber}>{number}</span>
        <h2>{title}</h2>
        {toolbar ? <div className={styles.moduleToolbar}>{toolbar}</div> : null}
        {status ? <span className={styles.moduleStatus}>{status}</span> : null}
      </header>
      <div className={styles.moduleBody}>{children}</div>
    </section>
  );
}
