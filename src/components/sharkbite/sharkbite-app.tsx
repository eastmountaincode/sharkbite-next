"use client";

import {
    type CSSProperties,
    useCallback,
    useEffect,
    useRef,
    useState,
    useSyncExternalStore,
} from "react";
import { TAPS, type TapId } from "@/config/taps";
import { AudioEngine } from "@/lib/audio/audio-engine";
import { FeedbackStopButton } from "./feedback-stop-button";
import { InputAreaHelperPanel } from "./input-area-helper-panel";
import { InputSourceDialog } from "./input-source-dialog";
import { MoreInfoDialog } from "./more-info-dialog";
import { OutputSourceDialog } from "./output-source-dialog";
import { PedalSurface } from "./pedal-surface";
import { PianoPanel } from "./piano-panel";
import {
    BUFFER_MODE,
    BUTTON_PRESS_VOLUME,
    DEFAULT_INPUT_DEVICE_ID,
    DEFAULT_OUTPUT_DEVICE_ID,
    ENABLE_INPUT_AREA_HELPER,
    FRAME_SIZE_MS,
    INITIAL_STATUS,
    INITIAL_TAP_ENABLED,
    INITIAL_TAP_METRICS,
    JITTER_BUFFER_MS,
    knobValueToCssRotation,
    MASTER_WET_LEVEL,
    MAX_INPUT_LEVEL,
    SYNTH_LEVEL,
    SYNTH_MAX_OCTAVE,
    SYNTH_MIN_OCTAVE,
    SYNTH_WAVES,
} from "./sharkbite-model";
import styles from "./sharkbite.module.css";
import { createAtlasReturns } from "@/app/atlas/routes";
import { MAX_FEEDBACK } from "@/app/atlas/destinations";
import { useMeasurements } from "@/app/atlas/use-measurements";
import { useListenerLocation } from "@/app/atlas/use-listener-location";
import { DestinationMap } from "@/app/atlas/destination-map";
import { StartScreen } from "./start-screen";
import { TopControls } from "./top-controls";
import { useAudioInputs } from "./use-audio-inputs";
import { useAudioOutputs } from "./use-audio-outputs";
import { useKnobControl } from "./use-knob-control";
import { usePedalEditor } from "./use-pedal-editor";
import { useSynthController } from "./use-synth-controller";

const DESKTOP_LAYOUT_QUERY = "(min-width: 761px)";

function subscribeToDesktopLayout(onChange: () => void) {
    const media = window.matchMedia(DESKTOP_LAYOUT_QUERY);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
}

function getDesktopLayout() {
    return window.matchMedia(DESKTOP_LAYOUT_QUERY).matches;
}

