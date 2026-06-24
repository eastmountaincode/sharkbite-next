import type { TapId } from "@/config/taps";

export const TAP_SIGNAL_POINTS = 48;

type TapSignalFrame = {
  points: Float32Array;
  updatedAt: number;
};

const signals = new Map<TapId, TapSignalFrame>();

function timestamp() {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

function getOrCreateSignal(id: TapId) {
  let signal = signals.get(id);
  if (!signal) {
    signal = {
      points: new Float32Array(TAP_SIGNAL_POINTS),
      updatedAt: 0,
    };
    signals.set(id, signal);
  }
  return signal;
}

export function writeTapSignalFrame(id: TapId, frame: Float32Array) {
  const signal = getOrCreateSignal(id);

  for (let pointIndex = 0; pointIndex < TAP_SIGNAL_POINTS; pointIndex += 1) {
    const start = Math.floor(pointIndex * frame.length / TAP_SIGNAL_POINTS);
    const end = Math.max(start + 1, Math.floor((pointIndex + 1) * frame.length / TAP_SIGNAL_POINTS));
    let strongest = 0;

    for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
      const sample = frame[sampleIndex] ?? 0;
      if (Math.abs(sample) > Math.abs(strongest)) strongest = sample;
    }

    signal.points[pointIndex] = Math.max(-1, Math.min(1, strongest));
  }

  signal.updatedAt = timestamp();
}

export function clearTapSignalFrame(id: TapId) {
  const signal = getOrCreateSignal(id);
  signal.points.fill(0);
  signal.updatedAt = timestamp();
}

export function readTapSignalFrame(id: TapId) {
  return signals.get(id) ?? null;
}
