import Image from "next/image";
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from "react";
import { TAPS, type TapId } from "@/config/taps";
import type { TapMetricsMap } from "@/lib/audio/types";
import styles from "./sharkbite.module.css";

type AreaPoint = {
  x: number;
  y: number;
};

type InputAreaPolygon = "hit" | "highlight";
type ControlLayoutId = "logo" | "wetDry" | "inputLevel" | TapId;

type ControlDragStateSnapshot = {
  id: ControlLayoutId;
} | null;

type PedalSurfaceProps = {
  activeInputAreaHelperPolygon: InputAreaPolygon;
  activeInputAreaPolygon: AreaPoint[];
  controlDragState: ControlDragStateSnapshot;
  controlLayout: Record<ControlLayoutId, AreaPoint>;
  controlMoveModeActive: boolean;
  enabledTaps: Record<TapId, boolean>;
  inputAreaHelperVisible: boolean;
  inputAreaSvgRef: RefObject<SVGSVGElement | null>;
  inputDialogOpen: boolean;
  inputHitPolygon: AreaPoint[];
  inputHighlightPolygon: AreaPoint[];
  inputJackActive: boolean;
  inputKnobStyle: CSSProperties;
  inputLevel: number;
  inputLevelDragging: boolean;
  inputMeterStyle: CSSProperties;
  logoStyle: CSSProperties;
  maxInputLevel: number;
  polygonHelperActive: boolean;
  statusRunning: boolean;
  tapMetrics: TapMetricsMap;
  wetDry: number;
  wetDryDragging: boolean;
  wetDryKnobStyle: CSSProperties;
  onInputAreaEditorDoubleClick: (event: ReactMouseEvent<SVGSVGElement>) => void;
  onInputAreaEditorPointerMove: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onInputAreaEditorDragStop: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onInputAreaPointDragStart: (
    polygon: InputAreaPolygon,
    index: number,
    event: ReactPointerEvent<SVGCircleElement>,
  ) => void;
  onInputJackActiveChange: (active: boolean) => void;
  onInputLevelKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onInputLevelLostPointerCapture: () => void;
  onInputLevelPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onInputLevelPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onInputLevelPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onOpenInputDialog: () => void;
  onStartControlDrag: (id: ControlLayoutId, event: ReactPointerEvent<HTMLElement>) => void;
  onMoveControlDrag: (event: ReactPointerEvent<HTMLElement>) => void;
  onStopControlDrag: (event: ReactPointerEvent<HTMLElement>) => void;
  onToggleTap: (tapId: TapId) => void;
  onWetDryKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onWetDryLostPointerCapture: () => void;
  onWetDryPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onWetDryPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onWetDryPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

const TAP_BUTTON_SIDE: Record<TapId, "left" | "right"> = {
  rich: "left",
  sf: "left",
  fra: "right",
  blr: "right",
};

const formatSvgPoints = (points: AreaPoint[]) => points.map((point) => `${point.x},${point.y}`).join(" ");

const formatDelay = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return "--";
  return `${Math.round(value)}ms`;
};

