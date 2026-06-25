import { Minus, Plus } from "lucide-react";
import styles from "./sharkbite.module.css";
import { SynthKeyboard } from "./synth-keyboard";

type PianoPanelProps = {
  activeNotes: Set<number>;
  disabled: boolean;
  maxOctave: number;
  minOctave: number;
  octave: number;
  pianoVisible: boolean;
  wave: OscillatorType;
  waves: OscillatorType[];
  onNoteOff: (midi: number) => void;
  onNoteOn: (midi: number) => void;
  onOctaveChange: (octave: number) => void;
  onWaveChange: (wave: string) => void;
};

export function PianoPanel({
  activeNotes,
  disabled,
  maxOctave,
  minOctave,
  octave,
  pianoVisible,
  wave,
  waves,
  onNoteOff,
  onNoteOn,
  onOctaveChange,
  onWaveChange,
}: PianoPanelProps) {
  return (
    <aside
      aria-hidden={!pianoVisible}
      aria-label="Piano controls"
      className={styles.pianoPanel}
      data-visible={pianoVisible ? "true" : "false"}
      id="sharkbite-piano"
    >
      <div className={styles.pianoControls}>
        <label className={styles.pianoControl}>
          <span>Wave</span>
          <select value={wave} onChange={(event) => onWaveChange(event.target.value)}>
            {waves.map((waveOption) => (
              <option key={waveOption} value={waveOption}>
                {waveOption}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.pianoControl}>
          <span>Octave</span>
          <div className={styles.octaveStepper}>
            <button
              aria-label="Lower octave"
              disabled={octave <= minOctave}
              type="button"
              onClick={() => onOctaveChange(octave - 1)}
            >
              <Minus aria-hidden="true" size={16} />
            </button>
            <strong>{octave}</strong>
            <button
              aria-label="Raise octave"
              disabled={octave >= maxOctave}
              type="button"
              onClick={() => onOctaveChange(octave + 1)}
            >
              <Plus aria-hidden="true" size={16} />
            </button>
          </div>
        </div>
      </div>
      <SynthKeyboard
        activeNotes={activeNotes}
        disabled={disabled || !pianoVisible}
        octave={octave}
        onNoteOff={onNoteOff}
        onNoteOn={onNoteOn}
      />
    </aside>
  );
}
