import { X } from "lucide-react";
import type { RefObject } from "react";
import type { AudioInputOption } from "./sharkbite-model";
import styles from "./sharkbite.module.css";

type InputSourceDialogProps = {
  audioInputs: AudioInputOption[];
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  defaultInputDeviceId: string;
  inputDeviceId: string;
  onClose: () => void;
  onUpdateInputDevice: (deviceId: string) => void;
};

export function InputSourceDialog({
  audioInputs,
  closeButtonRef,
  defaultInputDeviceId,
  inputDeviceId,
  onClose,
  onUpdateInputDevice,
}: InputSourceDialogProps) {
  return (
    <div
      className={styles.inputDialogBackdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section aria-labelledby="input-source-title" aria-modal="true" className={styles.inputDialog} role="dialog">
        <header className={styles.inputDialogHeader}>
          <h2 className={styles.inputDialogTitle} id="input-source-title">
            Input Source
          </h2>
          <button
            ref={closeButtonRef}
            aria-label="Close input settings"
            className={`${styles.iconButton} ${styles.inputDialogClose}`}
            type="button"
            onClick={onClose}
          >
            <X aria-hidden="true" size={17} />
          </button>
        </header>

        <div className={styles.inputDialogBody}>
          <label className={styles.inputControl}>
            <span className={styles.srOnly}>Input Source</span>
            <select value={inputDeviceId} onChange={(event) => onUpdateInputDevice(event.target.value)}>
              <option value={defaultInputDeviceId}>System Default</option>
              {audioInputs.map((device) => (
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
