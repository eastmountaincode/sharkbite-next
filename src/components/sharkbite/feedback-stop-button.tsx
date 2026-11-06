import { useCallback, useEffect, useRef } from "react";
import styles from "./sharkbite.module.css";

type FeedbackStopButtonProps = {
    disabled: boolean;
    pressed: boolean;
    onChange: (pressed: boolean) => void;
};

export function FeedbackStopButton({ disabled, pressed, onChange }: FeedbackStopButtonProps) {
    const pointer = useRef<number | null>(null);
    const release = useCallback(() => {
        pointer.current = null;
        onChange(false);
    }, [onChange]);

    useEffect(() => {
        const handleVisibility = () => {
            if (document.hidden) release();
        };
        window.addEventListener("blur", release);
        document.addEventListener("visibilitychange", handleVisibility);
        return () => {
            window.removeEventListener("blur", release);
            document.removeEventListener("visibilitychange", handleVisibility);
        };
    }, [release]);

    return <button
        type="button"
        className={styles.feedbackStop}
        aria-label="Stop feedback"
        aria-pressed={pressed}
        title="Hold to stop feedback"
        disabled={disabled}
        onPointerDown={event => {
            if (event.button !== 0 || !event.isPrimary || pointer.current !== null) return;
            event.preventDefault();
            event.currentTarget.focus({ preventScroll: true });
            event.currentTarget.setPointerCapture(event.pointerId);
            pointer.current = event.pointerId;
            onChange(true);
        }}
        onPointerUp={event => {
            if (event.pointerId !== pointer.current) return;
            release();
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
            }
        }}
        onPointerCancel={release}
        onLostPointerCapture={release}
        onBlur={release}
        onKeyDown={event => {
            if (event.key !== " " && event.key !== "Enter") return;
            event.preventDefault();
            if (!event.repeat) onChange(true);
        }}
        onKeyUp={event => {
            if (event.key !== " " && event.key !== "Enter") return;
            event.preventDefault();
            release();
        }}
    />;
}
