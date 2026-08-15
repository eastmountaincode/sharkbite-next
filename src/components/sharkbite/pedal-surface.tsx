import Image from "next/image";
import type { CSSProperties, PointerEvent as ReactPointerEvent, RefObject } from "react";
import { TAPS, type TapId } from "@/config/taps";
import type { TapMetricsMap } from "@/lib/audio/types";
import type { TapButtonCapGeometryBySide, TapButtonSide } from "./sharkbite-model";
import styles from "./sharkbite.module.css";

type AreaPoint = {
  x: number;
  y: number;
};

type ControlLayoutId =
  | "logo"
  | "outputJack"
  | "inputJack"
  | "inputSource"
  | "wetDry"
  | "inputLevel"
  | TapId;

type ControlDragStateSnapshot = {
  id: ControlLayoutId;
} | null;

type PedalSurfaceProps = {
  controlDragState: ControlDragStateSnapshot;
  controlLayout: Record<ControlLayoutId, AreaPoint>;
  controlMoveModeActive: boolean;
  enabledTaps: Record<TapId, boolean>;
  inputDialogOpen: boolean;
  inputKnobStyle: CSSProperties;
  inputLevel: number;
  inputLevelDragging: boolean;
  inputMeterStyle: CSSProperties;
  layoutGridVisible: boolean;
  logoStyle: CSSProperties;
  maxInputLevel: number;
  pedalOverlayRef: RefObject<HTMLDivElement | null>;
  statusRunning: boolean;
  tapButtonCapGeometry: TapButtonCapGeometryBySide;
  tapButtonStatePreviewVisible: boolean;
  tapMetrics: TapMetricsMap;
  wetDry: number;
  wetDryDragging: boolean;
  wetDryKnobStyle: CSSProperties;
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

const TAP_BUTTON_SIDE: Record<TapId, TapButtonSide> = {
  rich: "left",
  sf: "left",
  fra: "right",
  blr: "right",
};

const formatDelay = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return "--";
  return `${Math.round(value)}ms`;
};

export function PedalSurface({
  controlDragState,
  controlLayout,
  controlMoveModeActive,
  enabledTaps,
  inputDialogOpen,
  inputKnobStyle,
  inputLevel,
  inputLevelDragging,
  inputMeterStyle,
  layoutGridVisible,
  logoStyle,
  maxInputLevel,
  pedalOverlayRef,
  statusRunning,
  tapButtonCapGeometry,
  tapButtonStatePreviewVisible,
  tapMetrics,
  wetDry,
  wetDryDragging,
  wetDryKnobStyle,
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
        <div ref={pedalOverlayRef} className={styles.pedalOverlay}>
          <span aria-hidden="true" className={styles.layoutGrid} data-visible={layoutGridVisible ? "true" : "false"} />
          <Image
            unoptimized
            alt="Output jack connector"
            className={styles.topJack}
            data-helper-draggable={controlMoveModeActive ? "true" : "false"}
            data-helper-dragging={controlDragState?.id === "outputJack" ? "true" : "false"}
            draggable={false}
            height={161}
            src="/assets/sharkbite/top-jack-1.png"
            style={
              {
                "--control-x": `${controlLayout.outputJack.x}%`,
                "--control-y": `${controlLayout.outputJack.y}%`,
              } as CSSProperties
            }
            width={475}
            onPointerCancelCapture={(event) => onStopControlDrag(event)}
            onPointerDownCapture={(event) => onStartControlDrag("outputJack", event)}
            onPointerMoveCapture={(event) => onMoveControlDrag(event)}
            onPointerUpCapture={(event) => onStopControlDrag(event)}
          />
          <button
            aria-expanded={inputDialogOpen}
            aria-haspopup="dialog"
            aria-label="Choose input source"
            className={`${styles.topJack} ${styles.inputSourceJack}`}
            data-helper-draggable={controlMoveModeActive ? "true" : "false"}
            data-helper-dragging={controlDragState?.id === "inputJack" ? "true" : "false"}
            style={
              {
                "--control-x": `${controlLayout.inputJack.x}%`,
                "--control-y": `${controlLayout.inputJack.y}%`,
              } as CSSProperties
            }
            type="button"
            onClick={() => {
              if (!controlMoveModeActive) onOpenInputDialog();
            }}
            onPointerCancelCapture={(event) => onStopControlDrag(event)}
            onPointerDownCapture={(event) => onStartControlDrag("inputJack", event)}
            onPointerMoveCapture={(event) => onMoveControlDrag(event)}
            onPointerUpCapture={(event) => onStopControlDrag(event)}
          >
            <Image
              unoptimized
              alt=""
              className={styles.topJackGraphic}
              draggable={false}
              height={174}
              src="/assets/sharkbite/top-jack-2.png"
              width={474}
            />
          </button>
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
          <button
            aria-expanded={inputDialogOpen}
            aria-haspopup="dialog"
            className={`${styles.jackLabel} ${styles.inputJackLabel}`}
            data-helper-draggable={controlMoveModeActive ? "true" : "false"}
            data-helper-dragging={controlDragState?.id === "inputSource" ? "true" : "false"}
            style={
              {
                "--control-x": `${controlLayout.inputSource.x}%`,
                "--control-y": `${controlLayout.inputSource.y}%`,
              } as CSSProperties
            }
            type="button"
            onClick={() => {
              if (!controlMoveModeActive) onOpenInputDialog();
            }}
            onPointerCancelCapture={(event) => onStopControlDrag(event)}
            onPointerDownCapture={(event) => onStartControlDrag("inputSource", event)}
            onPointerMoveCapture={(event) => onMoveControlDrag(event)}
            onPointerUpCapture={(event) => onStopControlDrag(event)}
          >
            Input Source
          </button>
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
            const tapButtonSide = TAP_BUTTON_SIDE[tap.id];
            const capGeometry = tapButtonCapGeometry[tapButtonSide];
            const delayLabel = tapEnabled ? formatDelay(tapMetrics[tap.id].rttMs) : "--";
            const tapButtonStyle = {
              "--control-x": `${layout.x}%`,
              "--control-y": `${layout.y}%`,
              "--tap-cap-off-x": `${capGeometry.off.x}%`,
              "--tap-cap-off-y": `${capGeometry.off.y}%`,
              "--tap-cap-off-size": `${capGeometry.off.size}%`,
              "--tap-cap-on-x": `${capGeometry.on.x}%`,
              "--tap-cap-on-y": `${capGeometry.on.y}%`,
              "--tap-cap-on-size": `${capGeometry.on.size}%`,
            } as CSSProperties;

            return (
              <button
                key={tap.id}
                aria-pressed={tapEnabled}
                className={`${styles.tapButton} ${
                  tapButtonSide === "left" ? styles.tapButtonLeft : styles.tapButtonRight
                }`}
                data-enabled={tapEnabled ? "true" : "false"}
                data-state-preview={tapButtonStatePreviewVisible ? "true" : "false"}
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
