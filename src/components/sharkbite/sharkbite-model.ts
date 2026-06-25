import type { PointerEvent as ReactPointerEvent } from "react";
import { TAPS, type FrameSizeMs, type TapId } from "@/config/taps";
import type { BufferMode, EngineStatus, TapMetricsMap } from "@/lib/audio/types";

export const INITIAL_STATUS: EngineStatus = {
  running: false,
  micEnabled: false,
  message: "Idle. Audio engine is not started.",
};

export type AreaPoint = {
  x: number;
  y: number;
};

export type InputAreaPolygon = "hit" | "highlight";
export type InputAreaHelperMode = InputAreaPolygon | "controls";
export type ControlLayoutId = "logo" | "wetDry" | "inputLevel" | TapId;

export type InputAreaDragState = {
  index: number;
  pointerId: number;
  polygon: InputAreaPolygon;
};

export type ControlDragState = {
  id: ControlLayoutId;
  offsetX: number;
  offsetY: number;
  pointerId: number;
};

export type HelperPanelPosition = {
  x: number;
  y: number;
};

export type HelperPanelDragState = {
  offsetX: number;
  offsetY: number;
  pointerId: number;
};

export type AudioInputOption = {
  deviceId: string;
  label: string;
};

export type KnobDragState = {
  currentKnobAngle: number;
  lastPointerAngle: number;
  pointerId: number;
  spinReady: boolean;
};

export const MASTER_WET_LEVEL = 1;
export const FRAME_SIZE_MS: FrameSizeMs = 20;
export const BUFFER_MODE: BufferMode = "buffered";
export const JITTER_BUFFER_MS = 50;
export const DEFAULT_INPUT_DEVICE_ID = "";
export const SYNTH_LEVEL = 0.7;
export const SYNTH_DEFAULT_OCTAVE = 4;
export const SYNTH_MIN_OCTAVE = 1;
export const SYNTH_MAX_OCTAVE = 6;
export const SYNTH_WAVES: OscillatorType[] = ["triangle", "sine", "sawtooth", "square"];
export const ENABLE_INPUT_AREA_HELPER = false;
export const BUTTON_PRESS_VOLUME = 0.25;
export const HELPER_PANEL_POSITION_STORAGE_KEY = "sharkbite-helper-panel-position";
export const HELPER_PANEL_VIEWPORT_MARGIN = 10;
export const MAX_INPUT_LEVEL = 100;
export const INPUT_LEVEL_START_ANGLE = 240;
export const INPUT_LEVEL_END_ANGLE = -60;
export const INPUT_LEVEL_SPIN_DEAD_ZONE_RATIO = 0.22;
export const INPUT_LEVEL_SPRITE_FRAME_COUNT = 120;
export const INPUT_LEVEL_SPRITE_DEGREES_PER_FRAME = 360 / INPUT_LEVEL_SPRITE_FRAME_COUNT;

export const INPUT_HIT_POLYGON: AreaPoint[] = [
  { x: 65.8, y: 6.9 },
  { x: 81.2, y: 6.9 },
  { x: 82.5, y: 15.1 },
  { x: 79.5, y: 22.3 },
  { x: 67.9, y: 22.5 },
  { x: 64.8, y: 15.1 },
];

export const INPUT_HIGHLIGHT_POLYGON: AreaPoint[] = [
  { x: 66.8, y: 6.8 },
  { x: 81.0, y: 6.8 },
  { x: 81.8, y: 11.4 },
  { x: 79.2, y: 14.1 },
  { x: 67.4, y: 14.0 },
  { x: 65.8, y: 10.7 },
];

export const CONTROL_LAYOUT_IDS: ControlLayoutId[] = ["logo", "wetDry", "inputLevel", "rich", "sf", "fra", "blr"];

export const CONTROL_LAYOUT: Record<ControlLayoutId, AreaPoint> = {
  logo: { x: 49, y: 34 },
  wetDry: { x: 23, y: 45.5 },
  inputLevel: { x: 74, y: 45.5 },
  rich: { x: 20, y: 76 },
  sf: { x: 40, y: 76 },
  fra: { x: 60, y: 76 },
  blr: { x: 80, y: 76 },
};

export const INITIAL_TAP_ENABLED = TAPS.reduce(
  (enabled, tap) => ({
    ...enabled,
    [tap.id]: Boolean(tap.defaultEnabled),
  }),
  {} as Record<TapId, boolean>,
);

