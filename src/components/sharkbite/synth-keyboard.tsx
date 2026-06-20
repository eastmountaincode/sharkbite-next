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

const BLACK_SEMITONES = new Set([1, 3, 6, 8, 10]);
const KEY_BINDINGS_BY_SEMITONE = new Map(SYNTH_KEYS.map((key) => [key.semitone, key]));

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
  return `${key.name}${octave + Math.floor(key.semitone / 12)}`;
}

function isBlackKey(semitone: number) {
  return BLACK_SEMITONES.has(semitone % 12);
}

function noteNameFor(semitone: number) {
  return SYNTH_KEYS.find((key) => key.semitone === semitone % 12)?.name ?? "C";
}

export function SynthKeyboard({ octave, activeNotes, disabled, onNoteOn, onNoteOff }: SynthKeyboardProps) {
  const heldKeys = useRef(new Set<string>());
  const visualKeys = useMemo(
    () =>
      Array.from({ length: 25 }, (_, semitone) => ({
        semitone,
        name: noteNameFor(semitone),
        black: isBlackKey(semitone),
        key: KEY_BINDINGS_BY_SEMITONE.get(semitone)?.key ?? "",
      })),
    [],
  );
  const whiteKeys = useMemo(() => visualKeys.filter((key) => !key.black), [visualKeys]);
  const blackKeys = useMemo(() => visualKeys.filter((key) => key.black), [visualKeys]);

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
              <span>{key.key ? key.key.toUpperCase() : ""}</span>
              <small>{noteLabel(key, octave)}</small>
            </button>
          );
        })}
      </div>

      {blackKeys.map((key) => {
        const midi = midiFor(key, octave);
        const pressed = activeNotes.has(midi);
        const whitesBefore = visualKeys.filter((candidate) => !candidate.black && candidate.semitone < key.semitone).length;
        const leftPercent = ((whitesBefore - 0.34) / whiteKeys.length) * 100;
        const widthPercent = (100 / whiteKeys.length) * 0.64;

        return (
          <button
            aria-label={noteLabel(key, octave)}
            className={`${styles.blackKey} ${pressed ? styles.keyDown : ""}`}
            disabled={disabled}
            key={`${key.name}-${key.semitone}`}
            style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
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
            {key.key ? key.key.toUpperCase() : ""}
          </button>
        );
      })}
    </div>
  );
}
