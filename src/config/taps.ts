export type TapId = "rich" | "sf" | "fra" | "blr";

export type TapConfig = {
  id: TapId;
  name: string;
  ip: string;
  color: string;
  defaultEnabled?: boolean;
  roundTripHintMs: number;
};

export const TAPS: TapConfig[] = [
  {
    id: "rich",
    name: "Richmond",
    ip: "165.245.165.45",
    color: "#24a66a",
    roundTripHintMs: 5,
  },
  {
    id: "sf",
    name: "San Francisco",
    ip: "24.199.111.237",
    color: "#1497a5",
    defaultEnabled: true,
    roundTripHintMs: 61,
  },
  {
    id: "fra",
    name: "Frankfurt",
    ip: "64.226.68.99",
    color: "#4f78d8",
    defaultEnabled: true,
    roundTripHintMs: 92,
  },
  {
    id: "blr",
    name: "Bangalore",
    ip: "64.227.150.22",
    color: "#a657c4",
    roundTripHintMs: 213,
  },
];

export const FRAME_SIZES_MS = [5, 10, 20, 40] as const;

export type FrameSizeMs = (typeof FRAME_SIZES_MS)[number];

export const DEFAULT_TAP_SETTINGS = {
  returnLevel: 0.8,
  feedback: 0,
  pan: 0,
};
