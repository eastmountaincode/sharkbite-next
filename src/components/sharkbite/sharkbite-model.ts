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

export type TapButtonVisualState = "off" | "on";
export type TapButtonSide = "left" | "right";

export type TapButtonCapGeometry = {
  x: number;
  y: number;
  size: number;
};

export type TapButtonCapGeometryBySide = Record<
  TapButtonSide,
  Record<TapButtonVisualState, TapButtonCapGeometry>
>;

export type ControlLayoutId =
  | "logo"
  | "outputJack"
  | "inputJack"
  | "inputSource"
  | "wetDry"
  | "inputLevel"
  | TapId;

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
export const SYNTH_LEVEL = 0.8;
export const SYNTH_DEFAULT_OCTAVE = 4;
export const SYNTH_MIN_OCTAVE = 1;
export const SYNTH_MAX_OCTAVE = 6;
export const SYNTH_WAVES: OscillatorType[] = ["triangle", "sine", "sawtooth", "square"];
export const ENABLE_INPUT_AREA_HELPER =
  process.env.NEXT_PUBLIC_SHARKBITE_ENABLE_HELPER === "true" ||
  (process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_SHARKBITE_ENABLE_HELPER !== "false");
export const BUTTON_PRESS_VOLUME = 0.25;
export const HELPER_PANEL_POSITION_STORAGE_KEY = "sharkbite-helper-panel-position";
export const HELPER_PANEL_VIEWPORT_MARGIN = 10;
export const MAX_INPUT_LEVEL = 100;
export const INPUT_LEVEL_START_ANGLE = 240;
export const INPUT_LEVEL_END_ANGLE = -60;
export const INPUT_LEVEL_SPIN_DEAD_ZONE_RATIO = 0.22;
export const INPUT_LEVEL_SPRITE_FRAME_COUNT = 120;
export const INPUT_LEVEL_SPRITE_DEGREES_PER_FRAME = 360 / INPUT_LEVEL_SPRITE_FRAME_COUNT;

export const CONTROL_LAYOUT_IDS: ControlLayoutId[] = [
  "logo",
  "outputJack",
  "inputJack",
  "inputSource",
  "wetDry",
  "inputLevel",
  "rich",
  "sf",
  "fra",
  "blr",
];

export const CONTROL_LAYOUT: Record<ControlLayoutId, AreaPoint> = {
  logo: { x: 49, y: 41.5 },
  outputJack: { x: 21, y: 3.5 },
  inputJack: { x: 79.7, y: 3.5 },
  inputSource: { x: 79.1, y: 17 },
  wetDry: { x: 22.1, y: 35.4 },
  inputLevel: { x: 77.4, y: 35.7 },
  rich: { x: 20, y: 74.1 },
  sf: { x: 39.9, y: 74.4 },
  fra: { x: 60, y: 74.3 },
  blr: { x: 80, y: 74.2 },
};

export const TAP_BUTTON_CAP_GEOMETRY: TapButtonCapGeometryBySide = {
  right: {
    off: { x: 57, y: 50.5, size: 100 },
    on: { x: 54, y: 49, size: 86 },
  },
  left: {
    off: { x: 44.5, y: 50, size: 100 },
    on: { x: 47.5, y: 49.5, size: 86 },
  },
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

export const knobValueToCssRotation = (value: number) =>
  90 - knobValueToAngle(value);

export const roundPointValue = (value: number) => Math.round(value * 10) / 10;

export const clampAreaValue = (value: number) => Math.min(100, Math.max(0, roundPointValue(value)));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const formatControlLayoutConstant = (layout: Record<ControlLayoutId, AreaPoint>) =>
  `const CONTROL_LAYOUT: Record<ControlLayoutId, AreaPoint> = {\n${CONTROL_LAYOUT_IDS.map(
    (id) => `  ${id}: { x: ${layout[id].x}, y: ${layout[id].y} },`,
  ).join("\n")}\n};`;

export const formatTapButtonCapGeometryConstant = (
  geometry: TapButtonCapGeometryBySide,
) =>
  `const TAP_BUTTON_CAP_GEOMETRY: TapButtonCapGeometryBySide = {\n  right: {\n    off: { x: ${geometry.right.off.x}, y: ${geometry.right.off.y}, size: ${geometry.right.off.size} },\n    on: { x: ${geometry.right.on.x}, y: ${geometry.right.on.y}, size: ${geometry.right.on.size} },\n  },\n  left: {\n    off: { x: ${geometry.left.off.x}, y: ${geometry.left.off.y}, size: ${geometry.left.off.size} },\n    on: { x: ${geometry.left.on.x}, y: ${geometry.left.on.y}, size: ${geometry.left.on.size} },\n  },\n};`;

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
