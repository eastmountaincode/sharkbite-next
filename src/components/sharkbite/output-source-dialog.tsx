import { AUDIO_OUTPUT_CHANNELS, availableOutputPairs, type AudioOutputChannel } from "@/lib/audio/audioOutput";
import { X } from "lucide-react";
import type { RefObject } from "react";
import type { AudioOutputOption } from "./sharkbite-model";
import styles from "./sharkbite.module.css";

type OutputSourceDialogProps = {
  audioOutputs: AudioOutputOption[];
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  defaultOutputDeviceId: string;
  outputDeviceId: string;
  outputLabel: string;
  outputChannel: AudioOutputChannel;
  outputChannelCount: number;
  outputError?: string;
  onUpdateOutputChannel: (channel: AudioOutputChannel) => void;
  onRetryOutput: () => void;
  onClose: () => void;
  onUpdateOutputDevice: (deviceId: string) => void;
};

export function OutputSourceDialog({
  audioOutputs,
  closeButtonRef,
  defaultOutputDeviceId,
  outputDeviceId,
  outputLabel,
  outputChannel,
  outputChannelCount,
  outputError,
  onUpdateOutputChannel,
  onRetryOutput,
  onClose,
  onUpdateOutputDevice,
}: OutputSourceDialogProps) {
  const pairs = availableOutputPairs(outputDeviceId, outputChannelCount);
  const unavailablePair = outputDeviceId && outputChannel !== "stereo" && outputError &&
    !pairs.some((pair) => pair.value === outputChannel);
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
            <span>Audio device</span>
            <select value={outputDeviceId} onChange={(event) => onUpdateOutputDevice(event.target.value)}>
              <option value={defaultOutputDeviceId}>System Default</option>
              {outputDeviceId && !audioOutputs.some((device) => device.deviceId === outputDeviceId) ? (
                <option value={outputDeviceId}>{outputLabel} (unavailable)</option>
              ) : null}
              {audioOutputs.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </select>
          </label>
          {pairs.length > 1 || unavailablePair ? <label className={styles.inputControl}>
            <span>Output channels</span>
            <select value={outputChannel} onChange={(event) => onUpdateOutputChannel(event.target.value as AudioOutputChannel)}>
              {unavailablePair ? <option value={outputChannel} disabled>{AUDIO_OUTPUT_CHANNELS.find((pair) => pair.value === outputChannel)?.label} (unavailable)</option> : null}
              {(pairs.length ? pairs : AUDIO_OUTPUT_CHANNELS.slice(0, 1)).map((pair) => (
                <option key={pair.value} value={pair.value}>{pair.label}</option>
              ))}
            </select>
          </label> : null}
          {outputError ? <>
            <p role="alert">{outputError}</p>
            <button className={`${styles.iconButton} ${styles.reconnectOutput}`} type="button" onClick={onRetryOutput}>Try again</button>
          </> : null}
        </div>
      </section>
    </div>
  );
}
