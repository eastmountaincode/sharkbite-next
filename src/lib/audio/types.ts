import type { TapId } from "@/config/taps";

export type BufferMode = "raw" | "buffered";

export type TapSettings = {
  enabled: boolean;
  returnLevel: number;
  feedback: number;
  pan: number;
};

export type TapMetrics = {
  connected: boolean;
  rttMs: number | null;
  jitterMs: number | null;
  lossPct: number | null;
};

export type TapRuntimeSettings = Omit<TapSettings, "enabled">;

export type TapMetricsMap = Record<TapId, TapMetrics>;

export type TapSettingsMap = Record<TapId, TapSettings>;

export type EngineStatus = {
  running: boolean;
  micEnabled: boolean;
  message: string;
};
