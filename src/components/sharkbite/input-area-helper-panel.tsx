import type { CSSProperties, PointerEvent as ReactPointerEvent, RefObject } from "react";
import styles from "./sharkbite.module.css";

type InputAreaPolygon = "hit" | "highlight";
type InputAreaHelperMode = InputAreaPolygon | "controls";

type InputAreaHelperPanelProps = {
  activeInputAreaHelperPolygon: InputAreaPolygon;
  clipboardText: string;
  helperPanelDragging: boolean;
  helperPanelRef: RefObject<HTMLElement | null>;
  helperPanelStyle?: CSSProperties;
  inputAreaHelperMode: InputAreaHelperMode;
  inputAreaHelperVisible: boolean;
  onCopyControlLayout: () => void;
  onCopyInputAreaPolygons: () => void;
  onModeChange: (mode: InputAreaHelperMode) => void;
  onRemoveLastInputAreaPoint: () => void;
  onResetControlLayout: () => void;
  onResetInputAreaPolygon: (polygon: InputAreaPolygon) => void;
  onStartHelperPanelDrag: (event: ReactPointerEvent<HTMLElement>) => void;
  onMoveHelperPanelDrag: (event: ReactPointerEvent<HTMLElement>) => void;
  onStopHelperPanelDrag: (event: ReactPointerEvent<HTMLElement>) => void;
};

export function InputAreaHelperPanel({
  activeInputAreaHelperPolygon,
  clipboardText,
  helperPanelDragging,
  helperPanelRef,
  helperPanelStyle,
  inputAreaHelperMode,
  inputAreaHelperVisible,
  onCopyControlLayout,
  onCopyInputAreaPolygons,
  onModeChange,
  onRemoveLastInputAreaPoint,
  onResetControlLayout,
  onResetInputAreaPolygon,
  onStartHelperPanelDrag,
  onMoveHelperPanelDrag,
  onStopHelperPanelDrag,
}: InputAreaHelperPanelProps) {
  return (
    <aside
      ref={helperPanelRef}
      className={styles.inputAreaHelperPanel}
      data-dragging={helperPanelDragging ? "true" : "false"}
      aria-label="Input area helper"
      hidden={!inputAreaHelperVisible}
      style={helperPanelStyle}
    >
      <header
        onPointerCancel={onStopHelperPanelDrag}
        onPointerDown={onStartHelperPanelDrag}
        onPointerMove={onMoveHelperPanelDrag}
        onPointerUp={onStopHelperPanelDrag}
      >
        <b>Input Area Helper</b>
        <span>Press H to hide</span>
      </header>
      <div className={styles.inputAreaHelperTabs}>
        <button
          className={inputAreaHelperMode === "highlight" ? styles.inputAreaHelperTabActive : undefined}
          type="button"
          onClick={() => onModeChange("highlight")}
        >
          Highlight
        </button>
        <button
          className={inputAreaHelperMode === "hit" ? styles.inputAreaHelperTabActive : undefined}
          type="button"
          onClick={() => onModeChange("hit")}
        >
          Hit Area
        </button>
        <button
          className={inputAreaHelperMode === "controls" ? styles.inputAreaHelperTabActive : undefined}
          type="button"
          onClick={() => onModeChange("controls")}
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
          <button type="button" onClick={onResetControlLayout}>
            Reset Layout
          </button>
          <button type="button" onClick={onCopyControlLayout}>
            Copy Layout
          </button>
        </div>
      ) : (
        <div className={styles.inputAreaHelperActions}>
          <button type="button" onClick={() => onResetInputAreaPolygon(activeInputAreaHelperPolygon)}>
            Reset Active
          </button>
          <button type="button" onClick={onRemoveLastInputAreaPoint}>
            Remove Last
          </button>
          <button type="button" onClick={onCopyInputAreaPolygons}>
            Copy Points
          </button>
        </div>
      )}
      <textarea readOnly value={clipboardText} />
    </aside>
  );
}
