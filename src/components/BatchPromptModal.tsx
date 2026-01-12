import { useState, useEffect } from "react";

type BatchPromptModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onStart: (prompts: string[]) => void;
};

export function BatchPromptModal({ isOpen, onClose, onStart }: BatchPromptModalProps) {
    const [input, setInput] = useState("");
    const [prompts, setPrompts] = useState<string[]>([]);

    // Parse prompts when input changes
    useEffect(() => {
        const parsed = input
            .split(/\n\s*\n/) // Split by blank lines
            .map((p) => p.trim())
            .filter((p) => p.length > 0);
        setPrompts(parsed);
    }, [input]);

    if (!isOpen) return null;

    const handleStart = () => {
        if (prompts.length === 0) return;
        onStart(prompts);
        setInput("");
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="relative w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                    <div>
                        <h2 className="text-lg font-bold text-white">Batch Prompt Input</h2>
                        <p className="text-xs text-slate-400">Paste multiple prompts separated by blank lines</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6 6 18" />
                            <path d="m6 6 12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden p-6">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={`Paste your prompts here, separated by blank lines.\n\nExample:\nA person standing in a park...\n\nA person sitting on a bench...`}
                        className="h-[300px] w-full resize-none rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                    />

                    {/* Prompt count */}
                    <div className="mt-3 flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${prompts.length > 0 ? "bg-sky-500/20 text-sky-300" : "bg-white/10 text-slate-400"}`}>
                            {prompts.length} {prompts.length === 1 ? "prompt" : "prompts"} detected
                        </span>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 border-t border-white/10 px-6 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleStart}
                        disabled={prompts.length === 0}
                        className="rounded-lg bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 px-6 py-2 text-sm font-bold text-white shadow-lg shadow-sky-500/30 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-sky-500/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                    >
                        Start Batch ({prompts.length})
                    </button>
                </div>
            </div>
        </div>
    );
}
