"use client";

import { type CSSProperties, type PointerEvent, useCallback, useEffect, useMemo, useRef } from "react";
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
const MOBILE_LAST_SEMITONE = 11;

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

function getBlackKeyPlacement(key: SynthKey, visualKeys: SynthKey[], whiteKeyCount: number) {
  const whitesBefore = visualKeys.filter((candidate) => !candidate.black && candidate.semitone < key.semitone).length;

  return {
    leftPercent: ((whitesBefore - 0.32) / whiteKeyCount) * 100,
    widthPercent: (100 / whiteKeyCount) * 0.64,
  };
}

export function SynthKeyboard({ octave, activeNotes, disabled, onNoteOn, onNoteOff }: SynthKeyboardProps) {
  const keyboardRef = useRef<HTMLDivElement | null>(null);
  const heldKeys = useRef(new Set<string>());
  const activePointersRef = useRef(new Map<number, number | null>());
  const activePointerMidiCountsRef = useRef(new Map<number, number>());
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
  const mobileVisualKeys = useMemo(
    () => visualKeys.filter((key) => key.semitone <= MOBILE_LAST_SEMITONE),
    [visualKeys],
  );
  const mobileWhiteKeyCount = useMemo(
    () => mobileVisualKeys.filter((key) => !key.black).length,
    [mobileVisualKeys],
  );

  const removePointerMidi = useCallback(
    (midi: number | null) => {
      if (midi === null) return;

      const activePointerMidiCounts = activePointerMidiCountsRef.current;
      const nextCount = (activePointerMidiCounts.get(midi) ?? 0) - 1;

      if (nextCount <= 0) {
        activePointerMidiCounts.delete(midi);
        onNoteOff(midi);
        return;
      }

      activePointerMidiCounts.set(midi, nextCount);
    },
    [onNoteOff],
  );

  const setPointerMidi = useCallback(
    (pointerId: number, midi: number | null) => {
      const activePointers = activePointersRef.current;
      const previousMidi = activePointers.get(pointerId);
      if (previousMidi === midi) return;

      removePointerMidi(previousMidi ?? null);
      activePointers.set(pointerId, midi);

      if (midi === null) return;

      const activePointerMidiCounts = activePointerMidiCountsRef.current;
      const previousCount = activePointerMidiCounts.get(midi) ?? 0;
      activePointerMidiCounts.set(midi, previousCount + 1);
      if (previousCount === 0) onNoteOn(midi);
    },
    [onNoteOn, removePointerMidi],
  );

  const releasePointerNote = useCallback(
    (pointerId: number) => {
      if (!activePointersRef.current.has(pointerId)) return;

      removePointerMidi(activePointersRef.current.get(pointerId) ?? null);
      activePointersRef.current.delete(pointerId);
    },
    [removePointerMidi],
  );

  const releaseAllPointerNotes = useCallback(() => {
    for (const midi of activePointerMidiCountsRef.current.keys()) {
      onNoteOff(midi);
    }

    activePointersRef.current.clear();
    activePointerMidiCountsRef.current.clear();
  }, [onNoteOff]);

  const getPointerMidi = useCallback((event: PointerEvent) => {
    const keyboard = keyboardRef.current;
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const keyButton = target?.closest<HTMLButtonElement>("[data-synth-midi]");

    if (!keyboard || !keyButton || !keyboard.contains(keyButton) || keyButton.disabled) return null;

    const midi = Number(keyButton.dataset.synthMidi);
    return Number.isFinite(midi) ? midi : null;
  }, []);

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>, midi: number) => {
      if (disabled || event.button !== 0) return;

      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setPointerMidi(event.pointerId, midi);
    },
    [disabled, setPointerMidi],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!activePointersRef.current.has(event.pointerId)) return;

      const nextMidi = getPointerMidi(event);
      setPointerMidi(event.pointerId, nextMidi);
    },
    [getPointerMidi, setPointerMidi],
  );

  const handlePointerRelease = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      releasePointerNote(event.pointerId);
    },
    [releasePointerNote],
  );

  useEffect(() => {
    const held = heldKeys.current;

    const handleDown = (event: KeyboardEvent) => {
      if (event.repeat || disabled) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName.toLowerCase();
      const synthKey = SYNTH_KEYS.find((key) => key.key === event.key.toLowerCase());
      if (tag === "input" || tag === "textarea" || (tag === "select" && !synthKey)) return;
      if (!synthKey || held.has(synthKey.key)) return;

      if (tag === "select") event.preventDefault();
      held.add(synthKey.key);
      onNoteOn(midiFor(synthKey, octave));
    };

    const handleUp = (event: KeyboardEvent) => {
      const synthKey = SYNTH_KEYS.find((key) => key.key === event.key.toLowerCase());
      if (!synthKey) return;
      if ((event.target as HTMLElement | null)?.tagName.toLowerCase() === "select") event.preventDefault();
      held.delete(synthKey.key);
      onNoteOff(midiFor(synthKey, octave));
    };

    window.addEventListener("keydown", handleDown, true);
    window.addEventListener("keyup", handleUp, true);

    return () => {
      window.removeEventListener("keydown", handleDown, true);
      window.removeEventListener("keyup", handleUp, true);
      held.clear();
    };
  }, [disabled, octave, onNoteOff, onNoteOn]);

  useEffect(() => {
    if (disabled) releaseAllPointerNotes();
  }, [disabled, releaseAllPointerNotes]);

  useEffect(() => releaseAllPointerNotes, [releaseAllPointerNotes]);

  return (
    <div
      ref={keyboardRef}
      className={styles.keyboard}
      aria-label="Synth keyboard"
      data-mobile-range="one-octave"
      onPointerCancel={handlePointerRelease}
      onContextMenu={(event) => event.preventDefault()}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerRelease}
    >
      <div className={styles.whiteKeys}>
        {whiteKeys.map((key) => {
          const midi = midiFor(key, octave);
          const pressed = activeNotes.has(midi);

          return (
            <button
              aria-label={noteLabel(key, octave)}
              className={`${styles.whiteKey} ${pressed ? styles.keyDown : ""}`}
              data-mobile-hidden={key.semitone > MOBILE_LAST_SEMITONE ? "true" : undefined}
              data-synth-midi={midi}
              disabled={disabled}
              key={`${key.name}-${key.semitone}`}
              type="button"
              onPointerDown={(event) => handlePointerDown(event, midi)}
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
        const desktopPlacement = getBlackKeyPlacement(key, visualKeys, whiteKeys.length);
        const mobilePlacement =
          key.semitone <= MOBILE_LAST_SEMITONE
            ? getBlackKeyPlacement(key, mobileVisualKeys, mobileWhiteKeyCount)
            : desktopPlacement;
        const keyStyle = {
          "--black-key-left": `${desktopPlacement.leftPercent}%`,
          "--black-key-width": `${desktopPlacement.widthPercent}%`,
          "--mobile-black-key-left": `${mobilePlacement.leftPercent}%`,
          "--mobile-black-key-width": `${mobilePlacement.widthPercent}%`,
        } as CSSProperties;

        return (
          <button
            aria-label={noteLabel(key, octave)}
            className={`${styles.blackKey} ${pressed ? styles.keyDown : ""}`}
            data-mobile-hidden={key.semitone > MOBILE_LAST_SEMITONE ? "true" : undefined}
            data-synth-midi={midi}
            disabled={disabled}
            key={`${key.name}-${key.semitone}`}
            style={keyStyle}
            type="button"
            onPointerDown={(event) => handlePointerDown(event, midi)}
          >
            <span>{key.key ? key.key.toUpperCase() : ""}</span>
            <small>{noteLabel(key, octave)}</small>
          </button>
        );
      })}
    </div>
  );
}
