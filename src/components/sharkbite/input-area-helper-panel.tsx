import type { CSSProperties, PointerEvent as ReactPointerEvent, RefObject } from "react";
import type {
  TapButtonCapGeometry,
  TapButtonCapGeometryBySide,
  TapButtonSide,
  TapButtonVisualState,
} from "./sharkbite-model";
import styles from "./sharkbite.module.css";

const TAP_BUTTON_SIDES: TapButtonSide[] = ["right", "left"];
const TAP_BUTTON_STATES: TapButtonVisualState[] = ["off", "on"];
const TAP_BUTTON_GEOMETRY_CONTROLS: Array<{
  label: string;
  max: number;
  min: number;
  property: keyof TapButtonCapGeometry;
}> = [
  { label: "X", min: 0, max: 100, property: "x" },
  { label: "Y", min: 0, max: 100, property: "y" },
  { label: "Size", min: 50, max: 140, property: "size" },
];

type InputAreaHelperPanelProps = {
  clipboardText: string;
  helperPanelDragging: boolean;
  helperPanelRef: RefObject<HTMLElement | null>;
  helperPanelStyle?: CSSProperties;
  inputAreaHelperVisible: boolean;
  layoutGridVisible: boolean;
  tapButtonCapGeometry: TapButtonCapGeometryBySide;
  tapButtonStatePreviewVisible: boolean;
  onCopyControlLayout: () => void;
  onResetPedalLayout: () => void;
  onToggleLayoutGrid: () => void;
  onToggleTapButtonStatePreview: () => void;
  onTapButtonCapGeometryChange: (
    side: TapButtonSide,
    state: TapButtonVisualState,
    property: keyof TapButtonCapGeometry,
    value: number,
  ) => void;
  onStartHelperPanelDrag: (event: ReactPointerEvent<HTMLElement>) => void;
  onMoveHelperPanelDrag: (event: ReactPointerEvent<HTMLElement>) => void;
  onStopHelperPanelDrag: (event: ReactPointerEvent<HTMLElement>) => void;
};

export function InputAreaHelperPanel({
  clipboardText,
  helperPanelDragging,
  helperPanelRef,
  helperPanelStyle,
  inputAreaHelperVisible,
  layoutGridVisible,
  tapButtonCapGeometry,
  tapButtonStatePreviewVisible,
  onCopyControlLayout,
  onResetPedalLayout,
  onToggleLayoutGrid,
  onToggleTapButtonStatePreview,
  onTapButtonCapGeometryChange,
  onStartHelperPanelDrag,
  onMoveHelperPanelDrag,
  onStopHelperPanelDrag,
}: InputAreaHelperPanelProps) {
  return (
    <aside
      ref={helperPanelRef}
      className={styles.inputAreaHelperPanel}
      data-dragging={helperPanelDragging ? "true" : "false"}
      aria-label="Pedal layout helper"
      hidden={!inputAreaHelperVisible}
      style={helperPanelStyle}
    >
      <header
        onPointerCancel={onStopHelperPanelDrag}
        onPointerDown={onStartHelperPanelDrag}
        onPointerMove={onMoveHelperPanelDrag}
        onPointerUp={onStopHelperPanelDrag}
      >
        <b>Pedal Layout Helper</b>
        <span>Press H to hide</span>
      </header>
      <p>Drag the outlined pedal controls and labels. Toggle the grid for alignment.</p>
      {TAP_BUTTON_SIDES.map((side) => (
        <section className={styles.tapCapGeometryGroup} key={side}>
          <b>Facing {side === "right" ? "Right" : "Left"}</b>
          <div className={styles.tapCapGeometryControls}>
            {TAP_BUTTON_STATES.map((state) => (
              <fieldset key={state}>
                <legend>{state === "off" ? "Off" : "On"}</legend>
                {TAP_BUTTON_GEOMETRY_CONTROLS.map(({ label, max, min, property }) => (
                  <label key={property}>
                    <span>{label}</span>
                    <input
                      aria-label={`${side} ${state} button ${label.toLowerCase()} slider`}
                      max={max}
                      min={min}
                      step={0.5}
                      type="range"
                      value={tapButtonCapGeometry[side][state][property]}
                      onChange={(event) =>
                        onTapButtonCapGeometryChange(
                          side,
                          state,
                          property,
                          Number(event.currentTarget.value),
                        )
                      }
                    />
                    <input
                      aria-label={`${side} ${state} button ${label.toLowerCase()} value`}
                      className={styles.tapCapGeometryValue}
                      max={max}
                      min={min}
                      step={0.5}
                      type="number"
                      value={tapButtonCapGeometry[side][state][property]}
                      onChange={(event) =>
                        onTapButtonCapGeometryChange(
                          side,
                          state,
                          property,
                          Number(event.currentTarget.value),
                        )
                      }
                    />
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
        </section>
      ))}
      <button
        aria-pressed={tapButtonStatePreviewVisible}
        className={styles.tapStatePreviewToggle}
        type="button"
        onClick={onToggleTapButtonStatePreview}
      >
        Preview Both States
      </button>
      <div className={styles.inputAreaHelperActions}>
        <button type="button" onClick={onResetPedalLayout}>
          Reset Layout
        </button>
        <button type="button" onClick={onCopyControlLayout}>
          Copy Layout
        </button>
        <button aria-pressed={layoutGridVisible} type="button" onClick={onToggleLayoutGrid}>
          Grid {layoutGridVisible ? "On" : "Off"}
        </button>
      </div>
      <textarea readOnly value={clipboardText} />
    </aside>
  );
}
