import {
    type CSSProperties,
    type MouseEvent as ReactMouseEvent,
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
    type InputAreaDragState,
    type InputAreaHelperMode,
    type InputAreaPolygon,
    clampAreaValue,
    clampHelperPanelPosition,
    CONTROL_LAYOUT,
    CONTROL_LAYOUT_STORAGE_KEY,
    ENABLE_INPUT_AREA_HELPER,
    formatAreaConstant,
    formatControlLayoutConstant,
    HELPER_PANEL_POSITION_STORAGE_KEY,
    INPUT_AREA_POLYGONS_STORAGE_KEY,
    INPUT_HIGHLIGHT_POLYGON,
    INPUT_HIT_POLYGON,
    parseStoredControlLayout,
    parseStoredHelperPanelPosition,
    parseStoredInputAreaPolygons,
} from "./sharkbite-model";

type UsePedalEditorArgs = {
    infoDialogOpen: boolean;
    inputDialogOpen: boolean;
    pianoVisible: boolean;
};

export function usePedalEditor({ infoDialogOpen, inputDialogOpen, pianoVisible }: UsePedalEditorArgs) {
    const helperPanelRef = useRef<HTMLElement | null>(null);
    const inputAreaSvgRef = useRef<SVGSVGElement | null>(null);
    const controlDragRef = useRef<ControlDragState | null>(null);
    const helperPanelDragRef = useRef<HelperPanelDragState | null>(null);
    const [inputHitPolygon, setInputHitPolygon] = useState(INPUT_HIT_POLYGON);
    const [inputHighlightPolygon, setInputHighlightPolygon] = useState(INPUT_HIGHLIGHT_POLYGON);
    const [controlLayout, setControlLayout] = useState(CONTROL_LAYOUT);
    const [inputAreaDragState, setInputAreaDragState] = useState<InputAreaDragState | null>(null);
    const [controlDragState, setControlDragState] = useState<ControlDragState | null>(null);
    const [inputAreaHelperVisible, setInputAreaHelperVisible] = useState(false);
    const [inputAreaHelperMode, setInputAreaHelperMode] = useState<InputAreaHelperMode>("highlight");
    const [helperPanelPosition, setHelperPanelPosition] = useState<HelperPanelPosition | null>(null);
    const [helperPanelDragging, setHelperPanelDragging] = useState(false);
    const [storedHelperStateReady, setStoredHelperStateReady] = useState(false);

    useEffect(() => {
        window.queueMicrotask(() => {
            try {
                const storedControlLayout = parseStoredControlLayout(window.localStorage.getItem(CONTROL_LAYOUT_STORAGE_KEY));
                const storedInputAreaPolygons = parseStoredInputAreaPolygons(
                    window.localStorage.getItem(INPUT_AREA_POLYGONS_STORAGE_KEY),
                );
                const storedHelperPanelPosition = parseStoredHelperPanelPosition(
                    window.localStorage.getItem(HELPER_PANEL_POSITION_STORAGE_KEY),
                );

                if (storedControlLayout) setControlLayout(storedControlLayout);
                if (storedInputAreaPolygons?.hit) setInputHitPolygon(storedInputAreaPolygons.hit);
                if (storedInputAreaPolygons?.highlight) setInputHighlightPolygon(storedInputAreaPolygons.highlight);
                if (storedHelperPanelPosition) setHelperPanelPosition(storedHelperPanelPosition);
            } catch {
                // Helper persistence is non-critical; the checked-in layout remains the fallback.
            } finally {
                setStoredHelperStateReady(true);
            }
        });
    }, []);

    useEffect(() => {
        if (!storedHelperStateReady) return;

        try {
            window.localStorage.setItem(CONTROL_LAYOUT_STORAGE_KEY, JSON.stringify(controlLayout));
        } catch {
            // Ignore private-mode or quota failures; the in-session layout still works.
        }
    }, [controlLayout, storedHelperStateReady]);

    useEffect(() => {
        if (!storedHelperStateReady) return;

        try {
            window.localStorage.setItem(
                INPUT_AREA_POLYGONS_STORAGE_KEY,
                JSON.stringify({
                    hit: inputHitPolygon,
                    highlight: inputHighlightPolygon,
                }),
            );
        } catch {
            // Ignore private-mode or quota failures; the in-session polygons still work.
        }
    }, [inputHitPolygon, inputHighlightPolygon, storedHelperStateReady]);

    useEffect(() => {
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
        const svg = inputAreaSvgRef.current;
        if (!svg) return null;

        const rect = svg.getBoundingClientRect();
        return {
            x: clampAreaValue(((clientX - rect.left) / rect.width) * 100),
            y: clampAreaValue(((clientY - rect.top) / rect.height) * 100),
        };
    };

    const getInputAreaPoint = (event: ReactPointerEvent<SVGSVGElement>) => getPedalPoint(event.clientX, event.clientY);

    const updateInputAreaPoint = (polygon: InputAreaPolygon, index: number, nextPoint: AreaPoint) => {
        const update = (points: AreaPoint[]) => points.map((point, pointIndex) => (pointIndex === index ? nextPoint : point));
        if (polygon === "hit") setInputHitPolygon(update);
        else setInputHighlightPolygon(update);
    };

    const setInputAreaPolygon = (polygon: InputAreaPolygon, points: AreaPoint[]) => {
        if (polygon === "hit") setInputHitPolygon(points);
        else setInputHighlightPolygon(points);
    };

    const setControlPosition = (id: ControlLayoutId, nextPoint: AreaPoint) => {
        setControlLayout((current) => ({
            ...current,
            [id]: nextPoint,
        }));
    };

    const handleInputAreaEditorPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
        if (!inputAreaDragState || inputAreaDragState.pointerId !== event.pointerId) return;

        const nextPoint = getInputAreaPoint(event);
        if (!nextPoint) return;

        event.preventDefault();
        updateInputAreaPoint(inputAreaDragState.polygon, inputAreaDragState.index, nextPoint);
    };

    const stopInputAreaEditorDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
        if (inputAreaDragState?.pointerId !== event.pointerId) return;
        setInputAreaDragState(null);
    };

    const startInputAreaPointDrag = (
        polygon: InputAreaPolygon,
        index: number,
        event: ReactPointerEvent<SVGCircleElement>,
    ) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        setInputAreaDragState({
            index,
            pointerId: event.pointerId,
            polygon,
        });
    };

    const handleInputAreaEditorDoubleClick = (event: ReactMouseEvent<SVGSVGElement>) => {
        if (
            !ENABLE_INPUT_AREA_HELPER ||
            !inputAreaHelperVisible ||
            inputAreaHelperMode === "controls" ||
            event.target instanceof SVGCircleElement
        ) {
            return;
        }

        const rect = event.currentTarget.getBoundingClientRect();
        const nextPoint = {
            x: clampAreaValue(((event.clientX - rect.left) / rect.width) * 100),
            y: clampAreaValue(((event.clientY - rect.top) / rect.height) * 100),
        };
        const points = inputAreaHelperMode === "hit" ? inputHitPolygon : inputHighlightPolygon;
        setInputAreaPolygon(inputAreaHelperMode, [...points, nextPoint]);
    };

    const resetInputAreaPolygon = (polygon: InputAreaPolygon) => {
        setInputAreaPolygon(polygon, polygon === "hit" ? INPUT_HIT_POLYGON : INPUT_HIGHLIGHT_POLYGON);
    };

    const copyInputAreaPolygons = () => {
        const text = [
            formatAreaConstant("INPUT_HIT_POLYGON", inputHitPolygon),
            formatAreaConstant("INPUT_HIGHLIGHT_POLYGON", inputHighlightPolygon),
        ].join("\n\n");

        void navigator.clipboard?.writeText(text);
    };

    const copyControlLayout = () => {
        void navigator.clipboard?.writeText(formatControlLayoutConstant(controlLayout));
    };

    const startControlDrag = (id: ControlLayoutId, event: ReactPointerEvent<HTMLElement>) => {
        if (!ENABLE_INPUT_AREA_HELPER || !inputAreaHelperVisible || inputAreaHelperMode !== "controls") return;
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
    const controlMoveModeActive = ENABLE_INPUT_AREA_HELPER && inputAreaHelperVisible && inputAreaHelperMode === "controls";
    const polygonHelperActive = ENABLE_INPUT_AREA_HELPER && inputAreaHelperVisible && inputAreaHelperMode !== "controls";
    const activeInputAreaHelperPolygon: InputAreaPolygon = inputAreaHelperMode === "hit" ? "hit" : "highlight";
    const activeInputAreaPolygon = activeInputAreaHelperPolygon === "hit" ? inputHitPolygon : inputHighlightPolygon;
    const inputAreaClipboardText = [
        formatAreaConstant("INPUT_HIT_POLYGON", inputHitPolygon),
        formatAreaConstant("INPUT_HIGHLIGHT_POLYGON", inputHighlightPolygon),
    ].join("\n\n");
    const controlLayoutClipboardText = formatControlLayoutConstant(controlLayout);
    const helperClipboardText = inputAreaHelperMode === "controls" ? controlLayoutClipboardText : inputAreaClipboardText;
    const removeLastInputAreaPoint = () => {
        const nextPoints = activeInputAreaPolygon.slice(0, -1);
        if (nextPoints.length >= 3) setInputAreaPolygon(activeInputAreaHelperPolygon, nextPoints);
    };

    return {
        activeInputAreaHelperPolygon,
        activeInputAreaPolygon,
        controlDragState,
        controlLayout,
        controlMoveModeActive,
        copyControlLayout,
        copyInputAreaPolygons,
        handleControlDragPointerMove,
        handleHelperPanelDragPointerMove,
        handleInputAreaEditorDoubleClick,
        handleInputAreaEditorPointerMove,
        helperClipboardText,
        helperPanelDragging,
        helperPanelRef,
        helperPanelStyle,
        inputAreaHelperMode,
        inputAreaHelperVisible,
        inputAreaSvgRef,
        inputHighlightPolygon,
        inputHitPolygon,
        polygonHelperActive,
        removeLastInputAreaPoint,
        resetControlLayout: () => setControlLayout(CONTROL_LAYOUT),
        resetInputAreaPolygon,
        setInputAreaHelperMode,
        startControlDrag,
        startHelperPanelDrag,
        startInputAreaPointDrag,
        stopControlDrag,
        stopHelperPanelDrag,
        stopInputAreaEditorDrag,
    };
}
