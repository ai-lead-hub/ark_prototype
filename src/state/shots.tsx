import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import demoData from "../data/sc03-demo.json";

/* ── Types ── */

export type ShotCandidate = {
  id: string;
  extension: string;
  isVideo: boolean;
  revision: number;
  width: number;
  height: number;
  duration: number;
  originalName: string;
  createdAt: string;
  taskTypeId: string;
  thumbnailPath: string;
  previewPath: string;
};

export type Shot = {
  id: string;
  name: string;
  description: string;
  directionNote: string;
  nbFrames: number;
  previewFileId: string | null;
  candidates: ShotCandidate[];
};

export type KitsuAsset = {
  id: string;
  name: string;
  type: string;
  description: string;
  previewFileId: string | null;
  thumbnailPath?: string;
};

type ShotsContextValue = {
  projectName: string;
  sceneName: string;
  shots: Shot[];
  assets: KitsuAsset[];
  activeShotId: string | null;
  setActiveShot: (id: string) => void;
  navigateShot: (dir: "prev" | "next") => void;
  activeShot: Shot | null;
  inactiveShots: Shot[];
};

const ShotsContext = createContext<ShotsContextValue | null>(null);

/* ── Provider ── */

export function ShotsProvider({ children }: { children: ReactNode }) {
  const shots = demoData.shots as Shot[];
  const assets = demoData.assets as KitsuAsset[];
  const [activeShotId, setActiveShotId] = useState<string | null>(
    shots[0]?.id ?? null
  );

  const setActiveShot = useCallback((id: string) => {
    setActiveShotId(id);
  }, []);

  const navigateShot = useCallback(
    (dir: "prev" | "next") => {
      const idx = shots.findIndex((s) => s.id === activeShotId);
      if (idx === -1) return;
      const next = dir === "next" ? idx + 1 : idx - 1;
      if (next >= 0 && next < shots.length) {
        setActiveShotId(shots[next].id);
      }
    },
    [activeShotId, shots]
  );

  const activeShot = useMemo(
    () => shots.find((s) => s.id === activeShotId) ?? null,
    [shots, activeShotId]
  );

  const inactiveShots = useMemo(
    () => shots.filter((s) => s.id !== activeShotId),
    [shots, activeShotId]
  );

  const value = useMemo<ShotsContextValue>(
    () => ({
      projectName: demoData.project.name,
      sceneName: demoData.scene.name,
      shots,
      assets,
      activeShotId,
      setActiveShot,
      navigateShot,
      activeShot,
      inactiveShots,
    }),
    [shots, assets, activeShotId, setActiveShot, navigateShot, activeShot, inactiveShots]
  );

  return (
    <ShotsContext.Provider value={value}>{children}</ShotsContext.Provider>
  );
}

export function useShots() {
  const ctx = useContext(ShotsContext);
  if (!ctx) throw new Error("useShots must be used within ShotsProvider");
  return ctx;
}
