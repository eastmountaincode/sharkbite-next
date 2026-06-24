"use client";

import styles from "./sharkbite.module.css";

export function SharkbiteApp() {
  return (
    <main className={styles.shell}>
      <section aria-label="Sharkbite pedal work surface" className={styles.pedalStage}>
        <div className={styles.pedalCanvas}>
          <div className={styles.pedalOverlay} />
        </div>
      </section>
    </main>
  );
}
