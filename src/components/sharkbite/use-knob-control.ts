import {
    type KeyboardEvent as ReactKeyboardEvent,
    type PointerEvent as ReactPointerEvent,
    useRef,
    useState,
} from "react";
import {
    type KnobDragState,
    clampKnobAngle,
    INPUT_LEVEL_SPIN_DEAD_ZONE_RATIO,
    knobAngleToValue,
    knobValueToAngle,
    MAX_INPUT_LEVEL,
    pointerPositionForElement,
    signedAngleDelta,
} from "./sharkbite-model";

type UseKnobControlArgs = {
    maxValue?: number;
    onChange: (value: number) => void;
    value: number;
};

export function useKnobControl({ maxValue = MAX_INPUT_LEVEL, onChange, value }: UseKnobControlArgs) {
    const dragRef = useRef<KnobDragState | null>(null);
    const [dragging, setDragging] = useState(false);

    const stopDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (dragRef.current?.pointerId !== event.pointerId) return;

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }

        dragRef.current = null;
        setDragging(false);
    };

    const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;

        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        const startPointer = pointerPositionForElement(event);
        dragRef.current = {
            currentKnobAngle: knobValueToAngle(value),
            lastPointerAngle: startPointer.angle,
            pointerId: event.pointerId,
            spinReady: startPointer.radiusRatio >= INPUT_LEVEL_SPIN_DEAD_ZONE_RATIO,
        };
        setDragging(true);
    };

    const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        const dragState = dragRef.current;
        if (!dragState || dragState.pointerId !== event.pointerId) return;

        event.preventDefault();
        const nextPointer = pointerPositionForElement(event);

        if (!dragState.spinReady && nextPointer.radiusRatio < INPUT_LEVEL_SPIN_DEAD_ZONE_RATIO) return;
        if (!dragState.spinReady) {
            dragState.spinReady = true;
            dragState.lastPointerAngle = nextPointer.angle;
            return;
        }

        const nextKnobAngle = clampKnobAngle(
            dragState.currentKnobAngle + signedAngleDelta(dragState.lastPointerAngle, nextPointer.angle),
        );
        dragState.lastPointerAngle = nextPointer.angle;
        dragState.currentKnobAngle = nextKnobAngle;
        onChange(knobAngleToValue(nextKnobAngle));
    };

    const handleLostPointerCapture = () => {
        dragRef.current = null;
        setDragging(false);
    };

    const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
        const largeStep = event.shiftKey ? 10 : 5;
        const smallStep = event.shiftKey ? 5 : 1;

        switch (event.key) {
            case "ArrowUp":
            case "ArrowRight":
                event.preventDefault();
                onChange(value + smallStep);
                break;
            case "ArrowDown":
            case "ArrowLeft":
                event.preventDefault();
                onChange(value - smallStep);
                break;
            case "PageUp":
                event.preventDefault();
                onChange(value + largeStep);
                break;
            case "PageDown":
                event.preventDefault();
                onChange(value - largeStep);
                break;
            case "Home":
                event.preventDefault();
                onChange(0);
                break;
            case "End":
                event.preventDefault();
                onChange(maxValue);
                break;
        }
    };

    return {
        dragging,
        handleKeyDown,
        handleLostPointerCapture,
        handlePointerDown,
        handlePointerMove,
        stopDrag,
    };
}
