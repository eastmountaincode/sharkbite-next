import Image from "next/image";
import styles from "./sharkbite.module.css";

type StartScreenProps = {
  startingAudio: boolean;
  onStart: () => void;
};

export function StartScreen({ startingAudio, onStart }: StartScreenProps) {
  return (
    <section aria-label="Sharkbite start screen" className={styles.startScreen}>
      <div className={styles.startPanel}>
        <Image
          priority
          unoptimized
          alt="Sharkbite"
          className={styles.startLogo}
          height={497}
          src="/assets/sharkbite/logo.png"
          width={688}
        />
        <button className={styles.startButton} disabled={startingAudio} type="button" onClick={onStart}>
          Start
        </button>
      </div>
    </section>
  );
}
