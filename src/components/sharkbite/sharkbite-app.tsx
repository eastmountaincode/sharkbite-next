"use client";

import { Minus, Plus, X } from "lucide-react";
import Image from "next/image";
import {
    type CSSProperties,
    type KeyboardEvent as ReactKeyboardEvent,
    type MouseEvent as ReactMouseEvent,
    type PointerEvent as ReactPointerEvent,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import { TAPS, type FrameSizeMs, type TapId } from "@/config/taps";
import { AudioEngine } from "@/lib/audio/audio-engine";
import type { BufferMode, EngineStatus, TapMetricsMap } from "@/lib/audio/types";
import styles from "./sharkbite.module.css";
import { SynthKeyboard } from "./synth-keyboard";

const INITIAL_STATUS: EngineStatus = {
    running: false,
    micEnabled: false,
    message: "Idle. Audio engine is not started.",
};

type AreaPoint = {
    x: number;
    y: number;
};

type InputAreaPolygon = "hit" | "highlight";
type InputAreaHelperMode = InputAreaPolygon | "controls";
type ControlLayoutId = "logo" | "wetDry" | "inputLevel" | TapId;

type InputAreaDragState = {
    index: number;
    pointerId: number;
    polygon: InputAreaPolygon;
};

type ControlDragState = {
    id: ControlLayoutId;
    offsetX: number;
    offsetY: number;
    pointerId: number;
};

type HelperPanelPosition = {
    x: number;
    y: number;
};

type HelperPanelDragState = {
    offsetX: number;
    offsetY: number;
    pointerId: number;
};

const MASTER_WET_LEVEL = 1;
const FRAME_SIZE_MS: FrameSizeMs = 20;
const BUFFER_MODE: BufferMode = "buffered";
const JITTER_BUFFER_MS = 50;
const DEFAULT_INPUT_DEVICE_ID = "";
const SYNTH_LEVEL = 0.7;
const SYNTH_DEFAULT_OCTAVE = 4;
const SYNTH_MIN_OCTAVE = 1;
const SYNTH_MAX_OCTAVE = 6;
const SYNTH_WAVES: OscillatorType[] = ["triangle", "sine", "sawtooth", "square"];
const ENABLE_INPUT_AREA_HELPER = true;
const BUTTON_PRESS_VOLUME = 0.25;
const CONTROL_LAYOUT_STORAGE_KEY = "sharkbite-control-layout";
const INPUT_AREA_POLYGONS_STORAGE_KEY = "sharkbite-input-area-polygons";
const HELPER_PANEL_POSITION_STORAGE_KEY = "sharkbite-helper-panel-position";
const HELPER_PANEL_VIEWPORT_MARGIN = 10;
const MAX_INPUT_LEVEL = 100;
const INPUT_LEVEL_START_ANGLE = 240;
const INPUT_LEVEL_END_ANGLE = -60;
const INPUT_LEVEL_SPIN_DEAD_ZONE_RATIO = 0.22;
const INPUT_LEVEL_SPRITE_FRAME_COUNT = 120;
const INPUT_LEVEL_SPRITE_DEGREES_PER_FRAME = 360 / INPUT_LEVEL_SPRITE_FRAME_COUNT;
const INPUT_HIT_POLYGON: AreaPoint[] = [
    { x: 65.8, y: 6.9 },
    { x: 81.2, y: 6.9 },
    { x: 82.5, y: 15.1 },
    { x: 79.5, y: 22.3 },
    { x: 67.9, y: 22.5 },
    { x: 64.8, y: 15.1 },
];
const INPUT_HIGHLIGHT_POLYGON: AreaPoint[] = [
    { x: 65.2, y: 6.5 },
    { x: 82.1, y: 6.7 },
    { x: 82.9, y: 22.3 },
    { x: 65.0, y: 22.5 },
];
const CONTROL_LAYOUT_IDS: ControlLayoutId[] = ["logo", "wetDry", "inputLevel", "rich", "sf", "fra", "blr"];
const CONTROL_LAYOUT: Record<ControlLayoutId, AreaPoint> = {
    logo: { x: 49, y: 27 },
    wetDry: { x: 23, y: 48 },
    inputLevel: { x: 73, y: 48 },
    rich: { x: 23, y: 76 },
    sf: { x: 36, y: 76 },
    fra: { x: 64, y: 76 },
    blr: { x: 77, y: 76 },
};
const TAP_BUTTON_SIDE: Record<TapId, "left" | "right"> = {
    rich: "left",
    sf: "left",
    fra: "right",
    blr: "right",
};
const INITIAL_TAP_ENABLED = TAPS.reduce(
    (enabled, tap) => ({
        ...enabled,
        [tap.id]: Boolean(tap.defaultEnabled),
    }),
    {} as Record<TapId, boolean>,
);
const INITIAL_TAP_METRICS = TAPS.reduce(
    (metrics, tap) => ({
        ...metrics,
        [tap.id]: {
            connected: false,
            rttMs: null,
        },
    }),
    {} as TapMetricsMap,
);

type AudioInputOption = {
    deviceId: string;
    label: string;
};

type KnobDragState = {
    currentKnobAngle: number;
    lastPointerAngle: number;
    pointerId: number;
    spinReady: boolean;
};

const knobValueToAngle = (value: number) =>
    INPUT_LEVEL_START_ANGLE + (value / MAX_INPUT_LEVEL) * (INPUT_LEVEL_END_ANGLE - INPUT_LEVEL_START_ANGLE);

const knobAngleToValue = (angle: number) =>
    ((angle - INPUT_LEVEL_START_ANGLE) / (INPUT_LEVEL_END_ANGLE - INPUT_LEVEL_START_ANGLE)) * MAX_INPUT_LEVEL;

const clampKnobAngle = (angle: number) =>
    Math.min(Math.max(INPUT_LEVEL_START_ANGLE, INPUT_LEVEL_END_ANGLE), Math.max(Math.min(INPUT_LEVEL_START_ANGLE, INPUT_LEVEL_END_ANGLE), angle));

const signedAngleDelta = (fromAngle: number, toAngle: number) => ((((toAngle - fromAngle) % 360) + 540) % 360) - 180;

const normalizeAngle = (angle: number) => ((angle % 360) + 360) % 360;

const knobValueToFrame = (value: number) =>
    Math.floor(normalizeAngle(knobValueToAngle(value)) / INPUT_LEVEL_SPRITE_DEGREES_PER_FRAME) %
    INPUT_LEVEL_SPRITE_FRAME_COUNT;

const roundPointValue = (value: number) => Math.round(value * 10) / 10;

const clampAreaValue = (value: number) => Math.min(100, Math.max(0, roundPointValue(value)));

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const formatSvgPoints = (points: AreaPoint[]) => points.map((point) => `${point.x},${point.y}`).join(" ");

const formatAreaConstant = (name: string, points: AreaPoint[]) =>
    `const ${name}: AreaPoint[] = [\n${points
        .map((point) => `  { x: ${point.x}, y: ${point.y} },`)
        .join("\n")}\n];`;

const formatControlLayoutConstant = (layout: Record<ControlLayoutId, AreaPoint>) =>
    `const CONTROL_LAYOUT: Record<ControlLayoutId, AreaPoint> = {\n${CONTROL_LAYOUT_IDS.map(
        (id) => `  ${id}: { x: ${layout[id].x}, y: ${layout[id].y} },`,
    ).join("\n")}\n};`;

const parseStoredControlLayout = (value: string | null) => {
    if (!value) return null;

    try {
        const parsed: unknown = JSON.parse(value);
        if (!isRecord(parsed)) return null;

        const nextLayout = { ...CONTROL_LAYOUT };
        for (const id of CONTROL_LAYOUT_IDS) {
            const point = parsed[id];
            if (point === undefined) continue;
            if (!isRecord(point) || typeof point.x !== "number" || typeof point.y !== "number") return null;
            if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;

            nextLayout[id] = {
                x: clampAreaValue(point.x),
                y: clampAreaValue(point.y),
            };
        }

        return nextLayout;
    } catch {
        return null;
    }
};

const parseStoredAreaPoints = (value: unknown) => {
    if (!Array.isArray(value) || value.length < 3) return null;

    const points = value.map((point) => {
        if (!isRecord(point) || typeof point.x !== "number" || typeof point.y !== "number") return null;
        if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;

        return {
            x: clampAreaValue(point.x),
            y: clampAreaValue(point.y),
        };
    });

    if (points.some((point) => point === null)) return null;
    return points as AreaPoint[];
};

const parseStoredInputAreaPolygons = (value: string | null) => {
    if (!value) return null;

    try {
        const parsed: unknown = JSON.parse(value);
        if (!isRecord(parsed)) return null;

        const hit = parseStoredAreaPoints(parsed.hit);
        const highlight = parseStoredAreaPoints(parsed.highlight);
        if (!hit && !highlight) return null;

        return { hit, highlight };
    } catch {
        return null;
    }
};

const parseStoredHelperPanelPosition = (value: string | null) => {
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

const clampHelperPanelPosition = (position: HelperPanelPosition, rect?: DOMRect | null) => {
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

const pointerPositionForElement = (event: ReactPointerEvent<HTMLDivElement>) => {
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

const formatDelay = (value: number | null) => {
    if (value === null || Number.isNaN(value)) return "--";
    return `${Math.round(value)}ms`;
};

const isSynthWave = (value: string): value is OscillatorType => SYNTH_WAVES.includes(value as OscillatorType);

export function SharkbiteApp() {
    const engineRef = useRef<AudioEngine | null>(null);
    const buttonPressAudioRef = useRef<HTMLAudioElement | null>(null);
    const dialogCloseRef = useRef<HTMLButtonElement | null>(null);
    const infoDialogCloseRef = useRef<HTMLButtonElement | null>(null);
    const helperPanelRef = useRef<HTMLElement | null>(null);
    const inputAreaSvgRef = useRef<SVGSVGElement | null>(null);
    const inputLevelDragRef = useRef<KnobDragState | null>(null);
    const wetDryDragRef = useRef<KnobDragState | null>(null);
    const controlDragRef = useRef<ControlDragState | null>(null);
    const helperPanelDragRef = useRef<HelperPanelDragState | null>(null);
    const [status, setStatus] = useState(INITIAL_STATUS);
    const [audioInputs, setAudioInputs] = useState<AudioInputOption[]>([]);
    const [inputDeviceId, setInputDeviceId] = useState(DEFAULT_INPUT_DEVICE_ID);
    const [inputHitPolygon, setInputHitPolygon] = useState(INPUT_HIT_POLYGON);
    const [inputHighlightPolygon, setInputHighlightPolygon] = useState(INPUT_HIGHLIGHT_POLYGON);
    const [inputJackActive, setInputJackActive] = useState(false);
    const [inputLevel, setInputLevelState] = useState(0);
    const [inputLevelDragging, setInputLevelDragging] = useState(false);
    const [wetDry, setWetDryState] = useState(50);
    const [wetDryDragging, setWetDryDragging] = useState(false);
    const [enabledTaps, setEnabledTaps] = useState(INITIAL_TAP_ENABLED);
    const [tapMetrics, setTapMetrics] = useState<TapMetricsMap>(INITIAL_TAP_METRICS);
    const [controlLayout, setControlLayout] = useState(CONTROL_LAYOUT);
    const [inputAreaDragState, setInputAreaDragState] = useState<InputAreaDragState | null>(null);
    const [controlDragState, setControlDragState] = useState<ControlDragState | null>(null);
    const [inputAreaHelperVisible, setInputAreaHelperVisible] = useState(false);
    const [inputAreaHelperMode, setInputAreaHelperMode] = useState<InputAreaHelperMode>("highlight");
    const [inputDialogOpen, setInputDialogOpen] = useState(false);
    const [infoDialogOpen, setInfoDialogOpen] = useState(false);
    const [helperPanelPosition, setHelperPanelPosition] = useState<HelperPanelPosition | null>(null);
    const [helperPanelDragging, setHelperPanelDragging] = useState(false);
    const [storedHelperStateReady, setStoredHelperStateReady] = useState(false);
    const [startScreenVisible, setStartScreenVisible] = useState(true);
    const [startingAudio, setStartingAudio] = useState(false);
    const [inputMonitorLevel, setInputMonitorLevel] = useState(0);
    const [pianoOpen, setPianoOpen] = useState(false);
    const [synthWave, setSynthWave] = useState<OscillatorType>("triangle");
    const [synthOctave, setSynthOctave] = useState(SYNTH_DEFAULT_OCTAVE);
    const [activeNotes, setActiveNotes] = useState<Set<number>>(() => new Set());
    const updateInputMonitorLevel = useCallback((level: number) => {
        setInputMonitorLevel((currentLevel) => (Math.abs(currentLevel - level) < 0.015 ? currentLevel : level));
    }, []);
    const pianoVisible = pianoOpen;

    const getEngine = useCallback(() => {
        if (!engineRef.current) {
            engineRef.current = new AudioEngine({
                taps: TAPS,
                onStatus: setStatus,
                onTapEnabledChange: (tapId, enabled) => {
                    setEnabledTaps((current) => ({ ...current, [tapId]: enabled }));
                },
                onTapMetrics: (tapId, metrics) => {
                    setTapMetrics((current) => ({
                        ...current,
                        [tapId]: {
                            ...current[tapId],
                            ...metrics,
                        },
                    }));
                },
                onVu: updateInputMonitorLevel,
            });
        }

        return engineRef.current;
    }, [updateInputMonitorLevel]);

    const refreshAudioInputs = useCallback(async () => {
        if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return;

        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const seen = new Set<string>();
            const inputs = devices
                .filter((device) => device.kind === "audioinput" && device.deviceId && device.deviceId !== "default")
                .filter((device) => {
                    if (seen.has(device.deviceId)) return false;
                    seen.add(device.deviceId);
                    return true;
                })
                .map((device, index) => ({
                    deviceId: device.deviceId,
                    label: device.label || `Input ${index + 1}`,
                }));

            setAudioInputs(inputs);
        } catch {
            setAudioInputs([]);
        }
    }, []);

    useEffect(() => {
        return () => {
            engineRef.current?.destroy();
            engineRef.current = null;
        };
    }, []);

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
        window.queueMicrotask(() => {
            try {
                const storedControlLayout = parseStoredControlLayout(window.localStorage.getItem(CONTROL_LAYOUT_STORAGE_KEY));
                const storedInputAreaPolygons = parseStoredInputAreaPolygons(
                    window.localStorage.getItem(INPUT_AREA_POLYGONS_STORAGE_KEY),
                );
                const storedHelperPanelPosition = parseStoredHelperPanelPosition(
                    window.localStorage.getItem(HELPER_PANEL_POSITION_STORAGE_KEY),
                );

                if (storedControlLayout) setControlLayout(storedControlLayout);
                if (storedInputAreaPolygons?.hit) setInputHitPolygon(storedInputAreaPolygons.hit);
                if (storedInputAreaPolygons?.highlight) setInputHighlightPolygon(storedInputAreaPolygons.highlight);
                if (storedHelperPanelPosition) setHelperPanelPosition(storedHelperPanelPosition);
            } catch {
                // Helper persistence is non-critical; the checked-in layout remains the fallback.
            } finally {
                setStoredHelperStateReady(true);
            }
        });
    }, []);

    useEffect(() => {
        if (!storedHelperStateReady) return;

        try {
            window.localStorage.setItem(CONTROL_LAYOUT_STORAGE_KEY, JSON.stringify(controlLayout));
        } catch {
            // Ignore private-mode or quota failures; the in-session layout still works.
        }
    }, [controlLayout, storedHelperStateReady]);

    useEffect(() => {
        if (!storedHelperStateReady) return;

        try {
            window.localStorage.setItem(
                INPUT_AREA_POLYGONS_STORAGE_KEY,
                JSON.stringify({
                    hit: inputHitPolygon,
                    highlight: inputHighlightPolygon,
                }),
            );
        } catch {
            // Ignore private-mode or quota failures; the in-session polygons still work.
        }
    }, [inputHitPolygon, inputHighlightPolygon, storedHelperStateReady]);

    useEffect(() => {
        if (!storedHelperStateReady) return;

        try {
            if (helperPanelPosition) {
                window.localStorage.setItem(HELPER_PANEL_POSITION_STORAGE_KEY, JSON.stringify(helperPanelPosition));
            } else {
                window.localStorage.removeItem(HELPER_PANEL_POSITION_STORAGE_KEY);
            }
        } catch {
            // Ignore private-mode or quota failures; the panel remains draggable.
        }
    }, [helperPanelPosition, storedHelperStateReady]);

    useEffect(() => {
        if (!inputAreaHelperVisible || !helperPanelPosition) return;

        const rect = helperPanelRef.current?.getBoundingClientRect();
        const nextPosition = clampHelperPanelPosition(helperPanelPosition, rect);
        if (nextPosition.x !== helperPanelPosition.x || nextPosition.y !== helperPanelPosition.y) {
            setHelperPanelPosition(nextPosition);
        }
    }, [helperPanelPosition, inputAreaHelperVisible]);

    useEffect(() => {
        const refreshTimer = window.setTimeout(() => {
            void refreshAudioInputs();
        }, 0);

        const handleDeviceChange = () => {
            void refreshAudioInputs();
        };

        if (typeof navigator === "undefined" || !navigator.mediaDevices?.addEventListener) {
            return () => window.clearTimeout(refreshTimer);
        }

        navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
        return () => {
            window.clearTimeout(refreshTimer);
            navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
        };
    }, [refreshAudioInputs]);

    useEffect(() => {
        if (!inputDialogOpen) return;

        dialogCloseRef.current?.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setInputDialogOpen(false);
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [inputDialogOpen, refreshAudioInputs]);

    useEffect(() => {
        if (!infoDialogOpen) return;

        infoDialogCloseRef.current?.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setInfoDialogOpen(false);
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [infoDialogOpen]);

    useEffect(() => {
        if (!ENABLE_INPUT_AREA_HELPER) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target instanceof HTMLElement ? event.target : null;
            const targetIsEditable =
                target?.tagName === "INPUT" ||
                target?.tagName === "SELECT" ||
                target?.tagName === "TEXTAREA" ||
                target?.isContentEditable;

            const isHelperKey = event.key.toLowerCase() === "h" || event.code === "KeyH";

            if (
                targetIsEditable ||
                event.metaKey ||
                event.ctrlKey ||
                event.altKey ||
                !isHelperKey ||
                pianoVisible ||
                infoDialogOpen ||
                inputDialogOpen
            ) {
                return;
            }

            event.preventDefault();
            setInputAreaHelperVisible((visible) => !visible);
        };

        document.addEventListener("keydown", handleKeyDown, true);
        return () => document.removeEventListener("keydown", handleKeyDown, true);
    }, [infoDialogOpen, inputDialogOpen, pianoVisible]);

    const startAudio = useCallback(async () => {
        const engine = getEngine();
        await engine.start({
            bufferMode: BUFFER_MODE,
            frameMs: FRAME_SIZE_MS,
            inputDeviceId: inputDeviceId || undefined,
            inputLevel: inputLevel / 100,
            jitterBufferMs: JITTER_BUFFER_MS,
            masterWet: MASTER_WET_LEVEL,
            synthLevel: SYNTH_LEVEL,
            wetDry: wetDry / 100,
        });
        engine.setSynth(synthWave, SYNTH_LEVEL);
        await refreshAudioInputs();
    }, [getEngine, inputDeviceId, inputLevel, refreshAudioInputs, synthWave, wetDry]);

    const startFromSplash = async () => {
        if (startingAudio) return;

        setStartingAudio(true);
        try {
            await startAudio();
            setStartScreenVisible(false);
        } catch {
            setStatus({
                running: false,
                micEnabled: false,
                message: "Audio could not start in this browser.",
            });
        } finally {
            setStartingAudio(false);
        }
    };

    const updateInputLevel = useCallback((value: number) => {
        const nextLevel = Math.min(MAX_INPUT_LEVEL, Math.max(0, Math.round(value)));
        setInputLevelState(nextLevel);
        engineRef.current?.setInputLevel(nextLevel / 100);
    }, []);

    const updateWetDry = useCallback((value: number) => {
        const nextWetDry = Math.min(MAX_INPUT_LEVEL, Math.max(0, Math.round(value)));
        setWetDryState(nextWetDry);
        engineRef.current?.setWetDry(nextWetDry / 100, MASTER_WET_LEVEL);
    }, []);

    const releaseAllNotes = useCallback(() => {
        setActiveNotes((currentNotes) => {
            currentNotes.forEach((midi) => engineRef.current?.noteOff(midi));
            return new Set();
        });
    }, []);

    useEffect(() => {
        engineRef.current?.setSynth(synthWave, SYNTH_LEVEL);
    }, [synthWave]);

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

    const handleNoteOff = useCallback((midi: number) => {
        setActiveNotes((currentNotes) => {
            if (!currentNotes.has(midi)) return currentNotes;
            const nextNotes = new Set(currentNotes);
            nextNotes.delete(midi);
            return nextNotes;
        });
        engineRef.current?.noteOff(midi);
    }, []);

    const playButtonPress = useCallback(() => {
        const sound = buttonPressAudioRef.current;
        if (!sound) return;

        sound.volume = BUTTON_PRESS_VOLUME;
        sound.currentTime = 0;
        void sound.play().catch(() => {
            // Browser autoplay policy may block this until a user gesture unlocks audio.
        });
    }, []);

    const toggleTap = (tapId: TapId) => {
        playButtonPress();
        getEngine().setTapEnabled(tapId, !enabledTaps[tapId]);
    };

    const stopInputLevelDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (inputLevelDragRef.current?.pointerId !== event.pointerId) return;

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }

        inputLevelDragRef.current = null;
        setInputLevelDragging(false);
    };

    const handleInputLevelPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;

        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        const startPointer = pointerPositionForElement(event);
        inputLevelDragRef.current = {
            currentKnobAngle: knobValueToAngle(inputLevel),
            lastPointerAngle: startPointer.angle,
            pointerId: event.pointerId,
            spinReady: startPointer.radiusRatio >= INPUT_LEVEL_SPIN_DEAD_ZONE_RATIO,
        };
        setInputLevelDragging(true);
    };

    const handleInputLevelPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        const dragState = inputLevelDragRef.current;
        if (!dragState || dragState.pointerId !== event.pointerId) return;

        event.preventDefault();
        const nextPointer = pointerPositionForElement(event);

        if (!dragState.spinReady && nextPointer.radiusRatio < INPUT_LEVEL_SPIN_DEAD_ZONE_RATIO) return;
        if (!dragState.spinReady) {
            dragState.spinReady = true;
            dragState.lastPointerAngle = nextPointer.angle;
            return;
        }

        const nextKnobAngle = clampKnobAngle(
            dragState.currentKnobAngle + signedAngleDelta(dragState.lastPointerAngle, nextPointer.angle),
        );
        dragState.lastPointerAngle = nextPointer.angle;
        dragState.currentKnobAngle = nextKnobAngle;
        updateInputLevel(knobAngleToValue(nextKnobAngle));
    };

    const handleInputLevelLostPointerCapture = () => {
        inputLevelDragRef.current = null;
        setInputLevelDragging(false);
    };

    const handleInputLevelKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
        const largeStep = event.shiftKey ? 10 : 5;
        const smallStep = event.shiftKey ? 5 : 1;

        switch (event.key) {
            case "ArrowUp":
            case "ArrowRight":
                event.preventDefault();
                updateInputLevel(inputLevel + smallStep);
                break;
            case "ArrowDown":
            case "ArrowLeft":
                event.preventDefault();
                updateInputLevel(inputLevel - smallStep);
                break;
            case "PageUp":
                event.preventDefault();
                updateInputLevel(inputLevel + largeStep);
                break;
            case "PageDown":
                event.preventDefault();
                updateInputLevel(inputLevel - largeStep);
                break;
            case "Home":
                event.preventDefault();
                updateInputLevel(0);
                break;
            case "End":
                event.preventDefault();
                updateInputLevel(MAX_INPUT_LEVEL);
                break;
        }
    };

    const stopWetDryDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (wetDryDragRef.current?.pointerId !== event.pointerId) return;

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }

        wetDryDragRef.current = null;
        setWetDryDragging(false);
    };

    const handleWetDryPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;

        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        const startPointer = pointerPositionForElement(event);
        wetDryDragRef.current = {
            currentKnobAngle: knobValueToAngle(wetDry),
            lastPointerAngle: startPointer.angle,
            pointerId: event.pointerId,
            spinReady: startPointer.radiusRatio >= INPUT_LEVEL_SPIN_DEAD_ZONE_RATIO,
        };
        setWetDryDragging(true);
    };

    const handleWetDryPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        const dragState = wetDryDragRef.current;
        if (!dragState || dragState.pointerId !== event.pointerId) return;

        event.preventDefault();
        const nextPointer = pointerPositionForElement(event);

        if (!dragState.spinReady && nextPointer.radiusRatio < INPUT_LEVEL_SPIN_DEAD_ZONE_RATIO) return;
        if (!dragState.spinReady) {
            dragState.spinReady = true;
            dragState.lastPointerAngle = nextPointer.angle;
            return;
        }

        const nextKnobAngle = clampKnobAngle(
            dragState.currentKnobAngle + signedAngleDelta(dragState.lastPointerAngle, nextPointer.angle),
        );
        dragState.lastPointerAngle = nextPointer.angle;
        dragState.currentKnobAngle = nextKnobAngle;
        updateWetDry(knobAngleToValue(nextKnobAngle));
    };

    const handleWetDryLostPointerCapture = () => {
        wetDryDragRef.current = null;
        setWetDryDragging(false);
    };

    const handleWetDryKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
        const largeStep = event.shiftKey ? 10 : 5;
        const smallStep = event.shiftKey ? 5 : 1;

        switch (event.key) {
            case "ArrowUp":
            case "ArrowRight":
                event.preventDefault();
                updateWetDry(wetDry + smallStep);
                break;
            case "ArrowDown":
            case "ArrowLeft":
                event.preventDefault();
                updateWetDry(wetDry - smallStep);
                break;
            case "PageUp":
                event.preventDefault();
                updateWetDry(wetDry + largeStep);
                break;
            case "PageDown":
                event.preventDefault();
                updateWetDry(wetDry - largeStep);
                break;
            case "Home":
                event.preventDefault();
                updateWetDry(0);
                break;
            case "End":
                event.preventDefault();
                updateWetDry(MAX_INPUT_LEVEL);
                break;
        }
    };

    const updateInputDevice = (value: string) => {
        setInputDeviceId(value);

        if (!status.running) return;
        void getEngine().setInputDevice(value || undefined).then(refreshAudioInputs);
    };

    const openInputDialog = () => {
        setInputDialogOpen(true);
        void refreshAudioInputs();
    };

    const getPedalPoint = (clientX: number, clientY: number) => {
        const svg = inputAreaSvgRef.current;
        if (!svg) return null;

        const rect = svg.getBoundingClientRect();
        return {
            x: clampAreaValue(((clientX - rect.left) / rect.width) * 100),
            y: clampAreaValue(((clientY - rect.top) / rect.height) * 100),
        };
    };

    const getInputAreaPoint = (event: ReactPointerEvent<SVGSVGElement>) => getPedalPoint(event.clientX, event.clientY);

    const updateInputAreaPoint = (polygon: InputAreaPolygon, index: number, nextPoint: AreaPoint) => {
        const update = (points: AreaPoint[]) => points.map((point, pointIndex) => (pointIndex === index ? nextPoint : point));
        if (polygon === "hit") setInputHitPolygon(update);
        else setInputHighlightPolygon(update);
    };

    const setInputAreaPolygon = (polygon: InputAreaPolygon, points: AreaPoint[]) => {
        if (polygon === "hit") setInputHitPolygon(points);
        else setInputHighlightPolygon(points);
    };

    const setControlPosition = (id: ControlLayoutId, nextPoint: AreaPoint) => {
        setControlLayout((current) => ({
            ...current,
            [id]: nextPoint,
        }));
    };

    const handleInputAreaEditorPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
        if (!inputAreaDragState || inputAreaDragState.pointerId !== event.pointerId) return;

        const nextPoint = getInputAreaPoint(event);
        if (!nextPoint) return;

        event.preventDefault();
        updateInputAreaPoint(inputAreaDragState.polygon, inputAreaDragState.index, nextPoint);
    };

    const stopInputAreaEditorDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
        if (inputAreaDragState?.pointerId !== event.pointerId) return;
        setInputAreaDragState(null);
    };

    const handleInputAreaEditorDoubleClick = (event: ReactMouseEvent<SVGSVGElement>) => {
        if (
            !ENABLE_INPUT_AREA_HELPER ||
            !inputAreaHelperVisible ||
            inputAreaHelperMode === "controls" ||
            event.target instanceof SVGCircleElement
        ) {
            return;
        }

        const rect = event.currentTarget.getBoundingClientRect();
        const nextPoint = {
            x: clampAreaValue(((event.clientX - rect.left) / rect.width) * 100),
            y: clampAreaValue(((event.clientY - rect.top) / rect.height) * 100),
        };
        const points = inputAreaHelperMode === "hit" ? inputHitPolygon : inputHighlightPolygon;
        setInputAreaPolygon(inputAreaHelperMode, [...points, nextPoint]);
    };

    const resetInputAreaPolygon = (polygon: InputAreaPolygon) => {
        setInputAreaPolygon(polygon, polygon === "hit" ? INPUT_HIT_POLYGON : INPUT_HIGHLIGHT_POLYGON);
    };

    const copyInputAreaPolygons = () => {
        const text = [
            formatAreaConstant("INPUT_HIT_POLYGON", inputHitPolygon),
            formatAreaConstant("INPUT_HIGHLIGHT_POLYGON", inputHighlightPolygon),
        ].join("\n\n");

        void navigator.clipboard?.writeText(text);
    };

    const copyControlLayout = () => {
        void navigator.clipboard?.writeText(formatControlLayoutConstant(controlLayout));
    };

    const startControlDrag = (id: ControlLayoutId, event: ReactPointerEvent<HTMLElement>) => {
        if (!ENABLE_INPUT_AREA_HELPER || !inputAreaHelperVisible || inputAreaHelperMode !== "controls") return;
        if (event.button !== 0) return;

        const pointerPoint = getPedalPoint(event.clientX, event.clientY);
        if (!pointerPoint) return;

        event.preventDefault();
        event.stopPropagation();
        try {
            event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
            // Synthetic pointer events in verification do not have an active pointer.
        }
        const nextDragState = {
            id,
            offsetX: pointerPoint.x - controlLayout[id].x,
            offsetY: pointerPoint.y - controlLayout[id].y,
            pointerId: event.pointerId,
        };
        controlDragRef.current = nextDragState;
        setControlDragState(nextDragState);
    };

    const handleControlDragPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
        const dragState = controlDragRef.current;
        if (!dragState || dragState.pointerId !== event.pointerId) return;

        const pointerPoint = getPedalPoint(event.clientX, event.clientY);
        if (!pointerPoint) return;

        event.preventDefault();
        event.stopPropagation();
        setControlPosition(dragState.id, {
            x: clampAreaValue(pointerPoint.x - dragState.offsetX),
            y: clampAreaValue(pointerPoint.y - dragState.offsetY),
        });
    };

    const stopControlDrag = (event: ReactPointerEvent<HTMLElement>) => {
        if (controlDragRef.current?.pointerId !== event.pointerId) return;

        try {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
            }
        } catch {
            // Matching guard for synthetic verification events.
        }

        event.preventDefault();
        event.stopPropagation();
        controlDragRef.current = null;
        setControlDragState(null);
    };

    const startHelperPanelDrag = (event: ReactPointerEvent<HTMLElement>) => {
        if (event.button !== 0) return;

        const panel = helperPanelRef.current;
        if (!panel) return;

        const rect = panel.getBoundingClientRect();
        event.preventDefault();
        try {
            event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
            // Synthetic pointer events in verification do not have an active pointer.
        }

        helperPanelDragRef.current = {
            offsetX: event.clientX - rect.left,
            offsetY: event.clientY - rect.top,
            pointerId: event.pointerId,
        };
        setHelperPanelPosition(clampHelperPanelPosition({ x: rect.left, y: rect.top }, rect));
        setHelperPanelDragging(true);
    };

    const handleHelperPanelDragPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
        const dragState = helperPanelDragRef.current;
        if (!dragState || dragState.pointerId !== event.pointerId) return;

        const rect = helperPanelRef.current?.getBoundingClientRect();
        event.preventDefault();
        setHelperPanelPosition(
            clampHelperPanelPosition(
                {
                    x: event.clientX - dragState.offsetX,
                    y: event.clientY - dragState.offsetY,
                },
                rect,
            ),
        );
    };

    const stopHelperPanelDrag = (event: ReactPointerEvent<HTMLElement>) => {
        if (helperPanelDragRef.current?.pointerId !== event.pointerId) return;

        try {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
            }
        } catch {
            // Matching guard for synthetic verification events.
        }

        event.preventDefault();
        helperPanelDragRef.current = null;
        setHelperPanelDragging(false);
    };

    const inputKnobStyle = {
        "--input-level-frame": knobValueToFrame(inputLevel),
        "--control-x": `${controlLayout.inputLevel.x}%`,
        "--control-y": `${controlLayout.inputLevel.y}%`,
    } as CSSProperties;
    const inputMeterStyle = {
        ...inputKnobStyle,
        "--input-meter-level": inputMonitorLevel,
    } as CSSProperties;
    const wetDryKnobStyle = {
        "--input-level-frame": knobValueToFrame(wetDry),
        "--control-x": `${controlLayout.wetDry.x}%`,
        "--control-y": `${controlLayout.wetDry.y}%`,
    } as CSSProperties;
    const logoStyle = {
        "--control-x": `${controlLayout.logo.x}%`,
        "--control-y": `${controlLayout.logo.y}%`,
    } as CSSProperties;
    const helperPanelStyle = helperPanelPosition
        ? ({
            bottom: "auto",
            left: `${helperPanelPosition.x}px`,
            right: "auto",
            top: `${helperPanelPosition.y}px`,
        } as CSSProperties)
        : undefined;
    const controlMoveModeActive = ENABLE_INPUT_AREA_HELPER && inputAreaHelperVisible && inputAreaHelperMode === "controls";
    const polygonHelperActive = ENABLE_INPUT_AREA_HELPER && inputAreaHelperVisible && inputAreaHelperMode !== "controls";
    const activeInputAreaHelperPolygon: InputAreaPolygon = inputAreaHelperMode === "hit" ? "hit" : "highlight";
    const activeInputAreaPolygon = activeInputAreaHelperPolygon === "hit" ? inputHitPolygon : inputHighlightPolygon;
    const inputAreaClipboardText = [
        formatAreaConstant("INPUT_HIT_POLYGON", inputHitPolygon),
        formatAreaConstant("INPUT_HIGHLIGHT_POLYGON", inputHighlightPolygon),
    ].join("\n\n");
    const controlLayoutClipboardText = formatControlLayoutConstant(controlLayout);
    const helperClipboardText = inputAreaHelperMode === "controls" ? controlLayoutClipboardText : inputAreaClipboardText;

    return (
        <main className={styles.shell} data-piano-open={pianoOpen ? "true" : "false"}>
            <audio ref={buttonPressAudioRef} preload="auto" src="/assets/sharkbite/button-press.mp3" />
            {!startScreenVisible ? (
                <button
                    aria-controls="sharkbite-info"
                    aria-expanded={infoDialogOpen}
                    className={styles.infoToggle}
                    type="button"
                    onClick={() => setInfoDialogOpen(true)}
                >
                    More Info
                </button>
            ) : null}
            <button
                aria-expanded={pianoVisible}
                aria-controls="sharkbite-piano"
                className={styles.pianoToggle}
                type="button"
                onClick={togglePiano}
            >
                {pianoVisible ? "Hide Piano" : "Show Piano"}
            </button>
            <section aria-label="Sharkbite pedal work surface" className={styles.pedalStage}>
                <div className={styles.pedalCanvas}>
                    <div
                        className={styles.pedalOverlay}
                        data-input-active={inputJackActive || inputDialogOpen ? "true" : "false"}
                    >
                        <svg
                            ref={inputAreaSvgRef}
                            className={styles.inputAreaSvg}
                            preserveAspectRatio="none"
                            viewBox="0 0 100 100"
                            onDoubleClick={handleInputAreaEditorDoubleClick}
                            onPointerCancel={stopInputAreaEditorDrag}
                            onPointerMove={handleInputAreaEditorPointerMove}
                            onPointerUp={stopInputAreaEditorDrag}
                        >
                            <polygon className={styles.inputHighlightPolygon} points={formatSvgPoints(inputHighlightPolygon)} />
                            <polygon
                                aria-label="Open input settings"
                                className={styles.inputHitPolygon}
                                points={formatSvgPoints(inputHitPolygon)}
                                role="button"
                                tabIndex={0}
                                onBlur={() => setInputJackActive(false)}
                                onClick={() => {
                                    if (!inputAreaHelperVisible) openInputDialog();
                                }}
                                onFocus={() => setInputJackActive(true)}
                                onKeyDown={(event) => {
                                    if (event.key !== "Enter" && event.key !== " ") return;
                                    event.preventDefault();
                                    if (!inputAreaHelperVisible) openInputDialog();
                                }}
                                onPointerEnter={() => setInputJackActive(true)}
                                onPointerLeave={() => setInputJackActive(false)}
                            />
                            {polygonHelperActive ? (
                                <g className={styles.inputAreaEditorLayer}>
                                    <polygon className={styles.inputAreaEditorPolygon} points={formatSvgPoints(activeInputAreaPolygon)} />
                                    {activeInputAreaPolygon.map((point, index) => (
                                        <g key={`${activeInputAreaHelperPolygon}-${index}`}>
                                            <circle
                                                className={styles.inputAreaEditorPointTarget}
                                                cx={point.x}
                                                cy={point.y}
                                                r="1.25"
                                                onPointerDown={(event) => {
                                                    event.preventDefault();
                                                    event.currentTarget.setPointerCapture(event.pointerId);
                                                    setInputAreaDragState({
                                                        index,
                                                        pointerId: event.pointerId,
                                                        polygon: activeInputAreaHelperPolygon,
                                                    });
                                                }}
                                            />
                                            <circle className={styles.inputAreaEditorPoint} cx={point.x} cy={point.y} r="0.42" />
                                        </g>
                                    ))}
                                </g>
                            ) : null}
                        </svg>
                        <div
                            aria-label="Shark Byte logo"
                            className={styles.pedalLogoControl}
                            data-helper-draggable={controlMoveModeActive ? "true" : "false"}
                            data-helper-dragging={controlDragState?.id === "logo" ? "true" : "false"}
                            style={logoStyle}
                            onPointerCancelCapture={stopControlDrag}
                            onPointerDownCapture={(event) => startControlDrag("logo", event)}
                            onPointerMoveCapture={handleControlDragPointerMove}
                            onPointerUpCapture={stopControlDrag}
                        >
                            <Image
                                priority
                                unoptimized
                                alt="Shark Byte"
                                className={styles.pedalLogoImage}
                                height={497}
                                src="/assets/sharkbite/logo.png"
                                width={688}
                            />
                        </div>
                        <span className={`${styles.jackLabel} ${styles.inputJackLabel}`}>Input Source</span>
                        <div
                            aria-label="Dry wet mix"
                            aria-valuemax={MAX_INPUT_LEVEL}
                            aria-valuemin={0}
                            aria-valuenow={wetDry}
                            aria-valuetext={`${MAX_INPUT_LEVEL - wetDry}% dry, ${wetDry}% wet`}
                            className={`${styles.knobControl} ${styles.wetDryControl}`}
                            data-dragging={wetDryDragging}
                            data-helper-draggable={controlMoveModeActive ? "true" : "false"}
                            data-helper-dragging={controlDragState?.id === "wetDry" ? "true" : "false"}
                            role="slider"
                            style={wetDryKnobStyle}
                            tabIndex={0}
                            onKeyDown={handleWetDryKeyDown}
                            onLostPointerCapture={handleWetDryLostPointerCapture}
                            onPointerCancel={stopWetDryDrag}
                            onPointerCancelCapture={stopControlDrag}
                            onPointerDown={handleWetDryPointerDown}
                            onPointerDownCapture={(event) => startControlDrag("wetDry", event)}
                            onPointerMove={handleWetDryPointerMove}
                            onPointerMoveCapture={handleControlDragPointerMove}
                            onPointerUp={stopWetDryDrag}
                            onPointerUpCapture={stopControlDrag}
                        >
                            <span className={styles.srOnly}>
                                Dry wet mix {MAX_INPUT_LEVEL - wetDry}% dry, {wetDry}% wet
                            </span>
                            <span aria-hidden="true" className={styles.knob} />
                        </div>
                        <span className={`${styles.jackLabel} ${styles.wetDryLabel}`} style={wetDryKnobStyle}>
                            Dry/Wet
                        </span>
                        <div
                            aria-label="Input level"
                            aria-valuemax={MAX_INPUT_LEVEL}
                            aria-valuemin={0}
                            aria-valuenow={inputLevel}
                            aria-valuetext={`${inputLevel}%`}
                            className={`${styles.knobControl} ${styles.inputLevelControl}`}
                            data-dragging={inputLevelDragging}
                            data-helper-draggable={controlMoveModeActive ? "true" : "false"}
                            data-helper-dragging={controlDragState?.id === "inputLevel" ? "true" : "false"}
                            role="slider"
                            style={inputKnobStyle}
                            tabIndex={0}
                            onKeyDown={handleInputLevelKeyDown}
                            onLostPointerCapture={handleInputLevelLostPointerCapture}
                            onPointerCancel={stopInputLevelDrag}
                            onPointerCancelCapture={stopControlDrag}
                            onPointerDown={handleInputLevelPointerDown}
                            onPointerDownCapture={(event) => startControlDrag("inputLevel", event)}
                            onPointerMove={handleInputLevelPointerMove}
                            onPointerMoveCapture={handleControlDragPointerMove}
                            onPointerUp={stopInputLevelDrag}
                            onPointerUpCapture={stopControlDrag}
                        >
                            <span className={styles.srOnly}>Input level {inputLevel}%</span>
                            <span aria-hidden="true" className={`${styles.knob} ${styles.inputLevelKnob}`} />
                        </div>
                        <span className={`${styles.jackLabel} ${styles.inputLevelLabel}`} style={inputKnobStyle}>
                            Input Level
                        </span>
                        <span
                            aria-hidden="true"
                            className={styles.inputLevelMeter}
                            data-active={status.running ? "true" : "false"}
                            style={inputMeterStyle}
                        >
                            <span className={styles.inputLevelMeterFill} />
                        </span>
                        {TAPS.map((tap) => {
                            const layout = controlLayout[tap.id];
                            const tapEnabled = enabledTaps[tap.id];
                            const delayLabel = tapEnabled ? formatDelay(tapMetrics[tap.id].rttMs) : "--";
                            const tapButtonStyle = {
                                "--control-x": `${layout.x}%`,
                                "--control-y": `${layout.y}%`,
                            } as CSSProperties;

                            return (
                                <button
                                    key={tap.id}
                                    aria-pressed={tapEnabled}
                                    className={`${styles.tapButton} ${TAP_BUTTON_SIDE[tap.id] === "left" ? styles.tapButtonLeft : styles.tapButtonRight
                                        }`}
                                    data-enabled={tapEnabled ? "true" : "false"}
                                    data-helper-draggable={controlMoveModeActive ? "true" : "false"}
                                    data-helper-dragging={controlDragState?.id === tap.id ? "true" : "false"}
                                    disabled={!status.running && !controlMoveModeActive}
                                    style={tapButtonStyle}
                                    type="button"
                                    onClick={(event) => {
                                        if (controlMoveModeActive) {
                                            event.preventDefault();
                                            return;
                                        }
                                        toggleTap(tap.id);
                                    }}
                                    onPointerCancelCapture={stopControlDrag}
                                    onPointerDownCapture={(event) => startControlDrag(tap.id, event)}
                                    onPointerMoveCapture={handleControlDragPointerMove}
                                    onPointerUpCapture={stopControlDrag}
                                >
                                    <span aria-hidden="true" className={styles.tapButtonLight} />
                                    <span aria-hidden="true" className={styles.tapButtonCap} />
                                    <span className={styles.tapButtonLabel}>{tap.name}</span>
                                    <span className={styles.tapButtonDelay}>
                                        <span className={styles.tapButtonDelayValue}>{delayLabel}</span>
                                        <span className={styles.tapButtonDelayLabel}>Delay</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </section>

            <aside
                aria-hidden={!pianoVisible}
                aria-label="Piano controls"
                className={styles.pianoPanel}
                data-visible={pianoVisible ? "true" : "false"}
                id="sharkbite-piano"
            >
                <div className={styles.pianoControls}>
                    <label className={styles.pianoControl}>
                        <span>Wave</span>
                        <select value={synthWave} onChange={(event) => updateSynthWave(event.target.value)}>
                            {SYNTH_WAVES.map((wave) => (
                                <option key={wave} value={wave}>
                                    {wave}
                                </option>
                            ))}
                        </select>
                    </label>
                    <div className={styles.pianoControl}>
                        <span>Octave</span>
                        <div className={styles.octaveStepper}>
                            <button
                                aria-label="Lower octave"
                                disabled={synthOctave <= SYNTH_MIN_OCTAVE}
                                type="button"
                                onClick={() => updateSynthOctave(synthOctave - 1)}
                            >
                                <Minus aria-hidden="true" size={16} />
                            </button>
                            <strong>{synthOctave}</strong>
                            <button
                                aria-label="Raise octave"
                                disabled={synthOctave >= SYNTH_MAX_OCTAVE}
                                type="button"
                                onClick={() => updateSynthOctave(synthOctave + 1)}
                            >
                                <Plus aria-hidden="true" size={16} />
                            </button>
                        </div>
                    </div>
                </div>
                <SynthKeyboard
                    activeNotes={activeNotes}
                    disabled={!status.running || !pianoVisible}
                    octave={synthOctave}
                    onNoteOff={handleNoteOff}
                    onNoteOn={handleNoteOn}
                />
            </aside>

            {ENABLE_INPUT_AREA_HELPER ? (
                <aside
                    ref={helperPanelRef}
                    className={styles.inputAreaHelperPanel}
                    data-dragging={helperPanelDragging ? "true" : "false"}
                    aria-label="Input area helper"
                    hidden={!inputAreaHelperVisible}
                    style={helperPanelStyle}
                >
                    <header
                        onPointerCancel={stopHelperPanelDrag}
                        onPointerDown={startHelperPanelDrag}
                        onPointerMove={handleHelperPanelDragPointerMove}
                        onPointerUp={stopHelperPanelDrag}
                    >
                        <b>Input Area Helper</b>
                        <span>Press H to hide</span>
                    </header>
                    <div className={styles.inputAreaHelperTabs}>
                        <button
                            className={inputAreaHelperMode === "highlight" ? styles.inputAreaHelperTabActive : undefined}
                            type="button"
                            onClick={() => setInputAreaHelperMode("highlight")}
                        >
                            Highlight
                        </button>
                        <button
                            className={inputAreaHelperMode === "hit" ? styles.inputAreaHelperTabActive : undefined}
                            type="button"
                            onClick={() => setInputAreaHelperMode("hit")}
                        >
                            Hit Area
                        </button>
                        <button
                            className={inputAreaHelperMode === "controls" ? styles.inputAreaHelperTabActive : undefined}
                            type="button"
                            onClick={() => setInputAreaHelperMode("controls")}
                        >
                            Move
                        </button>
                    </div>
                    <p>
                        {inputAreaHelperMode === "controls"
                            ? "Drag knobs and tap buttons on the pedal. Their labels move with them."
                            : "Drag points on the pedal. Double-click empty space to add a point."}
                    </p>
                    {inputAreaHelperMode === "controls" ? (
                        <div className={styles.inputAreaHelperActions}>
                            <button type="button" onClick={() => setControlLayout(CONTROL_LAYOUT)}>
                                Reset Layout
                            </button>
                            <button type="button" onClick={copyControlLayout}>
                                Copy Layout
                            </button>
                        </div>
                    ) : (
                        <div className={styles.inputAreaHelperActions}>
                            <button type="button" onClick={() => resetInputAreaPolygon(activeInputAreaHelperPolygon)}>
                                Reset Active
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const nextPoints = activeInputAreaPolygon.slice(0, -1);
                                    if (nextPoints.length >= 3) setInputAreaPolygon(activeInputAreaHelperPolygon, nextPoints);
                                }}
                            >
                                Remove Last
                            </button>
                            <button type="button" onClick={copyInputAreaPolygons}>
                                Copy Points
                            </button>
                        </div>
                    )}
                    <textarea readOnly value={helperClipboardText} />
                </aside>
            ) : null}

            {inputDialogOpen ? (
                <div
                    className={styles.inputDialogBackdrop}
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) setInputDialogOpen(false);
                    }}
                >
                    <section
                        aria-labelledby="input-source-title"
                        aria-modal="true"
                        className={styles.inputDialog}
                        role="dialog"
                    >
                        <header className={styles.inputDialogHeader}>
                            <h2 className={styles.inputDialogTitle} id="input-source-title">
                                Input Source
                            </h2>
                            <button
                                ref={dialogCloseRef}
                                aria-label="Close input settings"
                                className={`${styles.iconButton} ${styles.inputDialogClose}`}
                                type="button"
                                onClick={() => setInputDialogOpen(false)}
                            >
                                <X aria-hidden="true" size={17} />
                            </button>
                        </header>

                        <div className={styles.inputDialogBody}>
                            <label className={styles.inputControl}>
                                <span className={styles.srOnly}>Input Source</span>
                                <select value={inputDeviceId} onChange={(event) => updateInputDevice(event.target.value)}>
                                    <option value={DEFAULT_INPUT_DEVICE_ID}>System Default</option>
                                    {audioInputs.map((device) => (
                                        <option key={device.deviceId} value={device.deviceId}>
                                            {device.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    </section>
                </div>
            ) : null}

            {infoDialogOpen ? (
                <div
                    className={`${styles.inputDialogBackdrop} ${styles.infoDialogBackdrop}`}
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) setInfoDialogOpen(false);
                    }}
                >
                    <section
                        aria-describedby="sharkbite-info-description"
                        aria-labelledby="sharkbite-info-title"
                        aria-modal="true"
                        className={`${styles.inputDialog} ${styles.infoDialog}`}
                        id="sharkbite-info"
                        role="dialog"
                    >
                        <header className={styles.inputDialogHeader}>
                            <h2 className={styles.inputDialogTitle} id="sharkbite-info-title">
                                Sharkbite
                            </h2>
                            <button
                                ref={infoDialogCloseRef}
                                aria-label="Close more info"
                                className={`${styles.iconButton} ${styles.inputDialogClose}`}
                                type="button"
                                onClick={() => setInfoDialogOpen(false)}
                            >
                                <X aria-hidden="true" size={17} />
                            </button>
                        </header>

                        <div className={styles.infoDialogBody} id="sharkbite-info-description">
                            <p>
                                Usually we think about latency as something to be avoided, but what if we harnessed it for its musicality?
                                Sharkbite is a website that turns the internet into a delay pedal.
                            </p>
                            <p>
                                Audio signal is sent to DigitalOcean servers in different cities, and back to you. Depending on how far you are away from
                                these servers, you will hear a different delay effect; the delay time comes from the length of the trip itself.
                            </p>
                            <p>
                                Conceptually, the internet is shrouded in metaphors of immateriality (&quot;the cloud&quot;, etc.), but in reality is a physical thing
                                made possible by server farms and undersea cables. The name &quot;Sharkbite&quot; is a reference to a notorious{" "}
                                <a href="https://www.youtube.com/watch?v=1ex7uTQf4bQ" rel="noreferrer" target="_blank">
                                    video
                                </a>{" "}
                                of a shark
                                biting one of these undersea cables.
                            </p>
                            <footer className={styles.infoCreator}>
                                <span>Created by Andrew Boylan</span>
                                <nav aria-label="Andrew Boylan links" className={styles.infoCreatorLinks}>
                                    <a
                                        aria-label="Andrew Boylan on Instagram"
                                        className={styles.infoCreatorLink}
                                        href="https://www.instagram.com/ndrewboylan/"
                                        rel="noreferrer"
                                        target="_blank"
                                    >
                                        <svg aria-hidden="true" viewBox="0 0 448 512">
                                            <path d="M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z" />
                                        </svg>
                                    </a>
                                    <a
                                        aria-label="Andrew Boylan website"
                                        className={styles.infoCreatorLink}
                                        href="https://www.andrew-boylan.com/"
                                        rel="noreferrer"
                                        target="_blank"
                                    >
                                        <svg aria-hidden="true" viewBox="0 0 512 512">
                                            <path d="M352 256c0 22.2-1.2 43.6-3.3 64l-185.3 0c-2.2-20.4-3.3-41.8-3.3-64s1.2-43.6 3.3-64l185.3 0c2.2 20.4 3.3 41.8 3.3 64zm28.8-64l123.1 0c5.3 20.5 8.1 41.9 8.1 64s-2.8 43.5-8.1 64l-123.1 0c2.1-20.6 3.2-42 3.2-64s-1.1-43.4-3.2-64zm112.6-32l-116.7 0c-10-63.9-29.8-117.4-55.3-151.6c78.3 20.7 142 77.5 171.9 151.6zm-149.1 0l-176.6 0c6.1-36.4 15.5-68.6 27-94.7c10.5-23.6 22.2-40.7 33.5-51.5C239.4 3.2 248.7 0 256 0s16.6 3.2 27.8 13.8c11.3 10.8 23 27.9 33.5 51.5c11.6 26 20.9 58.2 27 94.7zm-209 0L18.6 160C48.6 85.9 112.2 29.1 190.6 8.4C165.1 42.6 145.3 96.1 135.3 160zM8.1 192l123.1 0c-2.1 20.6-3.2 42-3.2 64s1.1 43.4 3.2 64L8.1 320C2.8 299.5 0 278.1 0 256s2.8-43.5 8.1-64zM194.7 446.6c-11.6-26-20.9-58.2-27-94.6l176.6 0c-6.1 36.4-15.5 68.6-27 94.6c-10.5 23.6-22.2 40.7-33.5 51.5C272.6 508.8 263.3 512 256 512s-16.6-3.2-27.8-13.8c-11.3-10.8-23-27.9-33.5-51.5zM135.3 352c10 63.9 29.8 117.4 55.3 151.6C112.2 482.9 48.6 426.1 18.6 352l116.7 0zm358.1 0c-30 74.1-93.6 130.9-171.9 151.6c25.5-34.2 45.2-87.7 55.3-151.6l116.7 0z" />
                                        </svg>
                                    </a>
                                    <a
                                        aria-label="Andrew Boylan on GitHub"
                                        className={styles.infoCreatorLink}
                                        href="https://github.com/eastmountaincode"
                                        rel="noreferrer"
                                        target="_blank"
                                    >
                                        <svg aria-hidden="true" viewBox="0 0 496 512">
                                            <path d="M165.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3.3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5.3-6.2 2.3zm44.2-1.7c-2.9.7-4.9 2.6-4.6 4.9.3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252 496 113.3 383.5 8 244.8 8zM97.2 352.9c-1.3 1-1 3.3.7 5.2 1.6 1.6 3.9 2.3 5.2 1 1.3-1 1-3.3-.7-5.2-1.6-1.6-3.9-2.3-5.2-1zm-10.8-8.1c-.7 1.3.3 2.9 2.3 3.9 1.6 1 3.6.7 4.3-.7.7-1.3-.3-2.9-2.3-3.9-2-.6-3.6-.3-4.3.7zm32.4 35.6c-1.6 1.3-1 4.3 1.3 6.2 2.3 2.3 5.2 2.6 6.5 1 1.3-1.3.7-4.3-1.3-6.2-2.2-2.3-5.2-2.6-6.5-1zm-11.4-14.7c-1.6 1-1.6 3.6 0 5.9 1.6 2.3 4.3 3.3 5.6 2.3 1.6-1.3 1.6-3.9 0-6.2-1.4-2.3-4-3.3-5.6-2z" />
                                        </svg>
                                    </a>
                                </nav>
                            </footer>
                        </div>
                    </section>
                </div>
            ) : null}

            {startScreenVisible ? (
                <section aria-label="Sharkbite start screen" className={styles.startScreen}>
                    <div className={styles.startPanel}>
                        <Image
                            priority
                            unoptimized
                            alt="Sharkbite"
                            className={styles.startLogo}
                            height={497}
                            src="/assets/sharkbite/logo.png"
                            width={688}
                        />
                        <button
                            className={styles.startButton}
                            disabled={startingAudio}
                            type="button"
                            onClick={() => void startFromSplash()}
                        >
                            Start
                        </button>
                    </div>
                </section>
            ) : null}
        </main>
    );
}
