import {
    type CSSProperties,
    type PointerEvent as ReactPointerEvent,
    useEffect,
    useRef,
    useState,
} from "react";
import {
    type AreaPoint,
    type ControlDragState,
    type ControlLayoutId,
    type HelperPanelDragState,
    type HelperPanelPosition,
    type TapButtonCapGeometry,
    type TapButtonSide,
    type TapButtonVisualState,
    clampAreaValue,
    clampHelperPanelPosition,
    CONTROL_LAYOUT,
    ENABLE_INPUT_AREA_HELPER,
    formatControlLayoutConstant,
    formatTapButtonCapGeometryConstant,
    HELPER_PANEL_POSITION_STORAGE_KEY,
    parseStoredHelperPanelPosition,
    TAP_BUTTON_CAP_GEOMETRY,
} from "./sharkbite-model";

type UsePedalEditorArgs = {
    infoDialogOpen: boolean;
    inputDialogOpen: boolean;
    pianoVisible: boolean;
};

export function usePedalEditor({ infoDialogOpen, inputDialogOpen, pianoVisible }: UsePedalEditorArgs) {
    const helperPanelRef = useRef<HTMLElement | null>(null);
    const pedalOverlayRef = useRef<HTMLDivElement | null>(null);
    const controlDragRef = useRef<ControlDragState | null>(null);
    const helperPanelDragRef = useRef<HelperPanelDragState | null>(null);
    const [controlLayout, setControlLayout] = useState(CONTROL_LAYOUT);
    const [tapButtonCapGeometry, setTapButtonCapGeometry] = useState(TAP_BUTTON_CAP_GEOMETRY);
    const [tapButtonStatePreviewVisible, setTapButtonStatePreviewVisible] = useState(false);
    const [controlDragState, setControlDragState] = useState<ControlDragState | null>(null);
    const [inputAreaHelperVisible, setInputAreaHelperVisible] = useState(false);
    const [layoutGridVisible, setLayoutGridVisible] = useState(false);
    const [helperPanelPosition, setHelperPanelPosition] = useState<HelperPanelPosition | null>(null);
    const [helperPanelDragging, setHelperPanelDragging] = useState(false);
    const [storedHelperStateReady, setStoredHelperStateReady] = useState(false);

    useEffect(() => {
        if (!ENABLE_INPUT_AREA_HELPER) return;

        window.queueMicrotask(() => {
            try {
                const storedHelperPanelPosition = parseStoredHelperPanelPosition(
                    window.localStorage.getItem(HELPER_PANEL_POSITION_STORAGE_KEY),
                );

                if (storedHelperPanelPosition) setHelperPanelPosition(storedHelperPanelPosition);
            } catch {
                // Helper persistence is non-critical; the checked-in layout remains the fallback.
            } finally {
                setStoredHelperStateReady(true);
            }
        });
    }, []);

    useEffect(() => {
        if (!ENABLE_INPUT_AREA_HELPER) return;
        if (!storedHelperStateReady) return;

        try {
            if (helperPanelPosition) {
                window.localStorage.setItem(HELPER_PANEL_POSITION_STORAGE_KEY, JSON.stringify(helperPanelPosition));
            } else {
                window.localStorage.removeItem(HELPER_PANEL_POSITION_STORAGE_KEY);
            }
        } catch {
            // Ignore private-mode or quota failures; the panel remains draggable.
        }
    }, [helperPanelPosition, storedHelperStateReady]);

    useEffect(() => {
        if (!inputAreaHelperVisible || !helperPanelPosition) return;

        const rect = helperPanelRef.current?.getBoundingClientRect();
        const nextPosition = clampHelperPanelPosition(helperPanelPosition, rect);
        if (nextPosition.x !== helperPanelPosition.x || nextPosition.y !== helperPanelPosition.y) {
            setHelperPanelPosition(nextPosition);
        }
    }, [helperPanelPosition, inputAreaHelperVisible]);

    useEffect(() => {
        if (!ENABLE_INPUT_AREA_HELPER) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target instanceof HTMLElement ? event.target : null;
            const targetIsEditable =
                target?.tagName === "INPUT" ||
                target?.tagName === "SELECT" ||
                target?.tagName === "TEXTAREA" ||
                target?.isContentEditable;

            const isHelperKey = event.key.toLowerCase() === "h" || event.code === "KeyH";

            if (
                targetIsEditable ||
                event.metaKey ||
                event.ctrlKey ||
                event.altKey ||
                !isHelperKey ||
                pianoVisible ||
                infoDialogOpen ||
                inputDialogOpen
            ) {
                return;
            }

            event.preventDefault();
            setInputAreaHelperVisible((visible) => !visible);
        };

        document.addEventListener("keydown", handleKeyDown, true);
        return () => document.removeEventListener("keydown", handleKeyDown, true);
    }, [infoDialogOpen, inputDialogOpen, pianoVisible]);

    const getPedalPoint = (clientX: number, clientY: number) => {
        const pedalOverlay = pedalOverlayRef.current;
        if (!pedalOverlay) return null;

        const rect = pedalOverlay.getBoundingClientRect();
        return {
            x: clampAreaValue(((clientX - rect.left) / rect.width) * 100),
            y: clampAreaValue(((clientY - rect.top) / rect.height) * 100),
        };
    };

    const setControlPosition = (id: ControlLayoutId, nextPoint: AreaPoint) => {
        setControlLayout((current) => ({
            ...current,
            [id]: nextPoint,
        }));
    };

    const copyControlLayout = () => {
        const text = [
            formatControlLayoutConstant(controlLayout),
            formatTapButtonCapGeometryConstant(tapButtonCapGeometry),
        ].join("\n\n");
        void navigator.clipboard?.writeText(text);
    };

    const updateTapButtonCapGeometry = (
        side: TapButtonSide,
        state: TapButtonVisualState,
        property: keyof TapButtonCapGeometry,
        value: number,
    ) => {
        setTapButtonCapGeometry((current) => ({
            ...current,
            [side]: {
                ...current[side],
                [state]: {
                    ...current[side][state],
                    [property]: value,
                },
            },
        }));
    };

    const startControlDrag = (id: ControlLayoutId, event: ReactPointerEvent<HTMLElement>) => {
        if (!ENABLE_INPUT_AREA_HELPER || !inputAreaHelperVisible) return;
        if (event.button !== 0) return;

        const pointerPoint = getPedalPoint(event.clientX, event.clientY);
        if (!pointerPoint) return;

        event.preventDefault();
        event.stopPropagation();
        try {
            event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
            // Synthetic pointer events in verification do not have an active pointer.
        }
        const nextDragState = {
            id,
            offsetX: pointerPoint.x - controlLayout[id].x,
            offsetY: pointerPoint.y - controlLayout[id].y,
            pointerId: event.pointerId,
        };
        controlDragRef.current = nextDragState;
        setControlDragState(nextDragState);
    };

    const handleControlDragPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
        const dragState = controlDragRef.current;
        if (!dragState || dragState.pointerId !== event.pointerId) return;

        const pointerPoint = getPedalPoint(event.clientX, event.clientY);
        if (!pointerPoint) return;

        event.preventDefault();
        event.stopPropagation();
        setControlPosition(dragState.id, {
            x: clampAreaValue(pointerPoint.x - dragState.offsetX),
            y: clampAreaValue(pointerPoint.y - dragState.offsetY),
        });
    };

    const stopControlDrag = (event: ReactPointerEvent<HTMLElement>) => {
        if (controlDragRef.current?.pointerId !== event.pointerId) return;

        try {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
            }
        } catch {
            // Matching guard for synthetic verification events.
        }

        event.preventDefault();
        event.stopPropagation();
        controlDragRef.current = null;
        setControlDragState(null);
    };

    const startHelperPanelDrag = (event: ReactPointerEvent<HTMLElement>) => {
        if (event.button !== 0) return;

        const panel = helperPanelRef.current;
        if (!panel) return;

        const rect = panel.getBoundingClientRect();
        event.preventDefault();
        try {
            event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
            // Synthetic pointer events in verification do not have an active pointer.
        }

        helperPanelDragRef.current = {
            offsetX: event.clientX - rect.left,
            offsetY: event.clientY - rect.top,
            pointerId: event.pointerId,
        };
        setHelperPanelPosition(clampHelperPanelPosition({ x: rect.left, y: rect.top }, rect));
        setHelperPanelDragging(true);
    };

    const handleHelperPanelDragPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
        const dragState = helperPanelDragRef.current;
        if (!dragState || dragState.pointerId !== event.pointerId) return;

        const rect = helperPanelRef.current?.getBoundingClientRect();
        event.preventDefault();
        setHelperPanelPosition(
            clampHelperPanelPosition(
                {
                    x: event.clientX - dragState.offsetX,
                    y: event.clientY - dragState.offsetY,
                },
                rect,
            ),
        );
    };

    const stopHelperPanelDrag = (event: ReactPointerEvent<HTMLElement>) => {
        if (helperPanelDragRef.current?.pointerId !== event.pointerId) return;

        try {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
            }
        } catch {
            // Matching guard for synthetic verification events.
        }

        event.preventDefault();
        helperPanelDragRef.current = null;
        setHelperPanelDragging(false);
    };

    const helperPanelStyle = helperPanelPosition
        ? ({
            bottom: "auto",
            left: `${helperPanelPosition.x}px`,
            right: "auto",
            top: `${helperPanelPosition.y}px`,
        } as CSSProperties)
        : undefined;
    const controlMoveModeActive = ENABLE_INPUT_AREA_HELPER && inputAreaHelperVisible;
    const helperClipboardText = [
        formatControlLayoutConstant(controlLayout),
        formatTapButtonCapGeometryConstant(tapButtonCapGeometry),
    ].join("\n\n");

    return {
        controlDragState,
        controlLayout,
        controlMoveModeActive,
        copyControlLayout,
        handleControlDragPointerMove,
        handleHelperPanelDragPointerMove,
        helperClipboardText,
        helperPanelDragging,
        helperPanelRef,
        helperPanelStyle,
        inputAreaHelperVisible,
        layoutGridVisible,
        pedalOverlayRef,
        resetPedalLayout: () => {
            setControlLayout(CONTROL_LAYOUT);
            setTapButtonCapGeometry(TAP_BUTTON_CAP_GEOMETRY);
        },
        startControlDrag,
        startHelperPanelDrag,
        stopControlDrag,
        stopHelperPanelDrag,
        tapButtonCapGeometry,
        tapButtonStatePreviewVisible,
        toggleLayoutGrid: () => setLayoutGridVisible((visible) => !visible),
        toggleTapButtonStatePreview: () => setTapButtonStatePreviewVisible((visible) => !visible),
        updateTapButtonCapGeometry,
    };
}
