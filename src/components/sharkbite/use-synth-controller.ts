import type { RefObject } from "react";
import { useCallback, useEffect, useState } from "react";
import type { AudioEngine } from "@/lib/audio/audio-engine";
import {
  isSynthWave,
  SYNTH_DEFAULT_OCTAVE,
  SYNTH_LEVEL,
  SYNTH_MAX_OCTAVE,
  SYNTH_MIN_OCTAVE,
} from "./sharkbite-model";

type UseSynthControllerParams = {
  engineRef: RefObject<AudioEngine | null>;
  getEngine: () => AudioEngine;
};

export function useSynthController({ engineRef, getEngine }: UseSynthControllerParams) {
  const [pianoOpen, setPianoOpen] = useState(false);
  const [synthWave, setSynthWave] = useState<OscillatorType>("triangle");
  const [synthOctave, setSynthOctave] = useState(SYNTH_DEFAULT_OCTAVE);
  const [activeNotes, setActiveNotes] = useState<Set<number>>(() => new Set());
  const pianoVisible = pianoOpen;

  const releaseAllNotes = useCallback(() => {
    setActiveNotes((currentNotes) => {
      currentNotes.forEach((midi) => engineRef.current?.noteOff(midi));
      return new Set();
    });
  }, [engineRef]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const updateCompactLayout = () => {
      setPianoOpen(media.matches);
    };

    updateCompactLayout();
    media.addEventListener("change", updateCompactLayout);

    return () => media.removeEventListener("change", updateCompactLayout);
  }, []);

  useEffect(() => {
    engineRef.current?.setSynth(synthWave, SYNTH_LEVEL);
  }, [engineRef, synthWave]);

  useEffect(() => {
    if (!pianoVisible) releaseAllNotes();
  }, [pianoVisible, releaseAllNotes]);

  const togglePiano = () => {
    setPianoOpen((open) => {
      if (open) releaseAllNotes();
      return !open;
    });
  };

  const updateSynthWave = (value: string) => {
    if (!isSynthWave(value)) return;
    setSynthWave(value);
  };

  const updateSynthOctave = (value: number) => {
    releaseAllNotes();
    setSynthOctave(Math.min(SYNTH_MAX_OCTAVE, Math.max(SYNTH_MIN_OCTAVE, value)));
  };

  const handleNoteOn = useCallback(
    (midi: number) => {
      setActiveNotes((currentNotes) => {
        if (currentNotes.has(midi)) return currentNotes;
        const nextNotes = new Set(currentNotes);
        nextNotes.add(midi);
        return nextNotes;
      });
      void getEngine().noteOn(midi);
    },
    [getEngine],
  );

  const handleNoteOff = useCallback(
    (midi: number) => {
      setActiveNotes((currentNotes) => {
        if (!currentNotes.has(midi)) return currentNotes;
        const nextNotes = new Set(currentNotes);
        nextNotes.delete(midi);
        return nextNotes;
      });
      engineRef.current?.noteOff(midi);
    },
    [engineRef],
  );

  return {
    activeNotes,
    handleNoteOff,
    handleNoteOn,
    pianoOpen,
    pianoVisible,
    synthOctave,
    synthWave,
    togglePiano,
    updateSynthOctave,
    updateSynthWave,
  };
}
