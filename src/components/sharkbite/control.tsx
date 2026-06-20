import type { ChangeEventHandler, ReactNode } from "react";
import styles from "./sharkbite.module.css";

type RangeControlProps = {
  label: string;
  valueLabel: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  note?: string;
  onChange: (value: number) => void;
};

export function RangeControl({
  label,
  valueLabel,
  min,
  max,
  step,
  value,
  note,
  onChange,
}: RangeControlProps) {
  const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    onChange(Number(event.target.value));
  };

  return (
    <label className={styles.control}>
      <span className={styles.controlLabel}>
        {label}
        <b>{valueLabel}</b>
      </span>
      <input min={min} max={max} step={step} type="range" value={value} onChange={handleChange} />
      {note ? <span className={styles.controlNote}>{note}</span> : null}
    </label>
  );
}

type SelectControlProps = {
  label: string;
  value: string;
  children: ReactNode;
  onChange: (value: string) => void;
};

export function SelectControl({ label, value, children, onChange }: SelectControlProps) {
  const handleChange: ChangeEventHandler<HTMLSelectElement> = (event) => {
    onChange(event.target.value);
  };

  return (
    <label className={styles.control}>
      <span className={styles.controlLabel}>{label}</span>
      <select value={value} onChange={handleChange}>
        {children}
      </select>
    </label>
  );
}
