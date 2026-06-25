import styles from "./sharkbite.module.css";

type TopControlsProps = {
  infoDialogOpen: boolean;
  pianoVisible: boolean;
  showInfoToggle: boolean;
  onOpenInfo: () => void;
  onTogglePiano: () => void;
};

export function TopControls({
  infoDialogOpen,
  pianoVisible,
  showInfoToggle,
  onOpenInfo,
  onTogglePiano,
}: TopControlsProps) {
  return (
    <>
      {showInfoToggle ? (
        <button
          aria-controls="sharkbite-info"
          aria-expanded={infoDialogOpen}
          className={styles.infoToggle}
          type="button"
          onContextMenu={(event) => event.preventDefault()}
          onClick={onOpenInfo}
        >
          More Info
        </button>
      ) : null}
      <button
        aria-expanded={pianoVisible}
        aria-controls="sharkbite-piano"
        className={styles.pianoToggle}
        type="button"
        onContextMenu={(event) => event.preventDefault()}
        onClick={onTogglePiano}
      >
        {pianoVisible ? "Hide Piano" : "Show Piano"}
      </button>
    </>
  );
}
