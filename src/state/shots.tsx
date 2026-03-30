import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import demoData from "../data/sc03-demo.json";

/* ── Types ── */

export type AssetRole = "pinned" | "input" | "output";

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
  role: AssetRole;
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

export type Scene = {
  id: string;
  name: string;
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
  allScenes: Scene[];
  activeSceneId: string;
  setActiveScene: (id: string) => void;
};

const ShotsContext = createContext<ShotsContextValue | null>(null);

/* ── Demo: inject global pinned refs + per-shot input refs ── */

function augmentWithRoles(rawShots: typeof demoData.shots): Shot[] {
  // Pick 2 candidates from the first shot as global pins (appear in every shot)
  const globalPins: ShotCandidate[] = [];
  if (rawShots.length > 0 && rawShots[0].candidates.length >= 2) {
    globalPins.push(
      { ...rawShots[0].candidates[0], role: "pinned" as AssetRole, id: `pin-${rawShots[0].candidates[0].id}` },
      { ...rawShots[0].candidates[1], role: "pinned" as AssetRole, id: `pin-${rawShots[0].candidates[1].id}` },
    );
  }

  return rawShots.map((shot, shotIdx) => {
    const demoVideoPath = "/kitsu-previews/demo-video.mp4";
    const candidates: ShotCandidate[] = shot.candidates.map((c, cIdx) => {
      const makeVideo = shotIdx % 3 === 0 && cIdx >= 2 && cIdx % 4 === 2;
      return {
        ...c,
        role: "output" as AssetRole,
        isVideo: makeVideo,
        ...(makeVideo ? { previewPath: demoVideoPath, thumbnailPath: c.thumbnailPath, extension: "mp4", duration: 5 } : {}),
      };
    });

    // Mark first candidate of each shot (if it has 2+) as an input reference
    if (candidates.length >= 2) {
      candidates[0].role = "input";
    }

    // Prepend global pins to every shot
    return { ...shot, candidates: [...globalPins, ...candidates] } as Shot;
  });
}

/* ── Demo scenes ── */

const DEMO_SCENES: Scene[] = [
  { id: "sc01", name: "SC01" },
  { id: "sc02", name: "SC02" },
  { id: demoData.scene.id, name: demoData.scene.name },
  { id: "sc04", name: "SC04" },
  { id: "sc05", name: "SC05" },
];

/* ── Provider ── */

export function ShotsProvider({ children }: { children: ReactNode }) {
  const [activeSceneId, setActiveSceneId] = useState(demoData.scene.id);
  const shots = useMemo(() => {
    // Only the real scene (SC03) has demo data; others show empty
    if (activeSceneId === demoData.scene.id) {
      return augmentWithRoles(demoData.shots);
    }
    return [];
  }, [activeSceneId]);
  const assets = demoData.assets as KitsuAsset[];
  const [activeShotId, setActiveShotId] = useState<string | null>(
    shots[0]?.id ?? null
  );

  const activeScene = DEMO_SCENES.find((s) => s.id === activeSceneId) ?? DEMO_SCENES[0];

  const setActiveScene = useCallback((id: string) => {
    setActiveSceneId(id);
  }, []);

  // Auto-select first shot when scene changes
  useEffect(() => {
    setActiveShotId(shots[0]?.id ?? null);
  }, [shots]);

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
      sceneName: activeScene.name,
      shots,
      assets,
      activeShotId,
      setActiveShot,
      navigateShot,
      activeShot,
      inactiveShots,
      allScenes: DEMO_SCENES,
      activeSceneId,
      setActiveScene,
    }),
    [shots, assets, activeShotId, setActiveShot, navigateShot, activeShot, inactiveShots, activeScene, activeSceneId, setActiveScene]
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
