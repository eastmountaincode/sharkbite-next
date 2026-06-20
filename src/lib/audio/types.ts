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
  level: number;
  rttMs: number | null;
};

export type TapMetricsUpdate = Partial<TapMetrics>;

export type TapRuntimeSettings = Omit<TapSettings, "enabled">;

export type TapMetricsMap = Record<TapId, TapMetrics>;

export type TapSettingsMap = Record<TapId, TapSettings>;

export type EngineStatus = {
  running: boolean;
  micEnabled: boolean;
  message: string;
};
