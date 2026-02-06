/* eslint-disable react-refresh/only-export-components */
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from "react";
import type { Element, ElementInput, SelectedElement } from "./elementTypes";

const API_BASE = import.meta.env.VITE_FILE_API_BASE ?? "http://localhost:8787";
const API_TOKEN = import.meta.env.VITE_FILE_API_TOKEN;

function authHeaders(): HeadersInit {
    return API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {};
}

interface ElementsContextType {
    elements: Element[];
    isLoading: boolean;
    error: string | null;
    isManagerOpen: boolean;
    isFormOpen: boolean;
    /** Currently selected elements for generation */
    selectedElements: SelectedElement[];
    /** Selection mode - when true, clicking adds element to selection */
    isSelectionMode: boolean;
    toggleManager: () => void;
    openForm: () => void;
    closeForm: () => void;
    fetchElements: () => Promise<void>;
    addElement: (input: ElementInput) => Promise<Element>;
    deleteElement: (id: string) => Promise<void>;
    selectElement: (element: Element) => void;
    deselectElement: (id: string) => void;
    clearSelection: () => void;
    setSelectionMode: (mode: boolean) => void;
}

const ElementsContext = createContext<ElementsContextType | null>(null);

export function ElementsProvider({ children }: { children: ReactNode }) {
    const [elements, setElements] = useState<Element[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isManagerOpen, setIsManagerOpen] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedElements, setSelectedElements] = useState<SelectedElement[]>([]);
    const [isSelectionMode, setIsSelectionMode] = useState(false);

    const toggleManager = useCallback(() => {
        setIsManagerOpen((prev) => {
            if (prev) {
                // Closing the manager - clean up form and selection mode
                setIsFormOpen(false);
                setIsSelectionMode(false);
            }
            return !prev;
        });
    }, []);

    const openForm = useCallback(() => setIsFormOpen(true), []);
    const closeForm = useCallback(() => setIsFormOpen(false), []);

    const fetchElements = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_BASE}/elements`, {
                headers: authHeaders(),
            });
            if (!res.ok) throw new Error("Failed to fetch elements");
            const data = await res.json();
            setElements(data.elements ?? []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
            setElements([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const addElement = useCallback(async (input: ElementInput): Promise<Element> => {
        const formData = new FormData();
        formData.append("name", input.name);
        formData.append("frontalImage", input.frontalImage);
        input.referenceImages.forEach((file, i) => {
            formData.append(`referenceImage_${i}`, file);
        });
        if (input.characterSheet) {
            formData.append("characterSheet", input.characterSheet);
        }

        const res = await fetch(`${API_BASE}/elements`, {
            method: "POST",
            headers: authHeaders(),
            body: formData,
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error ?? "Failed to create element");
        }
        const data = await res.json();
        const newElement = data.element as Element;
        setElements((prev) => [newElement, ...prev]);
        setIsFormOpen(false);
        return newElement;
    }, []);

    const deleteElement = useCallback(async (id: string) => {
        const res = await fetch(`${API_BASE}/elements/${id}`, {
            method: "DELETE",
            headers: authHeaders(),
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error ?? "Failed to delete element");
        }
        setElements((prev) => prev.filter((el) => el.id !== id));
        setSelectedElements((prev) => prev.filter((sel) => sel.element.id !== id));
    }, []);

    const selectElement = useCallback((element: Element) => {
        setSelectedElements((prev) => {
            const existing = prev.find((sel) => sel.element.id === element.id);
            if (existing) {
                return prev;
            }
            return [...prev, { element }];
        });
    }, []);

    const deselectElement = useCallback((id: string) => {
        setSelectedElements((prev) => prev.filter((sel) => sel.element.id !== id));
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedElements([]);
    }, []);

    // Fetch elements on mount
    useEffect(() => {
        fetchElements();
    }, [fetchElements]);

    const value: ElementsContextType = {
        elements,
        isLoading,
        error,
        isManagerOpen,
        isFormOpen,
        selectedElements,
        isSelectionMode,
        toggleManager,
        openForm,
        closeForm,
        fetchElements,
        addElement,
        deleteElement,
        selectElement,
        deselectElement,
        clearSelection,
        setSelectionMode: setIsSelectionMode,
    };

    return (
        <ElementsContext.Provider value={value}>
            {children}
        </ElementsContext.Provider>
    );
}

export function useElements(): ElementsContextType {
    const context = useContext(ElementsContext);
    if (!context) {
        throw new Error("useElements must be used within an ElementsProvider");
    }
    return context;
}
