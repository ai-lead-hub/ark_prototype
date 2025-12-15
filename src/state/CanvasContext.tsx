/* eslint-disable react-refresh/only-export-components */
import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import { nanoid } from "nanoid";

export interface CanvasElement {
    id: string;
    type: "image" | "video";
    url: string;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    aspectRatio: number;
}

export interface CanvasViewport {
    x: number;
    y: number;
    zoom: number;
}

interface CanvasState {
    elements: CanvasElement[];
    selectedId: string | null;
    viewport: CanvasViewport;
}

interface CanvasContextType {
    state: CanvasState;
    actions: {
        addElement: (element: Omit<CanvasElement, "id">) => string;
        updateElement: (id: string, updates: Partial<CanvasElement>) => void;
        removeElement: (id: string) => void;
        setSelected: (id: string | null) => void;
        setViewport: (viewport: Partial<CanvasViewport>) => void;
        clearCanvas: () => void;
    };
}

const CanvasContext = createContext<CanvasContextType | null>(null);

const DEFAULT_VIEWPORT: CanvasViewport = { x: 0, y: 0, zoom: 1 };

export function CanvasProvider({ children }: { children: ReactNode }) {
    const [elements, setElements] = useState<CanvasElement[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [viewport, setViewportState] = useState<CanvasViewport>(DEFAULT_VIEWPORT);

    const addElement = useCallback((element: Omit<CanvasElement, "id">) => {
        const id = nanoid();
        setElements((prev) => [...prev, { ...element, id }]);
        setSelectedId(id);
        return id;
    }, []);

    const updateElement = useCallback(
        (id: string, updates: Partial<CanvasElement>) => {
            setElements((prev) =>
                prev.map((el) => (el.id === id ? { ...el, ...updates } : el))
            );
        },
        []
    );

    const removeElement = useCallback((id: string) => {
        setElements((prev) => prev.filter((el) => el.id !== id));
        setSelectedId((prev) => (prev === id ? null : prev));
    }, []);

    const setSelected = useCallback((id: string | null) => {
        setSelectedId(id);
    }, []);

    const setViewport = useCallback((updates: Partial<CanvasViewport>) => {
        setViewportState((prev) => ({ ...prev, ...updates }));
    }, []);

    const clearCanvas = useCallback(() => {
        setElements([]);
        setSelectedId(null);
        setViewportState(DEFAULT_VIEWPORT);
    }, []);

    const state = useMemo(
        () => ({ elements, selectedId, viewport }),
        [elements, selectedId, viewport]
    );

    const actions = useMemo(
        () => ({
            addElement,
            updateElement,
            removeElement,
            setSelected,
            setViewport,
            clearCanvas,
        }),
        [addElement, updateElement, removeElement, setSelected, setViewport, clearCanvas]
    );

    const value = useMemo(() => ({ state, actions }), [state, actions]);

    return (
        <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>
    );
}

export function useCanvas(): CanvasContextType {
    const context = useContext(CanvasContext);
    if (!context) {
        throw new Error("useCanvas must be used within a CanvasProvider");
    }
    return context;
}