export function PedalSurface({
  activeInputAreaHelperPolygon,
  activeInputAreaPolygon,
  controlDragState,
  controlLayout,
  controlMoveModeActive,
  enabledTaps,
  inputAreaHelperVisible,
  inputAreaSvgRef,
  inputDialogOpen,
  inputHitPolygon,
  inputHighlightPolygon,
  inputJackActive,
  inputKnobStyle,
  inputLevel,
  inputLevelDragging,
  inputMeterStyle,
  logoStyle,
  maxInputLevel,
  polygonHelperActive,
  statusRunning,
  tapMetrics,
  wetDry,
  wetDryDragging,
  wetDryKnobStyle,
  onInputAreaEditorDoubleClick,
  onInputAreaEditorPointerMove,
  onInputAreaEditorDragStop,
  onInputAreaPointDragStart,
  onInputJackActiveChange,
  onInputLevelKeyDown,
  onInputLevelLostPointerCapture,
  onInputLevelPointerCancel,
  onInputLevelPointerDown,
  onInputLevelPointerMove,
  onOpenInputDialog,
  onStartControlDrag,
  onMoveControlDrag,
  onStopControlDrag,
  onToggleTap,
  onWetDryKeyDown,
  onWetDryLostPointerCapture,
  onWetDryPointerCancel,
  onWetDryPointerDown,
  onWetDryPointerMove,
}: PedalSurfaceProps) {
  return (
    <section aria-label="Sharkbite pedal work surface" className={styles.pedalStage}>
      <div className={styles.pedalCanvas}>
        <div className={styles.pedalOverlay} data-input-active={inputJackActive || inputDialogOpen ? "true" : "false"}>
          <svg
            ref={inputAreaSvgRef}
            className={styles.inputAreaSvg}
            preserveAspectRatio="none"
            viewBox="0 0 100 100"
            onDoubleClick={onInputAreaEditorDoubleClick}
            onPointerCancel={onInputAreaEditorDragStop}
            onPointerMove={onInputAreaEditorPointerMove}
            onPointerUp={onInputAreaEditorDragStop}
          >
            <polygon className={styles.inputHighlightPolygon} points={formatSvgPoints(inputHighlightPolygon)} />
            <polygon
              aria-label="Open input settings"
              className={styles.inputHitPolygon}
              points={formatSvgPoints(inputHitPolygon)}
              role="button"
              tabIndex={0}
              onBlur={() => onInputJackActiveChange(false)}
              onClick={() => {
                if (!inputAreaHelperVisible) onOpenInputDialog();
              }}
              onFocus={() => onInputJackActiveChange(true)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                if (!inputAreaHelperVisible) onOpenInputDialog();
              }}
              onPointerEnter={() => onInputJackActiveChange(true)}
              onPointerLeave={() => onInputJackActiveChange(false)}
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
                      onPointerDown={(event) => onInputAreaPointDragStart(activeInputAreaHelperPolygon, index, event)}
                    />
                    <circle className={styles.inputAreaEditorPoint} cx={point.x} cy={point.y} r="0.42" />
                  </g>
                ))}
              </g>
            ) : null}
          </svg>
          <div
            aria-label="Sharkbite logo"
            className={styles.pedalLogoControl}
            data-helper-draggable={controlMoveModeActive ? "true" : "false"}
            data-helper-dragging={controlDragState?.id === "logo" ? "true" : "false"}
            style={logoStyle}
            onPointerCancelCapture={(event) => onStopControlDrag(event)}
            onPointerDownCapture={(event) => onStartControlDrag("logo", event)}
            onPointerMoveCapture={(event) => onMoveControlDrag(event)}
            onPointerUpCapture={(event) => onStopControlDrag(event)}
          >
            <Image
              priority
              unoptimized
              alt="Sharkbite"
              className={styles.pedalLogoImage}
              height={497}
              src="/assets/sharkbite/logo.png"
              width={688}
            />
          </div>
          <span className={`${styles.jackLabel} ${styles.inputJackLabel}`}>Input Source</span>
          <div
            aria-label="Dry wet mix"
            aria-valuemax={maxInputLevel}
            aria-valuemin={0}
            aria-valuenow={wetDry}
            aria-valuetext={`${maxInputLevel - wetDry}% dry, ${wetDry}% wet`}
            className={`${styles.knobControl} ${styles.wetDryControl}`}
            data-dragging={wetDryDragging}
            data-helper-draggable={controlMoveModeActive ? "true" : "false"}
            data-helper-dragging={controlDragState?.id === "wetDry" ? "true" : "false"}
            role="slider"
            style={wetDryKnobStyle}
            tabIndex={0}
            onKeyDown={onWetDryKeyDown}
            onLostPointerCapture={onWetDryLostPointerCapture}
            onPointerCancel={onWetDryPointerCancel}
            onPointerCancelCapture={(event) => onStopControlDrag(event)}
            onPointerDown={onWetDryPointerDown}
            onPointerDownCapture={(event) => onStartControlDrag("wetDry", event)}
            onPointerMove={onWetDryPointerMove}
            onPointerMoveCapture={(event) => onMoveControlDrag(event)}
            onPointerUp={onWetDryPointerCancel}
            onPointerUpCapture={(event) => onStopControlDrag(event)}
          >
            <span className={styles.srOnly}>
              Dry wet mix {maxInputLevel - wetDry}% dry, {wetDry}% wet
            </span>
            <span aria-hidden="true" className={styles.knob} />
          </div>
          <span className={`${styles.jackLabel} ${styles.wetDryLabel}`} style={wetDryKnobStyle}>
            Dry/Wet
          </span>
          <div
            aria-label="Input level"
            aria-valuemax={maxInputLevel}
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
            onKeyDown={onInputLevelKeyDown}
            onLostPointerCapture={onInputLevelLostPointerCapture}
            onPointerCancel={onInputLevelPointerCancel}
            onPointerCancelCapture={(event) => onStopControlDrag(event)}
            onPointerDown={onInputLevelPointerDown}
            onPointerDownCapture={(event) => onStartControlDrag("inputLevel", event)}
            onPointerMove={onInputLevelPointerMove}
            onPointerMoveCapture={(event) => onMoveControlDrag(event)}
            onPointerUp={onInputLevelPointerCancel}
            onPointerUpCapture={(event) => onStopControlDrag(event)}
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
            data-active={statusRunning ? "true" : "false"}
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
                className={`${styles.tapButton} ${
                  TAP_BUTTON_SIDE[tap.id] === "left" ? styles.tapButtonLeft : styles.tapButtonRight
                }`}
                data-enabled={tapEnabled ? "true" : "false"}
                data-helper-draggable={controlMoveModeActive ? "true" : "false"}
                data-helper-dragging={controlDragState?.id === tap.id ? "true" : "false"}
                disabled={!statusRunning && !controlMoveModeActive}
                style={tapButtonStyle}
                type="button"
                onClick={(event) => {
                  if (controlMoveModeActive) {
                    event.preventDefault();
                    return;
                  }
                  onToggleTap(tap.id);
                }}
                onPointerCancelCapture={(event) => onStopControlDrag(event)}
                onPointerDownCapture={(event) => onStartControlDrag(tap.id, event)}
                onPointerMoveCapture={(event) => onMoveControlDrag(event)}
                onPointerUpCapture={(event) => onStopControlDrag(event)}
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
  );
}
