"use client";

import type { CSSProperties } from "react";
import type { TapConfig } from "@/config/taps";
import type { TapMetrics, TapSettings } from "@/lib/audio/types";
import { RangeControl } from "./control";
import styles from "./sharkbite.module.css";

type TapRowProps = {
  tap: TapConfig;
  metrics: TapMetrics;
  settings: TapSettings;
  onToggle: (enabled: boolean) => void;
  onSettingsChange: (settings: TapSettings) => void;
};

function formatMetric(value: number | null, digits = 0) {
  if (value === null || Number.isNaN(value)) return "-";
  return value.toFixed(digits);
}

function panLabel(value: number) {
  if (value === 0) return "C";
  return `${value < 0 ? "L" : "R"}${Math.abs(value)}`;
}

export function TapRow({ tap, metrics, settings, onToggle, onSettingsChange }: TapRowProps) {
  const style = { "--tap-color": tap.color } as CSSProperties;

  return (
    <article className={`${styles.tapRow} ${settings.enabled ? styles.tapOn : ""}`} style={style}>
      <div className={styles.tapIdentity}>
        <span className={`${styles.tapDot} ${metrics.connected ? styles.tapDotLive : ""}`} />
        <div>
          <h3>{tap.name}</h3>
          <p>{tap.ip}</p>
        </div>
      </div>

      <button
        aria-label={`${settings.enabled ? "Disable" : "Enable"} ${tap.name}`}
        aria-pressed={settings.enabled}
        className={`${styles.switch} ${settings.enabled ? styles.switchOn : ""}`}
        type="button"
        onClick={() => onToggle(!settings.enabled)}
      />

      <div className={styles.tapControls}>
        <RangeControl
          label="Return"
          max={120}
          min={0}
          value={Math.round(settings.returnLevel * 100)}
          valueLabel={`${Math.round(settings.returnLevel * 100)}%`}
          onChange={(value) => onSettingsChange({ ...settings, returnLevel: value / 100 })}
        />
        <RangeControl
          label="Pan"
          max={100}
          min={-100}
          value={settings.pan}
          valueLabel={panLabel(settings.pan)}
          onChange={(value) => onSettingsChange({ ...settings, pan: value })}
        />
      </div>

      <div className={styles.metricGrid}>
        <div className={styles.metric}>
          <b>{formatMetric(metrics.rttMs)}</b>
          <span>RTT</span>
        </div>
        <div className={styles.metric}>
          <b>{formatMetric(metrics.jitterMs, 1)}</b>
          <span>Jit</span>
        </div>
        <div className={styles.metric}>
          <b>{formatMetric(metrics.lossPct, 1)}</b>
          <span>Loss</span>
        </div>
      </div>
    </article>
  );
}