export const INITIAL_TAP_METRICS = TAPS.reduce(
  (metrics, tap) => ({
    ...metrics,
    [tap.id]: {
      connected: false,
      rttMs: null,
    },
  }),
  {} as TapMetricsMap,
);

export const knobValueToAngle = (value: number) =>
  INPUT_LEVEL_START_ANGLE + (value / MAX_INPUT_LEVEL) * (INPUT_LEVEL_END_ANGLE - INPUT_LEVEL_START_ANGLE);

export const knobAngleToValue = (angle: number) =>
  ((angle - INPUT_LEVEL_START_ANGLE) / (INPUT_LEVEL_END_ANGLE - INPUT_LEVEL_START_ANGLE)) * MAX_INPUT_LEVEL;

export const clampKnobAngle = (angle: number) =>
  Math.min(
    Math.max(INPUT_LEVEL_START_ANGLE, INPUT_LEVEL_END_ANGLE),
    Math.max(Math.min(INPUT_LEVEL_START_ANGLE, INPUT_LEVEL_END_ANGLE), angle),
  );

export const signedAngleDelta = (fromAngle: number, toAngle: number) =>
  ((((toAngle - fromAngle) % 360) + 540) % 360) - 180;

export const normalizeAngle = (angle: number) => ((angle % 360) + 360) % 360;

export const knobValueToFrame = (value: number) =>
  Math.floor(normalizeAngle(knobValueToAngle(value)) / INPUT_LEVEL_SPRITE_DEGREES_PER_FRAME) %
  INPUT_LEVEL_SPRITE_FRAME_COUNT;

export const roundPointValue = (value: number) => Math.round(value * 10) / 10;

export const clampAreaValue = (value: number) => Math.min(100, Math.max(0, roundPointValue(value)));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const formatAreaConstant = (name: string, points: AreaPoint[]) =>
  `const ${name}: AreaPoint[] = [\n${points
    .map((point) => `  { x: ${point.x}, y: ${point.y} },`)
    .join("\n")}\n];`;

export const formatControlLayoutConstant = (layout: Record<ControlLayoutId, AreaPoint>) =>
  `const CONTROL_LAYOUT: Record<ControlLayoutId, AreaPoint> = {\n${CONTROL_LAYOUT_IDS.map(
    (id) => `  ${id}: { x: ${layout[id].x}, y: ${layout[id].y} },`,
  ).join("\n")}\n};`;

export const parseStoredHelperPanelPosition = (value: string | null) => {
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed) || typeof parsed.x !== "number" || typeof parsed.y !== "number") return null;
    if (!Number.isFinite(parsed.x) || !Number.isFinite(parsed.y)) return null;

    return {
      x: Math.round(parsed.x),
      y: Math.round(parsed.y),
    };
  } catch {
    return null;
  }
};

export const clampHelperPanelPosition = (position: HelperPanelPosition, rect?: DOMRect | null) => {
  if (typeof window === "undefined") return position;

  const width = rect?.width ?? 360;
  const height = rect?.height ?? 260;
  const maxX = Math.max(HELPER_PANEL_VIEWPORT_MARGIN, window.innerWidth - width - HELPER_PANEL_VIEWPORT_MARGIN);
  const maxY = Math.max(HELPER_PANEL_VIEWPORT_MARGIN, window.innerHeight - height - HELPER_PANEL_VIEWPORT_MARGIN);

  return {
    x: Math.round(Math.min(maxX, Math.max(HELPER_PANEL_VIEWPORT_MARGIN, position.x))),
    y: Math.round(Math.min(maxY, Math.max(HELPER_PANEL_VIEWPORT_MARGIN, position.y))),
  };
};

export const pointerPositionForElement = (event: ReactPointerEvent<HTMLDivElement>) => {
  const rect = event.currentTarget.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = event.clientX - centerX;
  const dy = event.clientY - centerY;
  const radius = Math.min(rect.width, rect.height) / 2;

  return {
    angle: normalizeAngle((Math.atan2(-dy, dx) * 180) / Math.PI),
    radiusRatio: radius > 0 ? Math.hypot(dx, dy) / radius : 0,
  };
};

export const isSynthWave = (value: string): value is OscillatorType => SYNTH_WAVES.includes(value as OscillatorType);
