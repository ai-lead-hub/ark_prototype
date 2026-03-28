import { useEffect, useMemo, useState, useRef } from "react";
import {
  createWorkspace,
  getDefaultConnection,
  listFiles,
  listWorkspaces,
  type WorkspaceConnection,
} from "../lib/api/files";
import { useCatalog } from "../state/useCatalog";
import { Tooltip } from "./ui/Tooltip";
import { useElements } from "../state/elements";
import CreditTracker from "./CreditTracker";
import { useHoverPlayVideos } from "../lib/useHoverPlayVideos";
import { useRandomizeSeed } from "../lib/useRandomizeSeed";

const STORAGE_KEY = "file-api-connection";

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

export default function ProjectBar() {
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

  const connectionStatusIcon = connection ? "🟢" : "🔴";
  const connectionLabel = connection ? connection.workspaceId : "Not connected";

  return (
    <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/70 backdrop-blur-lg">
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
        {/* Left: Status */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs" title={connection ? "Connected" : "Disconnected"}>
            {connectionStatusIcon}
          </span>
          <span className="text-xs font-medium text-slate-300 truncate max-w-[200px]">
            {connectionLabel}
          </span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <CreditTracker />
          <ElementsButton />

          {/* Settings Button + Dropdown */}
          <div className="relative" ref={settingsRef}>
            <button
              type="button"
              onClick={() => setSettingsOpen(!settingsOpen)}
              className={`flex h-7 w-7 items-center justify-center rounded-full border text-sm transition ${settingsOpen
                ? "border-sky-400 bg-sky-500/20 text-sky-200"
                : "border-white/10 text-slate-400 hover:border-sky-400 hover:text-white"
                }`}
              title="Workspace Settings"
              aria-label="Toggle workspace settings"
            >
              ⚙️
            </button>

            {/* Settings Dropdown */}
            {settingsOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-white/10 bg-slate-900/95 shadow-2xl backdrop-blur-xl z-50 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 bg-white/5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">⚙️</span>
                    <h3 className="font-semibold text-sm text-white">Workspace Settings</h3>
                  </div>
                  <button
                    onClick={() => setSettingsOpen(false)}
                    className="text-slate-400 hover:text-white transition"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-4">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-400">
                      API Base URL
                    </label>
                    <input
                      type="url"
                      value={apiBase}
                      onChange={(event) => setApiBase(event.target.value)}
                      placeholder="http://localhost:8787"
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 transition-all"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-400">
                      Workspace ID
                    </label>
                    <input
                      type="text"
                      value={workspaceId}
                      onChange={(event) => setWorkspaceId(event.target.value)}
                      list="workspace-options"
                      placeholder="workspace id"
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 transition-all"
                    />
                    <datalist id="workspace-options">
                      {workspaces.map((ws) => (
                        <option key={ws} value={ws} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-400">
                      API Token
                    </label>
                    <input
                      type="password"
                      value={token}
                      onChange={(event) => setToken(event.target.value)}
                      placeholder="Optional"
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 transition-all"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleConnect}
                      disabled={busy}
                      className="flex-1 rounded-lg border border-sky-500/50 bg-sky-500/20 px-3 py-1.5 font-semibold text-xs text-sky-200 transition hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy ? "..." : connection ? "Reconnect" : "Connect"}
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateWorkspace}
                      disabled={busy}
                      className="rounded-lg border border-white/10 px-3 py-1.5 font-semibold text-xs text-slate-200 transition hover:border-sky-400 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      New
                    </button>
                    {connection && (
                      <Tooltip text="Disconnect clears the saved workspace link. Your files stay on the server.">
                        <button
                          type="button"
                          onClick={handleDisconnect}
                          className="rounded-lg border border-white/10 px-3 py-1.5 font-semibold text-xs text-slate-200 transition hover:border-amber-400 hover:text-amber-100"
                        >
                          Disconnect
                        </button>
                      </Tooltip>
                    )}
                  </div>

                  {status && (
                    <div className="rounded-md bg-black/30 px-3 py-2 text-xs text-slate-300">
                      {status}
                    </div>
                  )}

                  {/* Divider */}
                  <div className="border-t border-white/10 pt-3 mt-1">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Preferences
                    </div>
                    <div className="space-y-3">
                      <HoverPlayToggle />
                      <RandomizeSeedToggle />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <a
            href="https://github.com/ai-scape/freepikv5/tree/main"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-slate-400 transition hover:border-sky-400 hover:text-white"
            title="Help & Documentation"
          >
            <span className="text-xs font-bold">?</span>
          </a>
        </div>
      </div>

    </header>
  );
}

function ElementsButton() {
  const { elements, toggleManager, isManagerOpen, selectedElements } = useElements();
  const totalCount = elements.length;
  const selectedCount = selectedElements.length;

  return (
    <button
      onClick={toggleManager}
      className={`relative rounded-full border px-3 py-1 font-semibold text-xs transition ${isManagerOpen || selectedCount > 0
        ? "border-amber-500 text-amber-400 bg-amber-500/10"
        : "border-white/10 text-slate-400 hover:text-white"
        }`}
      title="Elements Store"
    >
      Elements Store ✨
      {totalCount > 0 && (
        <span className={`absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] text-white ${selectedCount > 0 ? "bg-amber-500" : "bg-slate-600"}`}>
          {selectedCount > 0 ? selectedCount : totalCount}
        </span>
      )}
    </button>
  );
}

function HoverPlayToggle() {
  const [hoverPlayVideos, setHoverPlayVideos] = useHoverPlayVideos();

  return (
    <label className="flex items-center justify-between cursor-pointer">
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-300">Hover play videos</span>
        <span className="text-[10px] text-slate-500">(can reduce CPU)</span>
      </div>
      <button
        type="button"
        onClick={() => setHoverPlayVideos(!hoverPlayVideos)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${hoverPlayVideos ? "bg-sky-500" : "bg-slate-600"
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
    <label className="flex items-center justify-between cursor-pointer">
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-300">Randomize seed</span>
        <span className="text-[10px] text-slate-500">(varies outputs)</span>
      </div>
      <button
        type="button"
        onClick={() => setRandomizeSeed(!randomizeSeed)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${randomizeSeed ? "bg-sky-500" : "bg-slate-600"
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

