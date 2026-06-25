"use client";

import { useEffect, useRef } from "react";
import type { TapId } from "@/config/taps";
import { readTapSignalFrame } from "@/lib/audio/tap-signal-store";
import styles from "./sharkbite.module.css";

type TapSignalScopeProps = {
  label: string;
  tapId: TapId;
};

const WAVEFORM_DECAY_MS = 180;
const WAVEFORM_BOOST = 2.2;

function resizeCanvas(canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * pixelRatio));
  const height = Math.max(1, Math.round(rect.height * pixelRatio));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  return {
    height: rect.height,
    pixelRatio,
    width: rect.width,
  };
}

export function TapSignalScope({ label, tapId }: TapSignalScopeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    let frameId = 0;

    const draw = () => {
      const { height, pixelRatio, width } = resizeCanvas(canvas);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);

      const centerY = height / 2;
      const inset = 5;
      const strokeColor = getComputedStyle(canvas).color || "rgb(36, 36, 36)";

      context.lineCap = "round";
      context.lineJoin = "round";
      context.lineWidth = 1;
      context.strokeStyle = "rgba(36, 36, 36, 0.32)";
      context.beginPath();
      context.moveTo(inset, centerY);
      context.lineTo(width - inset, centerY);
      context.stroke();

      const signal = readTapSignalFrame(tapId);
      const age = signal ? performance.now() - signal.updatedAt : Number.POSITIVE_INFINITY;
      const fade = Math.max(0, Math.min(1, 1 - age / WAVEFORM_DECAY_MS));

      if (signal && fade > 0.02) {
        const amplitude = height * 0.38 * fade;
        const points = signal.points;
        context.lineWidth = 1.5;
        context.strokeStyle = strokeColor;
        context.beginPath();

        for (let index = 0; index < points.length; index += 1) {
          const x = inset + index * ((width - inset * 2) / Math.max(1, points.length - 1));
          const sample = Math.max(-1, Math.min(1, (points[index] ?? 0) * WAVEFORM_BOOST));
          const y = centerY - sample * amplitude;
          if (index === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }

        context.stroke();
      }

      frameId = window.requestAnimationFrame(draw);
    };

    draw();
    return () => window.cancelAnimationFrame(frameId);
  }, [tapId]);

  return (
    <canvas
      aria-label={label}
      className={styles.tapSignalWaveform}
      ref={canvasRef}
      role="img"
    />
  );
}
