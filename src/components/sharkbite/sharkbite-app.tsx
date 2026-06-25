"use client";

import {
    type CSSProperties,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import { TAPS, type TapId } from "@/config/taps";
import { AudioEngine } from "@/lib/audio/audio-engine";
import { InputAreaHelperPanel } from "./input-area-helper-panel";
import { InputSourceDialog } from "./input-source-dialog";
import { MoreInfoDialog } from "./more-info-dialog";
import { PedalSurface } from "./pedal-surface";
import { PianoPanel } from "./piano-panel";
import {
    BUFFER_MODE,
    BUTTON_PRESS_VOLUME,
    DEFAULT_INPUT_DEVICE_ID,
    ENABLE_INPUT_AREA_HELPER,
    FRAME_SIZE_MS,
    INITIAL_STATUS,
    INITIAL_TAP_ENABLED,
    INITIAL_TAP_METRICS,
    JITTER_BUFFER_MS,
    knobValueToFrame,
    MASTER_WET_LEVEL,
    MAX_INPUT_LEVEL,
    SYNTH_LEVEL,
    SYNTH_MAX_OCTAVE,
    SYNTH_MIN_OCTAVE,
    SYNTH_WAVES,
} from "./sharkbite-model";
import styles from "./sharkbite.module.css";
import { StartScreen } from "./start-screen";
import { TopControls } from "./top-controls";
import { useAudioInputs } from "./use-audio-inputs";
import { useKnobControl } from "./use-knob-control";
import { usePedalEditor } from "./use-pedal-editor";
import { useSynthController } from "./use-synth-controller";

export function SharkbiteApp() {
    const engineRef = useRef<AudioEngine | null>(null);
    const buttonPressAudioRef = useRef<HTMLAudioElement | null>(null);
    const dialogCloseRef = useRef<HTMLButtonElement | null>(null);
    const infoDialogCloseRef = useRef<HTMLButtonElement | null>(null);
    const [status, setStatus] = useState(INITIAL_STATUS);
    const [inputJackActive, setInputJackActive] = useState(false);
    const [inputLevel, setInputLevelState] = useState(0);
    const [wetDry, setWetDryState] = useState(50);
    const [enabledTaps, setEnabledTaps] = useState(INITIAL_TAP_ENABLED);
    const [tapMetrics, setTapMetrics] = useState(INITIAL_TAP_METRICS);
    const [inputDialogOpen, setInputDialogOpen] = useState(false);
    const [infoDialogOpen, setInfoDialogOpen] = useState(false);
    const [startScreenVisible, setStartScreenVisible] = useState(true);
    const [startingAudio, setStartingAudio] = useState(false);
    const [inputMonitorLevel, setInputMonitorLevel] = useState(0);
    const updateInputMonitorLevel = useCallback((level: number) => {
        setInputMonitorLevel((currentLevel) => (Math.abs(currentLevel - level) < 0.015 ? currentLevel : level));
    }, []);

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

    const {
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
    } = useSynthController({ engineRef, getEngine });

    const { audioInputs, inputDeviceId, refreshAudioInputs, updateInputDevice } = useAudioInputs({
        getEngine,
        statusRunning: status.running,
    });

    const {
        activeInputAreaHelperPolygon,
        activeInputAreaPolygon,
        controlDragState,
        controlLayout,
        controlMoveModeActive,
        copyControlLayout,
        copyInputAreaPolygons,
        handleControlDragPointerMove,
        handleHelperPanelDragPointerMove,
        handleInputAreaEditorDoubleClick,
        handleInputAreaEditorPointerMove,
        helperClipboardText,
        helperPanelDragging,
        helperPanelRef,
        helperPanelStyle,
        inputAreaHelperMode,
        inputAreaHelperVisible,
        inputAreaSvgRef,
        inputHighlightPolygon,
        inputHitPolygon,
        polygonHelperActive,
        removeLastInputAreaPoint,
        resetControlLayout,
        resetInputAreaPolygon,
        setInputAreaHelperMode,
        startControlDrag,
        startHelperPanelDrag,
        startInputAreaPointDrag,
        stopControlDrag,
        stopHelperPanelDrag,
        stopInputAreaEditorDrag,
    } = usePedalEditor({ infoDialogOpen, inputDialogOpen, pianoVisible });

    useEffect(() => {
        return () => {
            engineRef.current?.destroy();
            engineRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (!inputDialogOpen) return;

        dialogCloseRef.current?.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setInputDialogOpen(false);
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [inputDialogOpen]);

    useEffect(() => {
        if (!infoDialogOpen) return;

        infoDialogCloseRef.current?.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setInfoDialogOpen(false);
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [infoDialogOpen]);

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

    const inputLevelControl = useKnobControl({
        onChange: updateInputLevel,
        value: inputLevel,
    });
    const wetDryControl = useKnobControl({
        onChange: updateWetDry,
        value: wetDry,
    });

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

    const openInputDialog = () => {
        setInputDialogOpen(true);
        void refreshAudioInputs();
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

    return (
        <main className={styles.shell} data-piano-open={pianoOpen ? "true" : "false"}>
            <audio ref={buttonPressAudioRef} preload="auto" src="/assets/sharkbite/button-press.mp3" />
            <TopControls
                infoDialogOpen={infoDialogOpen}
                pianoVisible={pianoVisible}
                showInfoToggle={!startScreenVisible}
                onOpenInfo={() => setInfoDialogOpen(true)}
                onTogglePiano={togglePiano}
            />
            <PedalSurface
                activeInputAreaHelperPolygon={activeInputAreaHelperPolygon}
                activeInputAreaPolygon={activeInputAreaPolygon}
                controlDragState={controlDragState}
                controlLayout={controlLayout}
                controlMoveModeActive={controlMoveModeActive}
                enabledTaps={enabledTaps}
                inputAreaHelperVisible={inputAreaHelperVisible}
                inputAreaSvgRef={inputAreaSvgRef}
                inputDialogOpen={inputDialogOpen}
                inputHitPolygon={inputHitPolygon}
                inputHighlightPolygon={inputHighlightPolygon}
                inputJackActive={inputJackActive}
                inputKnobStyle={inputKnobStyle}
                inputLevel={inputLevel}
                inputLevelDragging={inputLevelControl.dragging}
                inputMeterStyle={inputMeterStyle}
                logoStyle={logoStyle}
                maxInputLevel={MAX_INPUT_LEVEL}
                polygonHelperActive={polygonHelperActive}
                statusRunning={status.running}
                tapMetrics={tapMetrics}
                wetDry={wetDry}
                wetDryDragging={wetDryControl.dragging}
                wetDryKnobStyle={wetDryKnobStyle}
                onInputAreaEditorDoubleClick={handleInputAreaEditorDoubleClick}
                onInputAreaEditorPointerMove={handleInputAreaEditorPointerMove}
                onInputAreaEditorDragStop={stopInputAreaEditorDrag}
                onInputAreaPointDragStart={startInputAreaPointDrag}
                onInputJackActiveChange={setInputJackActive}
                onInputLevelKeyDown={inputLevelControl.handleKeyDown}
                onInputLevelLostPointerCapture={inputLevelControl.handleLostPointerCapture}
                onInputLevelPointerCancel={inputLevelControl.stopDrag}
                onInputLevelPointerDown={inputLevelControl.handlePointerDown}
                onInputLevelPointerMove={inputLevelControl.handlePointerMove}
                onOpenInputDialog={openInputDialog}
                onStartControlDrag={startControlDrag}
                onMoveControlDrag={handleControlDragPointerMove}
                onStopControlDrag={stopControlDrag}
                onToggleTap={toggleTap}
                onWetDryKeyDown={wetDryControl.handleKeyDown}
                onWetDryLostPointerCapture={wetDryControl.handleLostPointerCapture}
                onWetDryPointerCancel={wetDryControl.stopDrag}
                onWetDryPointerDown={wetDryControl.handlePointerDown}
                onWetDryPointerMove={wetDryControl.handlePointerMove}
            />

            <PianoPanel
                activeNotes={activeNotes}
                disabled={!status.running}
                maxOctave={SYNTH_MAX_OCTAVE}
                minOctave={SYNTH_MIN_OCTAVE}
                octave={synthOctave}
                pianoVisible={pianoVisible}
                wave={synthWave}
                waves={SYNTH_WAVES}
                onNoteOff={handleNoteOff}
                onNoteOn={handleNoteOn}
                onOctaveChange={updateSynthOctave}
                onWaveChange={updateSynthWave}
            />

            {ENABLE_INPUT_AREA_HELPER ? (
                <InputAreaHelperPanel
                    activeInputAreaHelperPolygon={activeInputAreaHelperPolygon}
                    clipboardText={helperClipboardText}
                    helperPanelDragging={helperPanelDragging}
                    helperPanelRef={helperPanelRef}
                    helperPanelStyle={helperPanelStyle}
                    inputAreaHelperMode={inputAreaHelperMode}
                    inputAreaHelperVisible={inputAreaHelperVisible}
                    onCopyControlLayout={copyControlLayout}
                    onCopyInputAreaPolygons={copyInputAreaPolygons}
                    onModeChange={setInputAreaHelperMode}
                    onMoveHelperPanelDrag={handleHelperPanelDragPointerMove}
                    onRemoveLastInputAreaPoint={removeLastInputAreaPoint}
                    onResetControlLayout={resetControlLayout}
                    onResetInputAreaPolygon={resetInputAreaPolygon}
                    onStartHelperPanelDrag={startHelperPanelDrag}
                    onStopHelperPanelDrag={stopHelperPanelDrag}
                />
            ) : null}

            {inputDialogOpen ? (
                <InputSourceDialog
                    audioInputs={audioInputs}
                    closeButtonRef={dialogCloseRef}
                    defaultInputDeviceId={DEFAULT_INPUT_DEVICE_ID}
                    inputDeviceId={inputDeviceId}
                    onClose={() => setInputDialogOpen(false)}
                    onUpdateInputDevice={updateInputDevice}
                />
            ) : null}

            {infoDialogOpen ? (
                <MoreInfoDialog closeButtonRef={infoDialogCloseRef} onClose={() => setInfoDialogOpen(false)} />
            ) : null}

            {startScreenVisible ? <StartScreen startingAudio={startingAudio} onStart={() => void startFromSplash()} /> : null}
        </main>
    );
}