export function SharkbiteApp({ atlas = false }: { atlas?: boolean }) {
    const desktopLayout = useSyncExternalStore(subscribeToDesktopLayout, getDesktopLayout, () => false);
    const [selected, setSelected] = useState(new Set(["TYO"]));
    const [feedback, setFeedback] = useState(35);
    const [feedbackStopped, setFeedbackStopped] = useState(false);
    const [mapOpen, setMapOpen] = useState(false);
    const updateReturns = useRef<ReturnType<typeof createAtlasReturns> | null>(null);
    const feedbackControl = useKnobControl({
        value: feedback,
        maxValue: MAX_FEEDBACK,
        onChange: value => setFeedback(Math.max(0, Math.min(MAX_FEEDBACK, Math.round(value)))),
    });

    function selectCity(code: string, enable: boolean) {
        setSelected(current => {
            const next = new Set(current);
            if (enable) next.add(code);
            else next.delete(code);
            return next;
        });
    }

    const engineRef = useRef<AudioEngine | null>(null);
    const inputDialogCloseRef = useRef<HTMLButtonElement | null>(null);
    const outputDialogCloseRef = useRef<HTMLButtonElement | null>(null);
    const infoDialogCloseRef = useRef<HTMLButtonElement | null>(null);
    const [status, setStatus] = useState(INITIAL_STATUS);
    const [inputLevel, setInputLevelState] = useState(0);
    const [wetDry, setWetDryState] = useState(50);
    const [enabledTaps, setEnabledTaps] = useState(INITIAL_TAP_ENABLED);
    const [tapMetrics, setTapMetrics] = useState(INITIAL_TAP_METRICS);
    const [inputDialogOpen, setInputDialogOpen] = useState(false);
    const [outputDialogOpen, setOutputDialogOpen] = useState(false);
    const [infoDialogOpen, setInfoDialogOpen] = useState(false);
    const [startScreenVisible, setStartScreenVisible] = useState(true);
    const [startingAudio, setStartingAudio] = useState(false);
    const [inputMonitorLevel, setInputMonitorLevel] = useState(0);
    const updateInputMonitorLevel = useCallback((level: number) => {
        setInputMonitorLevel((currentLevel) => (Math.abs(currentLevel - level) < 0.015 ? currentLevel : level));
    }, []);

    const measurements = useMeasurements(selected, status.running, atlas);
    const listenerLocation = useListenerLocation(atlas);

    useEffect(() => {
        if (status.running) updateReturns.current?.(selected, feedback, measurements, feedbackStopped);
    }, [status.running, selected, feedback, measurements, feedbackStopped]);

    const getEngine = useCallback(() => {
        if (!engineRef.current) {
            engineRef.current = new AudioEngine({
                taps: atlas ? [] : TAPS,
                localReturns: atlas ? (ctx, source, wet) => {
                    updateReturns.current = createAtlasReturns(ctx, source, wet);
                } : undefined,
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
    }, [atlas, updateInputMonitorLevel]);

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

    const { audioInputs, inputDeviceId, inputLabel, inputsReady, refreshAudioInputs, updateInputDevice } = useAudioInputs({
        getEngine,
        statusRunning: status.running,
    });
    const { audioOutputs, outputDeviceId, outputLabel, outputChannel, outputsReady, refreshAudioOutputs, updateOutputDevice, updateOutputChannel, retryOutput } = useAudioOutputs({
        getEngine,
        statusRunning: status.running,
    });

    const {
        controlDragState,
        controlLayout,
        controlMoveModeActive,
        copyControlLayout,
        handleControlDragPointerMove,
        handleHelperPanelDragPointerMove,
        helperClipboardText,
        helperPanelDragging,
        helperPanelRef,
        helperPanelStyle,
        inputAreaHelperVisible,
        layoutGridVisible,
        pedalOverlayRef,
        resetPedalLayout,
        startControlDrag,
        startHelperPanelDrag,
        stopControlDrag,
        stopHelperPanelDrag,
        tapButtonCapGeometry,
        tapButtonStatePreviewVisible,
        toggleLayoutGrid,
        toggleTapButtonStatePreview,
        updateTapButtonCapGeometry,
    } = usePedalEditor({ infoDialogOpen, inputDialogOpen, outputDialogOpen, pianoVisible });

    useEffect(() => {
        return () => {
            engineRef.current?.destroy();
            engineRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (!inputDialogOpen) return;

        inputDialogCloseRef.current?.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setInputDialogOpen(false);
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [inputDialogOpen]);

    useEffect(() => {
        if (!outputDialogOpen) return;

        outputDialogCloseRef.current?.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOutputDialogOpen(false);
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [outputDialogOpen]);

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
            outputDeviceId: outputDeviceId || undefined,
            outputChannel,
            inputLevel: inputLevel / 100,
            jitterBufferMs: JITTER_BUFFER_MS,
            masterWet: MASTER_WET_LEVEL,
            synthLevel: SYNTH_LEVEL,
            wetDry: wetDry / 100,
        });
        engine.setSynth(synthWave, SYNTH_LEVEL);
        await Promise.all([refreshAudioInputs(), refreshAudioOutputs()]);
    }, [getEngine, inputDeviceId, inputLevel, outputDeviceId, outputChannel, refreshAudioInputs, refreshAudioOutputs, synthWave, wetDry]);

    const startFromSplash = async () => {
        if (startingAudio || !inputsReady || !outputsReady) return;

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
        void getEngine().playButtonPress(BUTTON_PRESS_VOLUME);
    }, [getEngine]);

    const toggleTap = (tapId: TapId) => {
        playButtonPress();
        getEngine().setTapEnabled(tapId, !enabledTaps[tapId]);
    };

    const openInputDialog = () => {
        setInputDialogOpen(true);
        void refreshAudioInputs();
    };

    const openOutputDialog = () => {
        setOutputDialogOpen(true);
        void refreshAudioOutputs();
    };

    const inputKnobStyle = {
        "--knob-rotation": `${knobValueToCssRotation(inputLevel)}deg`,
        "--control-x": `${atlas ? 75 : controlLayout.inputLevel.x}%`,
        "--control-y": `${atlas ? 57 : controlLayout.inputLevel.y}%`,
    } as CSSProperties;
    const inputMeterStyle = {
        ...inputKnobStyle,
        "--input-meter-level": inputMonitorLevel,
    } as CSSProperties;
    const wetDryKnobStyle = {
        "--knob-rotation": `${knobValueToCssRotation(wetDry)}deg`,
        "--control-x": `${atlas ? 25 : controlLayout.wetDry.x}%`,
        "--control-y": `${atlas ? 57 : controlLayout.wetDry.y}%`,
    } as CSSProperties;
    const logoStyle = {
        "--control-x": `${atlas ? 50 : controlLayout.logo.x}%`,
        "--control-y": `${atlas ? 31 : controlLayout.logo.y}%`,
    } as CSSProperties;

    return (
        <main className={styles.shell} data-atlas={atlas ? "true" : "false"} data-piano-open={pianoOpen ? "true" : "false"}>
            {!outputDialogOpen && status.message.startsWith("Output muted:") ? (
                <button className={styles.outputWarning} role="alert" type="button" onClick={openOutputDialog}>
                    {status.message} Open output settings
                </button>
            ) : null}
            <TopControls
                infoDialogOpen={infoDialogOpen}
                pianoVisible={pianoVisible}
                showInfoToggle={!startScreenVisible && !mapOpen}
                onOpenInfo={() => setInfoDialogOpen(true)}
                onTogglePiano={togglePiano}
            />
            <div className={styles.performanceGroup}>
                <PedalSurface
                    controlDragState={controlDragState}
                    controlLayout={controlLayout}
                    controlMoveModeActive={controlMoveModeActive}
                    hideTaps={atlas}
                    showControlValues={atlas}
                    enabledTaps={enabledTaps}
                    inputDialogOpen={inputDialogOpen}
                    outputDialogOpen={outputDialogOpen}
                    inputKnobStyle={inputKnobStyle}
                    inputLevel={inputLevel}
                    inputLevelDragging={inputLevelControl.dragging}
                    inputMeterStyle={inputMeterStyle}
                    layoutGridVisible={layoutGridVisible}
                    logoStyle={logoStyle}
                    maxInputLevel={MAX_INPUT_LEVEL}
                    pedalOverlayRef={pedalOverlayRef}
                    statusRunning={status.running}
                    tapButtonCapGeometry={tapButtonCapGeometry}
                    tapButtonStatePreviewVisible={tapButtonStatePreviewVisible}
                    tapMetrics={tapMetrics}
                    wetDry={wetDry}
                    wetDryDragging={wetDryControl.dragging}
                    wetDryKnobStyle={wetDryKnobStyle}
                    onInputLevelKeyDown={inputLevelControl.handleKeyDown}
                    onInputLevelLostPointerCapture={inputLevelControl.handleLostPointerCapture}
                    onInputLevelPointerCancel={inputLevelControl.stopDrag}
                    onInputLevelPointerDown={inputLevelControl.handlePointerDown}
                    onInputLevelPointerMove={inputLevelControl.handlePointerMove}
                    onOpenInputDialog={openInputDialog}
                    onOpenOutputDialog={openOutputDialog}
                    onStartControlDrag={startControlDrag}
                    onMoveControlDrag={handleControlDragPointerMove}
                    onStopControlDrag={stopControlDrag}
                    onToggleTap={toggleTap}
                    onWetDryKeyDown={wetDryControl.handleKeyDown}
                    onWetDryLostPointerCapture={wetDryControl.handleLostPointerCapture}
                    onWetDryPointerCancel={wetDryControl.stopDrag}
                    onWetDryPointerDown={wetDryControl.handlePointerDown}
                    onWetDryPointerMove={wetDryControl.handlePointerMove}
                >
                    {atlas && <div className={styles.feedbackPosition} style={{ "--knob-rotation": `${knobValueToCssRotation(feedback / MAX_FEEDBACK * 100)}deg` } as CSSProperties}>
                        <div className={styles.knobControl} role="slider" aria-label="Feedback" tabIndex={0}
                            aria-valuemin={0} aria-valuemax={MAX_FEEDBACK} aria-valuenow={feedback} aria-valuetext={`${feedback}%`}
                            onKeyDown={feedbackControl.handleKeyDown} onPointerDown={feedbackControl.handlePointerDown}
                            onPointerMove={feedbackControl.handlePointerMove} onPointerCancel={feedbackControl.stopDrag}
                            onPointerUp={feedbackControl.stopDrag} onLostPointerCapture={feedbackControl.handleLostPointerCapture}>
                            <span aria-hidden="true" className={styles.knob} />
                        </div>
                        <FeedbackStopButton disabled={!status.running} pressed={feedbackStopped} onChange={setFeedbackStopped} />
                        <span className={styles.jackLabel}>Feedback</span>
                        <output className={styles.feedbackValue}>{feedback}%</output>
                    </div>}
                    {atlas && !desktopLayout && <button className={styles.destinationsToggle} onClick={() => setMapOpen(true)} aria-haspopup="dialog">Destinations</button>}
                </PedalSurface>

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
            </div>

            {atlas && (desktopLayout || mapOpen) && (
                <DestinationMap
                    inline={desktopLayout}
                    selected={selected}
                    measurements={measurements}
                    origin={listenerLocation}
                    select={selectCity}
                    onClose={() => setMapOpen(false)}
                />
            )}

            {ENABLE_INPUT_AREA_HELPER ? (
                <InputAreaHelperPanel
                    clipboardText={helperClipboardText}
                    helperPanelDragging={helperPanelDragging}
                    helperPanelRef={helperPanelRef}
                    helperPanelStyle={helperPanelStyle}
                    inputAreaHelperVisible={inputAreaHelperVisible}
                    layoutGridVisible={layoutGridVisible}
                    tapButtonCapGeometry={tapButtonCapGeometry}
                    tapButtonStatePreviewVisible={tapButtonStatePreviewVisible}
                    onCopyControlLayout={copyControlLayout}
                    onMoveHelperPanelDrag={handleHelperPanelDragPointerMove}
                    onResetPedalLayout={resetPedalLayout}
                    onStartHelperPanelDrag={startHelperPanelDrag}
                    onStopHelperPanelDrag={stopHelperPanelDrag}
                    onTapButtonCapGeometryChange={updateTapButtonCapGeometry}
                    onToggleLayoutGrid={toggleLayoutGrid}
                    onToggleTapButtonStatePreview={toggleTapButtonStatePreview}
                />
            ) : null}

            {inputDialogOpen ? (
                <InputSourceDialog
                    audioInputs={audioInputs}
                    closeButtonRef={inputDialogCloseRef}
                    defaultInputDeviceId={DEFAULT_INPUT_DEVICE_ID}
                    inputDeviceId={inputDeviceId}
                    inputLabel={inputLabel}
                    onClose={() => setInputDialogOpen(false)}
                    onUpdateInputDevice={updateInputDevice}
                />
            ) : null}

            {outputDialogOpen ? (
                <OutputSourceDialog
                    audioOutputs={audioOutputs}
                    closeButtonRef={outputDialogCloseRef}
                    defaultOutputDeviceId={DEFAULT_OUTPUT_DEVICE_ID}
                    outputDeviceId={outputDeviceId}
                    outputLabel={outputLabel}
                    outputChannel={outputChannel}
                    outputChannelCount={status.outputDeviceId === outputDeviceId ? status.outputChannelCount ?? 0 : 0}
                    outputError={status.message.startsWith("Output muted:") ? status.message : undefined}
                    onUpdateOutputChannel={updateOutputChannel}
                    onRetryOutput={retryOutput}
                    onClose={() => setOutputDialogOpen(false)}
                    onUpdateOutputDevice={updateOutputDevice}
                />
            ) : null}

            {infoDialogOpen ? (
                <MoreInfoDialog atlas={atlas} closeButtonRef={infoDialogCloseRef} onClose={() => setInfoDialogOpen(false)} />
            ) : null}

            {startScreenVisible ? <StartScreen startingAudio={startingAudio || !inputsReady || !outputsReady} onStart={() => void startFromSplash()} /> : null}
        </main>
    );
}
