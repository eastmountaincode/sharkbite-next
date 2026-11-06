import { type CSSProperties, type ReactNode } from "react";
import { knobValueToCssRotation } from "./sharkbite-model";
import styles from "./sharkbite.module.css";
import { useKnobControl } from "./use-knob-control";

type AtlasKnobProps = {
    label: string;
    value: number;
    maximum: number;
    readout: string;
    left: string;
    disabled?: boolean;
    onChange: (value: number) => void;
    children?: ReactNode;
};

export function AtlasKnob({ label, value, maximum, readout, left, disabled, onChange, children }: AtlasKnobProps) {
    const control = useKnobControl({
        value,
        maxValue: maximum,
        onChange: next => onChange(Math.max(0, Math.min(maximum, Math.round(next)))),
    });
    const style = {
        left,
        "--knob-rotation": `${knobValueToCssRotation(value / maximum * 100)}deg`,
    } as CSSProperties;
    return (
        <div className={styles.atlasKnob} style={style}>
            <div className={styles.knobControl} role="slider" aria-label={label}
                aria-valuemin={0} aria-valuemax={maximum} aria-valuenow={value} aria-valuetext={readout}
                aria-disabled={disabled} tabIndex={disabled ? -1 : 0}
                onKeyDown={disabled ? undefined : control.handleKeyDown}
                onPointerDown={disabled ? undefined : control.handlePointerDown}
                onPointerMove={control.handlePointerMove} onPointerCancel={control.stopDrag}
                onPointerUp={control.stopDrag} onLostPointerCapture={control.handleLostPointerCapture}>
                <span aria-hidden="true" className={styles.knob} />
            </div>
            {children}
            <span className={styles.jackLabel}>{label}</span>
            <output className={styles.atlasKnobValue}>{readout}</output>
        </div>
    );
}
