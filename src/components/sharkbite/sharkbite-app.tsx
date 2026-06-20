"use client";

import { Minus, Plus, Power, RadioTower, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DEFAULT_TAP_SETTINGS, FRAME_SIZES_MS, TAPS, type FrameSizeMs, type TapId } from "@/config/taps";
import { AudioEngine } from "@/lib/audio/audio-engine";
import { describeConnectionMode } from "@/lib/audio/connection-url";
import type { BufferMode, EngineStatus, TapMetricsMap, TapSettings, TapSettingsMap } from "@/lib/audio/types";
import { RangeControl, SelectControl } from "./control";
import { ModulePanel } from "./module-panel";
import { SynthKeyboard } from "./synth-keyboard";
import { TapRow } from "./tap-row";
import styles from "./sharkbite.module.css";

const INITIAL_STATUS: EngineStatus = {
  running: false,
  micEnabled: false,
  message: "Idle. Audio engine is not started.",
};

const MIN_OCTAVE = 2;
const MAX_OCTAVE = 6;
const MASTER_WET_LEVEL = 1;

function subscribeToConnectionMode() {
  return () => {};
}

function serverConnectionModeSnapshot() {
  return "Checking link";
}

function createTapSettings(): TapSettingsMap {
  return Object.fromEntries(
    TAPS.map((tap) => [
      tap.id,
      {
        enabled: false,
        returnLevel: DEFAULT_TAP_SETTINGS.returnLevel,
        feedback: DEFAULT_TAP_SETTINGS.feedback,
        pan: DEFAULT_TAP_SETTINGS.pan,
      },
    ]),
  ) as TapSettingsMap;
}

function createTapMetrics(): TapMetricsMap {
  return Object.fromEntries(
    TAPS.map((tap) => [
      tap.id,
      {
        connected: false,
        rttMs: null,
        jitterMs: null,
        lossPct: null,
      },
    ]),
  ) as TapMetricsMap;
}

