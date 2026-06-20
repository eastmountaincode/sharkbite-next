"use client";

import type { CSSProperties } from "react";
import type { TapConfig } from "@/config/taps";
import type { TapMetrics } from "@/lib/audio/types";
import styles from "./sharkbite.module.css";

type TapRowProps = {
  tap: TapConfig;
  metrics: TapMetrics;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
};

function formatMetric(value: number | null, digits = 0) {
  if (value === null || Number.isNaN(value)) return "-";
  return value.toFixed(digits);
}

function tapStatusLabel(enabled: boolean, connected: boolean) {
  if (connected) return "Connected";
  if (enabled) return "Connecting";
  return "Ready";
}

export function TapRow({ tap, metrics, enabled, onToggle }: TapRowProps) {
  const style = { "--tap-color": tap.color } as CSSProperties;
  const levelPct = Math.round(metrics.level * 100);

  return (
    <article className={`${styles.tapRow} ${enabled ? styles.tapOn : ""}`} style={style}>
      <div className={styles.tapIdentity}>
        <span className={`${styles.tapDot} ${metrics.connected ? styles.tapDotLive : ""}`} />
        <div>
          <h3>{tap.name}</h3>
          <p>{tapStatusLabel(enabled, metrics.connected)}</p>
        </div>
      </div>

      <button
        aria-label={`${enabled ? "Disable" : "Enable"} ${tap.name}`}
        aria-pressed={enabled}
        className={`${styles.switch} ${enabled ? styles.switchOn : ""}`}
        type="button"
        onClick={() => onToggle(!enabled)}
      />

      <div className={styles.tapReadout}>
        <div className={styles.tapSignal}>
          <span>Signal</span>
          <div aria-label={`${tap.name} signal level`} className={styles.tapSignalMeter}>
            <i style={{ width: `${levelPct}%` }} />
          </div>
        </div>
        <div className={styles.metric}>
          <b>{metrics.rttMs === null ? "-" : `${formatMetric(metrics.rttMs)}ms`}</b>
          <span>RTT</span>
        </div>
      </div>
    </article>
  );
}
