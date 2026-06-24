"use client";

import styles from "./sharkbite.module.css";

export function SharkbiteApp() {
  return (
    <main className={styles.shell}>
      <section aria-label="Sharkbite pedal work surface" className={styles.pedalStage}>
        <div className={styles.pedalCanvas}>
          <div className={styles.pedalOverlay}>
            <span className={`${styles.jackLabel} ${styles.outputJackLabel}`}>OUTPUT</span>
            <span className={`${styles.jackLabel} ${styles.inputJackLabel}`}>INPUT</span>
            <div aria-label="Input level knob" className={`${styles.knob} ${styles.inputLevelKnob}`} role="img" />
          </div>
        </div>
      </section>
    </main>
  );
}