export function SharkbiteApp() {
  const engineRef = useRef<AudioEngine | null>(null);
  const [status, setStatus] = useState(INITIAL_STATUS);
  const [tapSettings, setTapSettings] = useState<TapSettingsMap>(() => createTapSettings());
  const [tapMetrics, setTapMetrics] = useState<TapMetricsMap>(() => createTapMetrics());
  const [activeNotes, setActiveNotes] = useState(() => new Set<number>());
  const [vu, setVu] = useState(0);

  const [wetDry, setWetDryState] = useState(50);
  const [frameSize, setFrameSizeState] = useState<FrameSizeMs>(20);
  const [bufferMode, setBufferModeState] = useState<BufferMode>("buffered");
  const [jitterBuffer, setJitterBufferState] = useState(60);
  const [inputLevel, setInputLevelState] = useState(0);
  const [waveform, setWaveformState] = useState<OscillatorType>("triangle");
  const [synthLevel, setSynthLevelState] = useState(70);
  const [octave, setOctaveState] = useState(4);
  const connectionMode = useSyncExternalStore(
    subscribeToConnectionMode,
    describeConnectionMode,
    serverConnectionModeSnapshot,
  );

  const getEngine = useCallback(() => {
    if (!engineRef.current) {
      engineRef.current = new AudioEngine({
        taps: TAPS,
        onStatus: setStatus,
        onTapEnabledChange: (id, enabled) => {
          setTapSettings((current) => ({
            ...current,
            [id]: { ...current[id], enabled },
          }));
        },
        onTapMetrics: (id, metrics) => {
          setTapMetrics((current) => ({
            ...current,
            [id]: metrics,
          }));
        },
        onVu: setVu,
      });
    }

    return engineRef.current;
  }, []);

  useEffect(() => {
    return () => {
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, []);

  const startAudio = useCallback(async () => {
    const engine = getEngine();
    await engine.start({
      bufferMode,
      frameMs: frameSize,
      inputLevel: inputLevel / 100,
      jitterBufferMs: jitterBuffer,
      masterWet: MASTER_WET_LEVEL,
      synthLevel: synthLevel / 100,
      wetDry: wetDry / 100,
    });
    engine.setSynth(waveform, synthLevel / 100);
  }, [bufferMode, frameSize, getEngine, inputLevel, jitterBuffer, synthLevel, waveform, wetDry]);

  const updateWetDry = (value: number) => {
    setWetDryState(value);
    getEngine().setWetDry(value / 100, MASTER_WET_LEVEL);
  };

  const updateFrameSize = (index: number) => {
    const next = FRAME_SIZES_MS[index] ?? 20;
    setFrameSizeState(next);
    getEngine().setFrameMs(next);
  };

  const updateBufferMode = (value: string) => {
    const next = value as BufferMode;
    setBufferModeState(next);
    getEngine().setBuffering(next, jitterBuffer);
  };

  const updateJitterBuffer = (value: number) => {
    setJitterBufferState(value);
    getEngine().setBuffering(bufferMode, value);
  };

  const updateInputLevel = (value: number) => {
    setInputLevelState(value);
    getEngine().setInputLevel(value / 100);
  };

  const updateWaveform = (value: string) => {
    const next = value as OscillatorType;
    setWaveformState(next);
    getEngine().setSynth(next, synthLevel / 100);
  };

  const updateSynthLevel = (value: number) => {
    setSynthLevelState(value);
    getEngine().setSynth(waveform, value / 100);
  };

  const nudgeOctave = (direction: -1 | 1) => {
    setOctaveState((current) => Math.min(MAX_OCTAVE, Math.max(MIN_OCTAVE, current + direction)));
  };

  const updateTap = (id: TapId, next: TapSettings) => {
    setTapSettings((current) => ({ ...current, [id]: next }));
    getEngine().setTapSettings(id, {
      feedback: next.feedback,
      pan: next.pan,
      returnLevel: next.returnLevel,
    });
  };

  const toggleTap = (id: TapId, enabled: boolean) => {
    if (!status.running && enabled) {
      setStatus({
        running: false,
        micEnabled: false,
        message: "Start audio before enabling a tap.",
      });
      return;
    }
    getEngine().setTapEnabled(id, enabled);
  };

  const noteOn = useCallback(
    (midi: number) => {
      if (!status.running) {
        setStatus({
          running: false,
          micEnabled: false,
          message: "Start audio before playing the synth.",
        });
        return;
      }

      setActiveNotes((current) => new Set(current).add(midi));
      void getEngine().noteOn(midi);
    },
    [getEngine, status.running],
  );

  const noteOff = useCallback(
    (midi: number) => {
      setActiveNotes((current) => {
        const next = new Set(current);
        next.delete(midi);
        return next;
      });
      getEngine().noteOff(midi);
    },
    [getEngine],
  );

  const enabledTapCount = TAPS.filter((tap) => tapSettings[tap.id].enabled).length;
  const frameIndex = FRAME_SIZES_MS.indexOf(frameSize);

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <RadioTower aria-hidden="true" size={18} strokeWidth={2.2} />
          <div>
            <h1>Sharkbite</h1>
            <p>Mic + synth through global echo taps</p>
          </div>
        </div>

        <div className={styles.actions}>
          <span className={styles.modeBadge}>{connectionMode}</span>
          <button className={styles.primaryButton} disabled={status.running} type="button" onClick={startAudio}>
            <Power aria-hidden="true" size={15} />
            Enable Audio
          </button>
          <button className={styles.secondaryButton} disabled={!status.running} type="button" onClick={() => getEngine().panic()}>
            <VolumeX aria-hidden="true" size={15} />
            Panic
          </button>
        </div>
      </header>

      <div className={styles.content}>
        <ModulePanel number="01" status={status.running ? "Live" : "Idle"} title="Mixer">
          <div className={styles.controlGrid}>
            <RangeControl label="Wet / Dry" max={100} min={0} value={wetDry} valueLabel={`${wetDry}%`} onChange={updateWetDry} />
            <RangeControl
              label="Frame Size"
              max={3}
              min={0}
              step={1}
              value={frameIndex}
              valueLabel={`${frameSize} ms`}
              onChange={updateFrameSize}
            />
            <SelectControl label="Buffer Mode" value={bufferMode} onChange={updateBufferMode}>
              <option value="raw">Raw</option>
              <option value="buffered">Buffered</option>
            </SelectControl>
            <RangeControl
              label="Jitter Buffer"
              max={200}
              min={20}
              step={10}
              value={jitterBuffer}
              valueLabel={`${jitterBuffer} ms`}
              onChange={updateJitterBuffer}
            />
            <div className={styles.controlWithMeter}>
              <RangeControl
                label="Input Level"
                max={150}
                min={0}
                value={inputLevel}
                valueLabel={`${inputLevel}%`}
                onChange={updateInputLevel}
              />
              <div className={styles.vu} aria-label="Input level meter">
                <i style={{ width: `${Math.round(vu * 100)}%` }} />
              </div>
            </div>
          </div>
        </ModulePanel>

        <ModulePanel
          number="02"
          title="Synth"
          toolbar={
            <div className={styles.synthToolbar}>
              <SelectControl label="Waveform" value={waveform} onChange={updateWaveform}>
                <option value="sawtooth">Saw</option>
                <option value="square">Square</option>
                <option value="triangle">Triangle</option>
                <option value="sine">Sine</option>
              </SelectControl>
              <RangeControl
                label="Synth Level"
                max={100}
                min={0}
                value={synthLevel}
                valueLabel={`${synthLevel}%`}
                onChange={updateSynthLevel}
              />
              <div className={styles.stepperControl}>
                <span className={styles.controlLabel}>
                  Octave
                  <b>{octave}</b>
                </span>
                <div aria-label="Octave" className={styles.stepper} role="group">
                  <button
                    aria-label="Lower octave"
                    className={styles.stepperButton}
                    disabled={octave <= MIN_OCTAVE}
                    type="button"
                    onClick={() => nudgeOctave(-1)}
                  >
                    <Minus aria-hidden="true" size={14} />
                  </button>
                  <span className={styles.stepperValue}>{octave}</span>
                  <button
                    aria-label="Raise octave"
                    className={styles.stepperButton}
                    disabled={octave >= MAX_OCTAVE}
                    type="button"
                    onClick={() => nudgeOctave(1)}
                  >
                    <Plus aria-hidden="true" size={14} />
                  </button>
                </div>
              </div>
            </div>
          }
        >
          <SynthKeyboard activeNotes={activeNotes} disabled={!status.running} octave={octave} onNoteOff={noteOff} onNoteOn={noteOn} />
        </ModulePanel>

        <ModulePanel number="03" status={`${enabledTapCount} Live`} title="Delay Taps">
          <div className={styles.tapList}>
            {TAPS.map((tap) => (
              <TapRow
                key={tap.id}
                metrics={tapMetrics[tap.id]}
                settings={tapSettings[tap.id]}
                tap={tap}
                onSettingsChange={(next) => updateTap(tap.id, next)}
                onToggle={(enabled) => toggleTap(tap.id, enabled)}
              />
            ))}
          </div>
        </ModulePanel>

        <footer className={styles.statusLine}>
          <span>{status.message}</span>
          <span>{status.micEnabled ? "Mic active" : "Mic inactive"}</span>
        </footer>
      </div>
    </main>
  );
}
