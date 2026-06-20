"use client";

import { useEffect, useMemo, useRef } from "react";
import styles from "./sharkbite.module.css";

export type SynthKey = {
  name: string;
  semitone: number;
  black: boolean;
  key: string;
};

export const SYNTH_KEYS: SynthKey[] = [
  { name: "C", semitone: 0, black: false, key: "a" },
  { name: "C#", semitone: 1, black: true, key: "w" },
  { name: "D", semitone: 2, black: false, key: "s" },
  { name: "D#", semitone: 3, black: true, key: "e" },
  { name: "E", semitone: 4, black: false, key: "d" },
  { name: "F", semitone: 5, black: false, key: "f" },
  { name: "F#", semitone: 6, black: true, key: "t" },
  { name: "G", semitone: 7, black: false, key: "g" },
  { name: "G#", semitone: 8, black: true, key: "y" },
  { name: "A", semitone: 9, black: false, key: "h" },
  { name: "A#", semitone: 10, black: true, key: "u" },
  { name: "B", semitone: 11, black: false, key: "j" },
  { name: "C", semitone: 12, black: false, key: "k" },
];

const BLACK_KEY_LEFT: Record<number, number> = {
  1: 46,
  3: 92,
  6: 184,
  8: 230,
  10: 276,
};

type SynthKeyboardProps = {
  octave: number;
  activeNotes: Set<number>;
  disabled: boolean;
  onNoteOn: (midi: number) => void;
  onNoteOff: (midi: number) => void;
};

function midiFor(key: SynthKey, octave: number) {
  return (octave + 1) * 12 + key.semitone;
}

function noteLabel(key: SynthKey, octave: number) {
  return `${key.name}${octave + (key.semitone >= 12 ? 1 : 0)}`;
}

export function SynthKeyboard({ octave, activeNotes, disabled, onNoteOn, onNoteOff }: SynthKeyboardProps) {
  const heldKeys = useRef(new Set<string>());
  const whiteKeys = useMemo(() => SYNTH_KEYS.filter((key) => !key.black), []);
  const blackKeys = useMemo(() => SYNTH_KEYS.filter((key) => key.black), []);

  useEffect(() => {
    const held = heldKeys.current;

    const handleDown = (event: KeyboardEvent) => {
      if (event.repeat || disabled) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName.toLowerCase();
      if (tag === "input" || tag === "select" || tag === "textarea") return;

      const synthKey = SYNTH_KEYS.find((key) => key.key === event.key.toLowerCase());
      if (!synthKey || held.has(synthKey.key)) return;
      held.add(synthKey.key);
      onNoteOn(midiFor(synthKey, octave));
    };

    const handleUp = (event: KeyboardEvent) => {
      const synthKey = SYNTH_KEYS.find((key) => key.key === event.key.toLowerCase());
      if (!synthKey) return;
      held.delete(synthKey.key);
      onNoteOff(midiFor(synthKey, octave));
    };

    window.addEventListener("keydown", handleDown);
    window.addEventListener("keyup", handleUp);

    return () => {
      window.removeEventListener("keydown", handleDown);
      window.removeEventListener("keyup", handleUp);
      held.clear();
    };
  }, [disabled, octave, onNoteOff, onNoteOn]);

  return (
    <div className={styles.keyboard} aria-label="Synth keyboard">
      <div className={styles.whiteKeys}>
        {whiteKeys.map((key) => {
          const midi = midiFor(key, octave);
          const pressed = activeNotes.has(midi);

          return (
            <button
              aria-label={noteLabel(key, octave)}
              className={`${styles.whiteKey} ${pressed ? styles.keyDown : ""}`}
              disabled={disabled}
              key={`${key.name}-${key.semitone}`}
              type="button"
              onPointerCancel={() => onNoteOff(midi)}
              onPointerDown={(event) => {
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                onNoteOn(midi);
              }}
              onPointerLeave={(event) => {
                if (event.buttons) onNoteOff(midi);
              }}
              onPointerUp={() => onNoteOff(midi)}
            >
              <span>{key.key.toUpperCase()}</span>
              <small>{noteLabel(key, octave)}</small>
            </button>
          );
        })}
      </div>

      {blackKeys.map((key) => {
        const midi = midiFor(key, octave);
        const pressed = activeNotes.has(midi);

        return (
          <button
            aria-label={noteLabel(key, octave)}
            className={`${styles.blackKey} ${pressed ? styles.keyDown : ""}`}
            disabled={disabled}
            key={`${key.name}-${key.semitone}`}
            style={{ left: `${BLACK_KEY_LEFT[key.semitone]}px` }}
            type="button"
            onPointerCancel={() => onNoteOff(midi)}
            onPointerDown={(event) => {
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              onNoteOn(midi);
            }}
            onPointerLeave={(event) => {
              if (event.buttons) onNoteOff(midi);
            }}
            onPointerUp={() => onNoteOff(midi)}
          >
            {key.key.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
