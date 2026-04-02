import { useEffect, useMemo, useState, useRef } from "react";
import {
  createWorkspace,
  getDefaultConnection,
  listFiles,
  listWorkspaces,
  type WorkspaceConnection,
} from "../lib/api/files";
import { useCatalog } from "../state/useCatalog";
import { useElements } from "../state/elements";
import CreditTracker from "./CreditTracker";
import { useHoverPlayVideos } from "../lib/useHoverPlayVideos";
import { useRandomizeSeed } from "../lib/useRandomizeSeed";

const STORAGE_KEY = "file-api-connection";

interface ProjectBarProps {
  mode?: "full" | "leading" | "utilities";
}

function loadSavedConnection(): WorkspaceConnection | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkspaceConnection;
    if (parsed.apiBase && parsed.workspaceId) {
      return parsed;
    }
  } catch {
    // Ignore malformed storage.
  }
  return null;
}

function persistConnection(connection: WorkspaceConnection | null) {
  if (typeof localStorage === "undefined") return;
  if (!connection) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(connection));
}

export default function ProjectBar({ mode = "full" }: ProjectBarProps) {
  const {
    state: { connection },
    actions: { setConnection },
  } = useCatalog();
  const defaultConnection = useMemo(() => getDefaultConnection(), []);
  const [apiBase, setApiBase] = useState(
    defaultConnection?.apiBase ?? "http://localhost:8787"
  );
  const [workspaceId, setWorkspaceId] = useState(
    defaultConnection?.workspaceId ?? "default"
  );
  const [token, setToken] = useState(defaultConnection?.token ?? "");
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = loadSavedConnection();
    if (saved) {
      setApiBase(saved.apiBase);
      setWorkspaceId(saved.workspaceId);
      setToken(saved.token ?? "");
      setConnection(saved);
      setStatus(`Restored workspace "${saved.workspaceId}".`);
      return;
    }
    if (defaultConnection) {
      setConnection(defaultConnection);
      setStatus(`Using default workspace "${defaultConnection.workspaceId}".`);
    }
  }, [defaultConnection, setConnection]);

  useEffect(() => {
    if (!apiBase) return;
    let cancelled = false;
    void (async () => {
      try {
        const list = await listWorkspaces(apiBase, token || undefined);
        if (!cancelled) {
          setWorkspaces(list);
        }
      } catch {
        if (!cancelled) {
          setWorkspaces([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBase, token]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!settingsOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [settingsOpen]);

  const handleConnect = async () => {
    const base = apiBase.trim().replace(/\/$/, "");
    const ws = workspaceId.trim() || "default";
    if (!base) {
      setStatus("Enter the file API base URL.");
      return;
    }
    const connectionAttempt: WorkspaceConnection = {
      apiBase: base,
      workspaceId: ws,
      token: token.trim() || undefined,
    };
    setBusy(true);
    try {
      await listFiles(connectionAttempt);
      setConnection(connectionAttempt);
      persistConnection(connectionAttempt);
      setStatus(`✅ Connected to workspace "${ws}".`);
    } catch (error) {
      setStatus(
        error instanceof Error
          ? `❌ ${error.message}`
          : "❌ Unable to connect to workspace."
      );
    } finally {
      setBusy(false);
    }
  };

  const handleCreateWorkspace = async () => {
    const base = apiBase.trim().replace(/\/$/, "");
    if (!base) {
      setStatus("Enter the file API base URL before creating a workspace.");
      return;
    }
    setBusy(true);
    try {
      const id = await createWorkspace(base, token.trim() || undefined, workspaceId.trim() || undefined);
      setWorkspaceId(id);
      setWorkspaces((previous) =>
        Array.from(new Set([id, ...previous]))
      );
      setStatus(`🆕 Workspace "${id}" created. Click Connect to use it.`);
    } catch (error) {
      setStatus(
        error instanceof Error
          ? `❌ ${error.message}`
          : "❌ Unable to create workspace."
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = () => {
    setConnection(undefined);
    persistConnection(null);
    setStatus("Disconnected from workspace.");
  };

  const connectionLabel = connection ? (connection.workspaceId === "default" ? "My Workspace" : connection.workspaceId) : "Not connected";
  const showLeading = mode === "full" || mode === "leading";
  const showUtilities = mode === "full" || mode === "utilities";

  return (
    <>
      {showLeading && (
        <>
          <ElementsButton />

          <a
            href="https://github.com/ai-scape/freepikv5/tree/main"
            target="_blank"
            rel="noopener noreferrer"
            className="kv-icon-button flex h-9 w-9 items-center justify-center rounded-full"
            aria-label="Open help and documentation"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.82 1c0 2-3 3-3 3" />
              <path d="M12 17h.01" />
            </svg>
          </a>
        </>
      )}

      {showUtilities && (
        <div className="flex items-center gap-2">
          <CreditTracker />

          <div className="relative" ref={settingsRef}>
            <button
              type="button"
              onClick={() => setSettingsOpen(!settingsOpen)}
              className={`kv-icon-button flex h-9 w-9 items-center justify-center rounded-full ${settingsOpen
                ? "border-amber-400/50 bg-amber-500/10 text-amber-200"
                : ""
                }`}
              aria-label="Toggle workspace settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Z" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
              </svg>
            </button>

            {settingsOpen && (
              <div className="kv-panel absolute right-0 top-full z-50 mt-3 w-80 overflow-hidden rounded-[24px]">
                <div className="flex items-center justify-between px-4 py-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10 text-amber-300">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Z" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="kv-display text-sm font-semibold text-white">Workspace Settings</h3>
                      <div className="kv-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
                        Connection
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSettingsOpen(false)}
                    className="kv-icon-button flex h-8 w-8 items-center justify-center rounded-full"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4 px-4 pb-4">
                  <div className="space-y-1.5">
                    <label className="kv-mono block text-[10px] uppercase tracking-[0.18em] text-slate-500">
                      API Base URL
                    </label>
                    <input
                      type="url"
                      value={apiBase}
                      onChange={(event) => setApiBase(event.target.value)}
                      placeholder="http://localhost:8787"
                      className="kv-input w-full rounded-2xl px-3 py-2.5 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="kv-mono block text-[10px] uppercase tracking-[0.18em] text-slate-500">
                      Workspace ID
                    </label>
                    <input
                      type="text"
                      value={workspaceId}
                      onChange={(event) => setWorkspaceId(event.target.value)}
                      list="workspace-options"
                      placeholder="workspace id"
                      className="kv-input w-full rounded-2xl px-3 py-2.5 text-xs"
                    />
                    <datalist id="workspace-options">
                      {workspaces.map((ws) => (
                        <option key={ws} value={ws} />
                      ))}
                    </datalist>
                  </div>

                  <div className="space-y-1.5">
                    <label className="kv-mono block text-[10px] uppercase tracking-[0.18em] text-slate-500">
                      API Token
                    </label>
                    <input
                      type="password"
                      value={token}
                      onChange={(event) => setToken(event.target.value)}
                      placeholder="Optional"
                      className="kv-input w-full rounded-2xl px-3 py-2.5 text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleConnect}
                      disabled={busy}
                      className="kv-cta flex-1 rounded-full px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy ? "..." : connection ? "Reconnect" : "Connect"}
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateWorkspace}
                      disabled={busy}
                      className="kv-icon-button rounded-full px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      New
                    </button>
                    {connection && (
                      <button
                        type="button"
                        onClick={handleDisconnect}
                        className="kv-icon-button rounded-full px-3 py-2 text-xs font-semibold text-amber-100"
                      >
                        Disconnect
                      </button>
                    )}
                  </div>

                  {status && (
                    <div className="kv-panel-soft rounded-2xl px-3 py-2 text-xs text-slate-300">
                      {status}
                    </div>
                  )}

                  <div className="kv-panel-soft space-y-3 rounded-[20px] px-3 py-3">
                    <div className="kv-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
                      Preferences
                    </div>
                    <HoverPlayToggle />
                    <RandomizeSeedToggle />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ElementsButton() {
  const { elements, toggleManager, isManagerOpen, selectedElements } = useElements();
  const totalCount = elements.length;
  const selectedCount = selectedElements.length;

  return (
    <button
      onClick={toggleManager}
      className={`kv-icon-button relative flex h-9 w-9 items-center justify-center rounded-full ${isManagerOpen || selectedCount > 0
        ? "border-amber-400/50 bg-amber-500/10 text-amber-200"
        : "text-slate-300"
        }`}
      aria-label="Open elements store"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
      </svg>
      {totalCount > 0 && (
        <span className={`absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] text-white ${selectedCount > 0 ? "bg-amber-500" : "bg-slate-600"}`}>
          {selectedCount > 0 ? selectedCount : totalCount}
        </span>
      )}
    </button>
  );
}

function HoverPlayToggle() {
  const [hoverPlayVideos, setHoverPlayVideos] = useHoverPlayVideos();

  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-200">Hover play videos</span>
        <span className="text-[10px] text-slate-500">(can reduce CPU)</span>
      </div>
      <button
        type="button"
        onClick={() => setHoverPlayVideos(!hoverPlayVideos)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${hoverPlayVideos ? "bg-amber-500" : "bg-slate-700"
          }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${hoverPlayVideos ? "translate-x-4" : "translate-x-1"
            }`}
        />
      </button>
    </label>
  );
}

function RandomizeSeedToggle() {
  const [randomizeSeed, setRandomizeSeed] = useRandomizeSeed();

  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-200">Randomize seed</span>
        <span className="text-[10px] text-slate-500">(varies outputs)</span>
      </div>
      <button
        type="button"
        onClick={() => setRandomizeSeed(!randomizeSeed)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${randomizeSeed ? "bg-amber-500" : "bg-slate-700"
          }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${randomizeSeed ? "translate-x-4" : "translate-x-1"
            }`}
        />
      </button>
    </label>
  );
}
