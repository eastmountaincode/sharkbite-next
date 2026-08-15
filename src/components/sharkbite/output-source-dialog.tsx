import { X } from "lucide-react";
import type { RefObject } from "react";
import type { AudioOutputOption } from "./sharkbite-model";
import styles from "./sharkbite.module.css";

type OutputSourceDialogProps = {
  audioOutputs: AudioOutputOption[];
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  defaultOutputDeviceId: string;
  outputDeviceId: string;
  onClose: () => void;
  onUpdateOutputDevice: (deviceId: string) => void;
};

export function OutputSourceDialog({
  audioOutputs,
  closeButtonRef,
  defaultOutputDeviceId,
  outputDeviceId,
  onClose,
  onUpdateOutputDevice,
}: OutputSourceDialogProps) {
  return (
    <div
      className={styles.inputDialogBackdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section aria-labelledby="output-source-title" aria-modal="true" className={styles.inputDialog} role="dialog">
        <header className={styles.inputDialogHeader}>
          <h2 className={styles.inputDialogTitle} id="output-source-title">
            Output Source
          </h2>
          <button
            ref={closeButtonRef}
            aria-label="Close output settings"
            className={`${styles.iconButton} ${styles.inputDialogClose}`}
            type="button"
            onClick={onClose}
          >
            <X aria-hidden="true" size={17} />
          </button>
        </header>

        <div className={styles.inputDialogBody}>
          <label className={styles.inputControl}>
            <span className={styles.srOnly}>Output Source</span>
            <select value={outputDeviceId} onChange={(event) => onUpdateOutputDevice(event.target.value)}>
              <option value={defaultOutputDeviceId}>System Default</option>
              {audioOutputs.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
    </div>
  );
}
