import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ChangeEvent, FormEvent } from "react";
import {
  DEFAULT_MODEL_ID,
  MODEL_SPECS,
  buildModelInput,
  type ParamDefinition,
  type UnifiedPayload,
} from "../lib/models";
import {
  IMAGE_MODELS,
} from "../lib/image-models";
import {
  SPECIAL_MODELS,
  buildSpecialModelInput,
} from "../lib/special-models";
import { getModelPricingLabel } from "../lib/pricing";
import { uploadToFal } from "../lib/fal";
import { extensionFromMime } from "../lib/mime";
import { buildFilename } from "../lib/filename";
import { compressImage } from "../lib/image-utils";
import { useCatalog } from "../state/useCatalog";
import { Spinner } from "./ui/Spinner";
import { FILE_ENTRY_MIME } from "../lib/drag-constants";
import {
  callModelEndpoint,
  getProviderEnvVar,
  getProviderKey,
  type ModelProvider,
  type ProviderCallOptions,
} from "../lib/providers";
import { downloadBlob } from "../lib/providers/shared";
import {
  fetchFileBlob,
  uploadFile,
  type WorkspaceConnection,
} from "../lib/api/files";
import { getGenerationByOutput, recordGeneration, recordPrompt } from "../lib/api/meta";
import { useQueue } from "../state/queue";
import { expandPrompt, alterPrompt } from "../lib/llm";
import { buildDatedMediaPath } from "../lib/storage-paths";
import {
  consumeControlsActions,
  getControlsPrompt,
  onControlsStoreChange,
  type ControlsAction,
  type ControlsFileRef,
} from "../lib/controls-store";

import { type UploadSlot } from "./UpscaleControls";
import { UploadZone } from "./UploadZone";

type ReferenceUpload = {
  id: string;
  url?: string;
  preview: string;
  name: string;
  uploading: boolean;
  createdAt?: number;
  error?: string;
};

const UPLOAD_URL_TTL_MS = 30 * 60 * 1000;
const IMAGE_REFERENCE_UPLOADS_KEY = "controls_imageReferenceUploads_v1";
const VIDEO_START_FRAME_KEY = "controls_videoStartFrame_v1";
const VIDEO_END_FRAME_KEY = "controls_videoEndFrame_v1";

type PersistedReferenceUpload = {
  id: string;
  url: string;
  name: string;
  createdAt: number;
};

type PersistedUploadSlot = {
  url: string;
  name?: string;
  createdAt: number;
};

type UploadSlotState = UploadSlot & { createdAt?: number };



const DEFAULT_MODEL_KEY = MODEL_SPECS.length
  ? `video:${DEFAULT_MODEL_ID || MODEL_SPECS[0].id}`
  : IMAGE_MODELS.length
    ? `image:${IMAGE_MODELS[0].id}`
    : "";

export default function ControlsPane() {
  const {
    state: { connection },
    actions: { refreshTree },
  } = useCatalog();
  const { addJob } = useQueue();

  // Persistence helpers
  const getStored = <T,>(key: string, fallback: T): T => {
    try {
      const item = localStorage.getItem(`controls_${key}`);
      return item ? (JSON.parse(item) as T) : fallback;
    } catch {
      return fallback;
    }
  };

  const usePersistentState = <T,>(key: string, fallback: T) => {
    const [value, setValue] = useState<T>(() => getStored(key, fallback));
    useEffect(() => {
      localStorage.setItem(`controls_${key}`, JSON.stringify(value));
    }, [key, value]);
    return [value, setValue] as const;
  };
  const [modelKey, setModelKey] = usePersistentState(
    "modelKey",
    DEFAULT_MODEL_KEY
  );
  const [activeTab, setActiveTab] = usePersistentState<"image" | "video" | "special">(
    "activeTab",
    DEFAULT_MODEL_KEY.startsWith("image:") ? "image" : "video"
  );
  const [imagePrompt, setImagePrompt] = usePersistentState("imagePrompt", "");
  const [videoPrompt, setVideoPrompt] = usePersistentState("videoPrompt", "");
  const [specialPrompt, setSpecialPrompt] = usePersistentState("specialPrompt", "");
  const [promptMode, setPromptMode] = usePersistentState<"general" | "photoreal">("promptMode", "photoreal");

  const prompt = activeTab === "image" ? imagePrompt : activeTab === "video" ? videoPrompt : specialPrompt;
  const setPrompt = (val: string) => {
    if (activeTab === "image") setImagePrompt(val);
    else if (activeTab === "video") setVideoPrompt(val);
    else setSpecialPrompt(val);
  };
  const [alterInstruction, setAlterInstruction] = useState("");
  const [isAltering, setIsAltering] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);

  const loadPersistedImageReferenceUploads = (): ReferenceUpload[] => {
    if (typeof localStorage === "undefined") return [];
    try {
      const raw = localStorage.getItem(IMAGE_REFERENCE_UPLOADS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      const now = Date.now();
      return (parsed as PersistedReferenceUpload[])
        .filter(
          (entry) =>
            entry &&
            typeof entry.id === "string" &&
            typeof entry.url === "string" &&
            typeof entry.name === "string" &&
            typeof entry.createdAt === "number" &&
            now - entry.createdAt <= UPLOAD_URL_TTL_MS
        )
        .slice(0, 5)
        .map((entry) => ({
          id: entry.id,
          url: entry.url,
          preview: entry.url,
          name: entry.name,
          uploading: false,
          createdAt: entry.createdAt,
        }));
    } catch {
      return [];
    }
  };

  const loadPersistedUploadSlot = (storageKey: string): UploadSlotState => {
    if (typeof localStorage === "undefined") return { uploading: false };
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return { uploading: false };
      const parsed = JSON.parse(raw) as unknown;
      if (
        !parsed ||
        typeof parsed !== "object" ||
        typeof (parsed as PersistedUploadSlot).url !== "string" ||
        typeof (parsed as PersistedUploadSlot).createdAt !== "number"
      ) {
        return { uploading: false };
      }
      const slot = parsed as PersistedUploadSlot;
      if (Date.now() - slot.createdAt > UPLOAD_URL_TTL_MS) {
        return { uploading: false };
      }
      return {
        uploading: false,
        url: slot.url,
        preview: slot.url,
        name: slot.name,
        createdAt: slot.createdAt,
      };
    } catch {
      return { uploading: false };
    }
  };

  const [startFrame, setStartFrame] = useState<UploadSlotState>(() =>
    loadPersistedUploadSlot(VIDEO_START_FRAME_KEY)
  );

  const [endFrame, setEndFrame] = useState<UploadSlotState>(() =>
    loadPersistedUploadSlot(VIDEO_END_FRAME_KEY)
  );

  const [imageReferenceUploads, setImageReferenceUploads] = useState<ReferenceUpload[]>(
    () => loadPersistedImageReferenceUploads()
  );
  const [videoReferenceUploads, setVideoReferenceUploads] = useState<ReferenceUpload[]>([]);
  // Video input uploads for Special tab (V2V models)
  const [videoInputUploads, setVideoInputUploads] = useState<ReferenceUpload[]>([]);

  const [aspectRatio, setAspectRatio] = usePersistentState("aspectRatio", "16:9");
  const [imageResolution, setImageResolution] = useState("1K");
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);
  // const [busy, setBusy] = useState(false);
  const [isReferenceDragActive, setIsReferenceDragActive] = useState(false);


  const referenceInputRef = useRef<HTMLInputElement | null>(null);


  const previewRegistry = useRef(new Set<string>());
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);

  const [paramValues, setParamValues] = usePersistentState<
    Record<string, string | number | boolean | undefined>
  >("paramValues", {});

  const connectionRef = useRef(connection);
  useEffect(() => {
    connectionRef.current = connection;
  }, [connection]);

  const modelKind = activeTab;
  const referenceUploads = modelKind === "image" ? imageReferenceUploads : videoReferenceUploads;
  const setReferenceUploads = modelKind === "image" ? setImageReferenceUploads : setVideoReferenceUploads;

  const activeTabRef = useRef(activeTab);
  const modelKeyRef = useRef(modelKey);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);
  useEffect(() => {
    modelKeyRef.current = modelKey;
  }, [modelKey]);

  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    try {
      const now = Date.now();
      const persisted = imageReferenceUploads
        .filter(
          (entry) =>
            entry.url &&
            typeof entry.createdAt === "number" &&
            now - entry.createdAt <= UPLOAD_URL_TTL_MS
        )
        .slice(0, 5)
        .map(
          (entry): PersistedReferenceUpload => ({
            id: entry.id,
            url: entry.url as string,
            name: entry.name,
            createdAt: entry.createdAt as number,
          })
        );
      localStorage.setItem(IMAGE_REFERENCE_UPLOADS_KEY, JSON.stringify(persisted));
    } catch {
      // Ignore storage errors
    }
  }, [imageReferenceUploads]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setStartFrame((prev) => {
        if (
          prev.url &&
          typeof prev.createdAt === "number" &&
          Date.now() - prev.createdAt > UPLOAD_URL_TTL_MS
        ) {
          return { uploading: false };
        }
        return prev;
      });
      setEndFrame((prev) => {
        if (
          prev.url &&
          typeof prev.createdAt === "number" &&
          Date.now() - prev.createdAt > UPLOAD_URL_TTL_MS
        ) {
          return { uploading: false };
        }
        return prev;
      });
      setImageReferenceUploads((prev) => {
        const now = Date.now();
        const next = prev.filter(
          (entry) =>
            !(
              entry.url &&
              typeof entry.createdAt === "number" &&
              now - entry.createdAt > UPLOAD_URL_TTL_MS
            )
        );
        return next.length === prev.length ? prev : next;
      });
      setVideoReferenceUploads((prev) => {
        const now = Date.now();
        const next = prev.filter(
          (entry) =>
            !(
              entry.url &&
              typeof entry.createdAt === "number" &&
              now - entry.createdAt > UPLOAD_URL_TTL_MS
            )
        );
        return next.length === prev.length ? prev : next;
      });
    }, 30_000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    try {
      if (
        startFrame.url &&
        typeof startFrame.createdAt === "number" &&
        Date.now() - startFrame.createdAt <= UPLOAD_URL_TTL_MS
      ) {
        const payload: PersistedUploadSlot = {
          url: startFrame.url,
          name: startFrame.name,
          createdAt: startFrame.createdAt,
        };
        localStorage.setItem(VIDEO_START_FRAME_KEY, JSON.stringify(payload));
      } else {
        localStorage.removeItem(VIDEO_START_FRAME_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  }, [startFrame.url, startFrame.name, startFrame.createdAt]);

  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    try {
      if (
        endFrame.url &&
        typeof endFrame.createdAt === "number" &&
        Date.now() - endFrame.createdAt <= UPLOAD_URL_TTL_MS
      ) {
        const payload: PersistedUploadSlot = {
          url: endFrame.url,
          name: endFrame.name,
          createdAt: endFrame.createdAt,
        };
        localStorage.setItem(VIDEO_END_FRAME_KEY, JSON.stringify(payload));
      } else {
        localStorage.removeItem(VIDEO_END_FRAME_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  }, [endFrame.url, endFrame.name, endFrame.createdAt]);

  const selectedVideo = useMemo(() => {
    if (modelKind !== "video") return undefined;
    const id = modelKey.replace("video:", "");
    return MODEL_SPECS.find((spec) => spec.id === id);
  }, [modelKey, modelKind]);

  const selectedImage = useMemo(() => {
    if (modelKind !== "image") return undefined;
    const id = modelKey.replace("image:", "");
    return IMAGE_MODELS.find((spec) => spec.id === id);
  }, [modelKey, modelKind]);

  const selectedSpecial = useMemo(() => {
    if (modelKind !== "special") return undefined;
    const id = modelKey.replace("special:", "");
    return SPECIAL_MODELS.find((spec) => spec.id === id);
  }, [modelKey, modelKind]);



  const pricingLabel = useMemo(() => {
    if (selectedVideo) return getModelPricingLabel(selectedVideo.id);
    if (selectedImage) return getModelPricingLabel(selectedImage.id);
    if (selectedSpecial) return selectedSpecial.pricing;
    return undefined;
  }, [selectedVideo, selectedImage, selectedSpecial]);

  const supportsStartFrame = selectedVideo?.supports?.startFrame !== false;
  const supportsEndFrame = selectedVideo?.supports?.endFrame === true;
  const videoReferenceConfig = selectedVideo?.referenceImages;
  const referenceLimit =
    modelKind === "video"
      ? Math.min(videoReferenceConfig?.max ?? 0, 5)
      : Math.min(selectedImage?.maxRefs ?? 0, 5);

  const registerPreview = useCallback((url: string) => {
    if (url.startsWith("blob:")) {
      previewRegistry.current.add(url);
    }
    return url;
  }, []);

  const releasePreview = useCallback((url?: string) => {
    if (url && url.startsWith("blob:") && previewRegistry.current.has(url)) {
      URL.revokeObjectURL(url);
      previewRegistry.current.delete(url);
    }
  }, []);

  // Use a ref for releasePreview to avoid dependency issues in callbacks
  const releasePreviewRef = useRef(releasePreview);
  useEffect(() => {
    releasePreviewRef.current = releasePreview;
  }, [releasePreview]);

  useEffect(() => {
    const registry = previewRegistry.current;
    return () => {
      registry.forEach((url) => URL.revokeObjectURL(url));
      registry.clear();
    };
  }, []);

  useEffect(() => {
    let defaultAspect = "16:9";
    let defaultRes = "1K";

    if (modelKind === "image") {
      const ui = selectedImage?.ui;
      const aspectOptions =
        ui?.aspectRatios && ui.aspectRatios.length > 0
          ? ui.aspectRatios
          : [
            { value: "16:9", label: "16:9" },
            { value: "4:3", label: "4:3" },
            { value: "1:1", label: "1:1" },
            { value: "3:2", label: "3:2" },
            { value: "9:16", label: "9:16" },
          ];

      // Only override if current is invalid
      const isCurrentAspectValid = aspectOptions.some(opt => opt.value === aspectRatio);
      if (!isCurrentAspectValid) {
        setAspectRatio(defaultAspect);
      }

      const isCurrentResValid = ui?.resolutions?.some(opt => opt.value === imageResolution);
      // Always enforce default resolution when switching models, or if current is invalid
      const newDefault = ui?.defaultResolution ?? ui?.resolutions?.[0]?.value ?? defaultRes;
      if (ui?.resolutions?.length && (!isCurrentResValid || imageResolution !== newDefault)) {
        setImageResolution(newDefault);
      }

    } else if (modelKind === "video" && selectedVideo) {
      // Handle video defaults
      const aspectParam = selectedVideo.params.aspect_ratio ?? selectedVideo.params.aspectRatio;
      if (aspectParam?.values?.length) {
        // Prefer 16:9 or Auto if available
        const found = aspectParam.values.find(v => String(v) === "16:9" || String(v).toLowerCase() === "auto");
        defaultAspect = found ? String(found) : String(aspectParam.values[0]);
      }

      const resParam = selectedVideo.params.resolution;
      if (resParam?.default) {
        defaultRes = String(resParam.default);
      } else if (resParam?.values?.length) {
        // Prefer 720p or 768P as reasonable defaults if no explicit default
        const found = resParam.values.find(v => String(v).includes("720") || String(v).includes("768"));
        defaultRes = found ? String(found) : String(resParam.values[0]);
      } else {
        defaultRes = "720p";
      }

      // Only override if current is invalid
      const isCurrentAspectValid = aspectParam?.values?.some(v => String(v) === aspectRatio);
      if (aspectParam?.values?.length && !isCurrentAspectValid) {
        setAspectRatio(defaultAspect);
      }

      const isCurrentResValid = resParam?.values?.some(v => String(v) === imageResolution);
      if (resParam?.values?.length && !isCurrentResValid) {
        setImageResolution(defaultRes);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelKind, selectedImage, selectedVideo, modelKey]); // Removed aspectRatio/Resolution from deps to avoid loops



  const extractFilesFromDataTransfer = useCallback(
    async (dataTransfer: DataTransfer | null): Promise<File[]> => {
      if (!dataTransfer) return [];
      if (dataTransfer.files && dataTransfer.files.length > 0) {
        return Array.from(dataTransfer.files);
      }
      const payloadRaw = dataTransfer.getData(FILE_ENTRY_MIME);
      if (payloadRaw && connection) {
        try {
          const payload = JSON.parse(payloadRaw) as {
            workspaceId: string;
            path: string;
            name?: string;
            mime?: string;
          };
          if (payload.workspaceId !== connection.workspaceId) return [];
          const blob = await fetchFileBlob(connection, payload.path);
          const name =
            payload.name ??
            payload.path.split("/").filter(Boolean).pop() ??
            "file.bin";
          return [
            new File([blob], name, {
              type: blob.type || payload.mime || "application/octet-stream",
            }),
          ];
        } catch {
          return [];
        }
      }
      return [];
    },
    [connection]
  );

  const handleStartFrameSelect = useCallback(
    async (file: File | null) => {
      setStartFrame((previous) => {
        if (previous.preview) {
          releasePreview(previous.preview);
        }
        return { uploading: false };
      });
      if (!file) return;

      // Register preview immediately with original file for responsiveness
      const preview = registerPreview(URL.createObjectURL(file));
      setStartFrame({
        uploading: true,
        preview,
        name: file.name,
      });

      try {
        const compressed = await compressImage(file);
        const url = await uploadToFal(compressed);
        setStartFrame((prev) => ({
          ...prev,
          uploading: false,
          url,
          preview: url,
          createdAt: Date.now(),
          error: null,
        }));
        setTimeout(() => {
          releasePreviewRef.current(preview);
        }, 0);
      } catch (error) {
        setStartFrame((prev) => ({
          ...prev,
          uploading: false,
          error: error instanceof Error ? error.message : "Upload failed.",
        }));
      }
    },
    [registerPreview, releasePreview]
  );

  const handleEndFrameSelect = useCallback(
    async (file: File | null) => {
      setEndFrame((previous) => {
        if (previous.preview) {
          releasePreview(previous.preview);
        }
        return { uploading: false };
      });
      if (!file) return;

      const preview = registerPreview(URL.createObjectURL(file));
      setEndFrame({
        uploading: true,
        preview,
        name: file.name,
      });

      try {
        const compressed = await compressImage(file);
        const url = await uploadToFal(compressed);
        setEndFrame((prev) => ({
          ...prev,
          uploading: false,
          url,
          preview: url,
          createdAt: Date.now(),
          error: null,
        }));
        setTimeout(() => {
          releasePreviewRef.current(preview);
        }, 0);
      } catch (error) {
        setEndFrame((prev) => ({
          ...prev,
          uploading: false,
          error: error instanceof Error ? error.message : "Upload failed.",
        }));
      }
    },
    [registerPreview, releasePreview]
  );

  // Note: The order of reference images is preserved and significant for some models (e.g. Flux).
  const handleReferenceFiles = useCallback(
    async (files: FileList | null) => {
      if (!files) return;
      const newFiles = Array.from(files).filter((f) =>
        f.type.startsWith("image/")
      );

      if (newFiles.length === 0) return;

      // Enforce max 5 references
      const availableSlots = 5 - referenceUploads.length;
      if (availableSlots <= 0) {
        setStatus("Maximum 5 reference images allowed.");
        setTimeout(() => setStatus(null), 3000);
        return;
      }

      const filesToUpload = newFiles.slice(0, availableSlots);
      if (newFiles.length > availableSlots) {
        setStatus(`Only adding ${availableSlots} images (max 5).`);
        setTimeout(() => setStatus(null), 3000);
      }

      const newEntries = filesToUpload.map((file) => ({
        id: Math.random().toString(36).slice(2),
        preview: URL.createObjectURL(file),
        name: file.name,
        uploading: true,
      }));

      // Register previews
      newEntries.forEach((entry) => registerPreview(entry.preview));

      setReferenceUploads((prev) => [...prev, ...newEntries]);

      // Upload each file
      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        const entry = newEntries[i];
        try {
          const compressed = await compressImage(file);
          const url = await uploadToFal(compressed);
          setReferenceUploads((prev) =>
            prev.map((item) =>
              item.id === entry.id
                ? {
                  ...item,
                  uploading: false,
                  url,
                  preview: url,
                  createdAt: Date.now(),
                  error: undefined,
                }
                : item
            )
          );
          setTimeout(() => {
            releasePreviewRef.current(entry.preview);
          }, 0);
        } catch (error) {
          console.error("Ref upload error:", error);
          setReferenceUploads((prev) =>
            prev.map((item) =>
              item.id === entry.id
                ? {
                  ...item,
                  uploading: false,
                  error: "Upload failed",
                }
                : item
            )
          );
        }
      }
    },
    [referenceUploads.length, registerPreview, setReferenceUploads, setStatus]
  );

  const removeReference = useCallback(
    (id: string) => {
      setReferenceUploads((prev) => {
        const target = prev.find((entry) => entry.id === id);
        if (target) {
          releasePreviewRef.current(target.preview);
        }
        return prev.filter((entry) => entry.id !== id);
      });
    },
    [setReferenceUploads]
  );

  const handleStartFrameSelectRef = useRef(handleStartFrameSelect);
  const handleEndFrameSelectRef = useRef(handleEndFrameSelect);
  const handleReferenceFilesRef = useRef(handleReferenceFiles);

  useEffect(() => {
    handleStartFrameSelectRef.current = handleStartFrameSelect;
  }, [handleStartFrameSelect]);

  useEffect(() => {
    handleEndFrameSelectRef.current = handleEndFrameSelect;
  }, [handleEndFrameSelect]);

  useEffect(() => {
    handleReferenceFilesRef.current = handleReferenceFiles;
  }, [handleReferenceFiles]);

  const waitFor = useCallback(async (predicate: () => boolean, timeoutMs = 2000) => {
    const startedAt = Date.now();
    while (!predicate()) {
      if (Date.now() - startedAt > timeoutMs) {
        throw new Error("Timed out waiting for UI to update.");
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }, []);

  const fetchWorkspaceFile = useCallback(async (fileRef: ControlsFileRef): Promise<File> => {
    const conn = connectionRef.current;
    if (!conn) {
      throw new Error("Connect a workspace first.");
    }
    if (fileRef.workspaceId !== conn.workspaceId) {
      throw new Error("That file is from a different workspace.");
    }
    const blob = await fetchFileBlob(conn, fileRef.relPath);
    return new File([blob], fileRef.name, {
      type: blob.type || fileRef.mime || "application/octet-stream",
    });
  }, []);

  const controlsActionQueueRef = useRef<ControlsAction[]>([]);
  const processingControlsActionsRef = useRef(false);

  const processControlsAction = useCallback(
    async (action: ControlsAction) => {
      try {
        if (action.type === "useStartFrame") {
          if (!action.file.mime.startsWith("image/")) {
            setStatus("Start frame must be an image.");
            setTimeout(() => setStatus(null), 3000);
            return;
          }
          if (!MODEL_SPECS.length) {
            setStatus("No video models available.");
            setTimeout(() => setStatus(null), 3000);
            return;
          }
          setModelKey((prev) =>
            prev.startsWith("video:") ? prev : `video:${MODEL_SPECS[0].id}`
          );
          setActiveTab("video");
          const file = await fetchWorkspaceFile(action.file);
          await handleStartFrameSelectRef.current(file);
          return;
        }

        if (action.type === "useEndFrame") {
          if (!action.file.mime.startsWith("image/")) {
            setStatus("End frame must be an image.");
            setTimeout(() => setStatus(null), 3000);
            return;
          }
          if (!MODEL_SPECS.length) {
            setStatus("No video models available.");
            setTimeout(() => setStatus(null), 3000);
            return;
          }
          setModelKey((prev) =>
            prev.startsWith("video:") ? prev : `video:${MODEL_SPECS[0].id}`
          );
          setActiveTab("video");
          const file = await fetchWorkspaceFile(action.file);
          await handleEndFrameSelectRef.current(file);
          return;
        }

        if (action.type === "addReferenceImage") {
          if (!action.file.mime.startsWith("image/")) {
            setStatus("References must be images.");
            setTimeout(() => setStatus(null), 3000);
            return;
          }
          if (!IMAGE_MODELS.length) {
            setStatus("No image models available.");
            setTimeout(() => setStatus(null), 3000);
            return;
          }

          setModelKey((prev) =>
            prev.startsWith("image:") ? prev : `image:${IMAGE_MODELS[0].id}`
          );
          setActiveTab("image");

          await waitFor(
            () =>
              activeTabRef.current === "image" &&
              modelKeyRef.current.startsWith("image:"),
            2000
          );

          const file = await fetchWorkspaceFile(action.file);
          const dt = new DataTransfer();
          dt.items.add(file);
          await handleReferenceFilesRef.current(dt.files);
          return;
        }

        if (action.type === "recreateFromOutput") {
          const conn = connectionRef.current;
          if (!conn) {
            setStatus("Connect a workspace first.");
            setTimeout(() => setStatus(null), 3000);
            return;
          }
          if (action.workspaceId !== conn.workspaceId) {
            setStatus("That file is from a different workspace.");
            setTimeout(() => setStatus(null), 3000);
            return;
          }

          const meta = await getGenerationByOutput(conn, action.relPath, {
            workspaceId: action.workspaceId,
          });
          if (!meta) {
            setStatus("No generation metadata found for that file.");
            setTimeout(() => setStatus(null), 3500);
            return;
          }

          const category = meta.category;
          if (category === "upscale") {
            setStatus("This file was created by Upscale. Use the Upscale controls in the preview pane.");
            setTimeout(() => setStatus(null), 4500);
            return;
          }

          const modelId = meta.model_id;
          const promptValue = meta.prompt ?? "";
          if (!modelId) {
            setStatus("Generation metadata is missing the model id.");
            setTimeout(() => setStatus(null), 3500);
            if (promptValue.trim()) setPrompt(promptValue);
            return;
          }

          if (category === "video") {
            if (!MODEL_SPECS.some((spec) => spec.id === modelId)) {
              setStatus(`Video model not found: ${modelId}`);
              setTimeout(() => setStatus(null), 3500);
              if (promptValue.trim()) setPrompt(promptValue);
              return;
            } else {
              setModelKey(`video:${modelId}`);
              setActiveTab("video");
            }
          } else {
            if (!IMAGE_MODELS.some((spec) => spec.id === modelId)) {
              setStatus(`Image model not found: ${modelId}`);
              setTimeout(() => setStatus(null), 3500);
              if (promptValue.trim()) setPrompt(promptValue);
              return;
            } else {
              setModelKey(`image:${modelId}`);
              setActiveTab("image");
            }
          }

          if (promptValue.trim()) {
            setPrompt(promptValue);
          }

          setStatus("Loaded settings. Review and click Generate.");
          setTimeout(() => setStatus(null), 3000);
        }
      } catch (error) {
        console.error("Controls action failed:", error);
        setStatus(error instanceof Error ? error.message : "Action failed");
        setTimeout(() => setStatus(null), 4000);
      }
    },
    [fetchWorkspaceFile, setActiveTab, setModelKey, setPrompt, setStatus, waitFor]
  );

  const processControlsActions = useCallback(async () => {
    if (processingControlsActionsRef.current) return;
    processingControlsActionsRef.current = true;
    try {
      while (controlsActionQueueRef.current.length > 0) {
        const next = controlsActionQueueRef.current.shift();
        if (!next) continue;
        // Process sequentially so uploads don't overlap.
        await processControlsAction(next);
      }
    } finally {
      processingControlsActionsRef.current = false;
    }
  }, [processControlsAction]);

  const queueControlsActions = useCallback(
    (actions: ControlsAction[]) => {
      if (!actions.length) return;
      controlsActionQueueRef.current.push(...actions);
      void processControlsActions();
    },
    [processControlsActions]
  );

  const imageReferenceUrls =
    modelKind === "image" && (selectedImage?.maxRefs ?? 0) !== 0
      ? imageReferenceUploads
        .filter(
          (entry) =>
            Boolean(entry.url) &&
            typeof entry.createdAt === "number" &&
            Date.now() - entry.createdAt <= UPLOAD_URL_TTL_MS
        )
        .map((entry) => entry.url as string)
        .slice(0, Math.min(selectedImage?.maxRefs ?? 5, 5))
      : [];

  const videoReferenceUrls =
    modelKind === "video" && referenceLimit > 0
      ? videoReferenceUploads
        .filter(
          (entry) =>
            Boolean(entry.url) &&
            typeof entry.createdAt === "number" &&
            Date.now() - entry.createdAt <= UPLOAD_URL_TTL_MS
        )
        .map((entry) => entry.url as string)
        .slice(0, referenceLimit)
      : [];


  const imageRequiresReference =
    modelKind === "image" && selectedImage?.requireReference === true;
  const isMissingImageReference =
    imageRequiresReference && imageReferenceUrls.length === 0;








  const handleReferenceDrop = useCallback(
    async (dataTransfer: DataTransfer | null) => {
      const files = await extractFilesFromDataTransfer(dataTransfer);
      if (files.length) {
        const dt = new DataTransfer();
        files.forEach(f => dt.items.add(f));
        await handleReferenceFiles(dt.files);
      }
    },
    [extractFilesFromDataTransfer, handleReferenceFiles]
  );

  const pendingUploads =
    modelKind === "video"
      ? startFrame.uploading ||
      endFrame.uploading ||
      videoReferenceUploads.some((entry) => entry.uploading)
      : imageReferenceUploads.some((entry) => entry.uploading);

  useEffect(() => {
    if (!selectedVideo) {
      setParamValues({});
      return;
    }
    const defaults: Record<string, string | number | boolean | undefined> = {};
    const entries = Object.entries(selectedVideo.params) as Array<
      [string, ParamDefinition | undefined]
    >;
    entries.forEach(([key, definition]) => {
      if (!definition) return;
      const uiKey =
        definition.uiKey ?? (key as keyof UnifiedPayload);
      if (uiKey === "start_frame_url" || uiKey === "end_frame_url") {
        return;
      }
      if (definition.default !== undefined) {
        defaults[uiKey] = definition.default as
          | string
          | number
          | boolean
          | undefined;
      } else if (definition.type === "enum" && definition.values?.length) {
        // For enums without explicit default, use first value
        defaults[uiKey] = definition.values[0];
      } else {
        defaults[uiKey] =
          definition.type === "boolean" ? false : undefined;
      }
    });
    // Merge defaults with persisted values
    // We only want to apply defaults for keys that are missing in paramValues
    // AND ensure that if a value exists, it is valid for the current definition (for enums)
    setParamValues((prev) => {
      const next = { ...prev };
      entries.forEach(([key, definition]) => {
        if (!definition) return;
        const uiKey = definition.uiKey ?? (key as keyof UnifiedPayload);

        // If undefined, use default
        if (next[uiKey] === undefined) {
          if (defaults[uiKey] !== undefined) {
            next[uiKey] = defaults[uiKey];
          }
        }
        // If defined, check if it's valid for enum
        else if (definition.type === "enum" && definition.values) {
          const currentVal = next[uiKey];
          // Loose comparison to handle number vs string "5" vs 5
          const isValid = definition.values.some(v => String(v) === String(currentVal));
          if (!isValid && defaults[uiKey] !== undefined) {
            next[uiKey] = defaults[uiKey];
          }
        }
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVideo]);

  const handleParamChange = (
    key: string,
    value: string | number | boolean | undefined
  ) => {
    setParamValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const renderParamControl = (
    key: string,
    definition?: ParamDefinition
  ) => {
    if (!selectedVideo || !definition || definition.hidden) return null;
    const uiKey =
      definition.uiKey ??
      (key as keyof UnifiedPayload);
    // Skip rendering these - they have dedicated UI sections
    if (uiKey === "start_frame_url" || uiKey === "end_frame_url" || uiKey === "prompt" || uiKey === "aspect_ratio" || uiKey === "resolution" || uiKey === "duration") {
      return null;
    }
    const value = paramValues[uiKey];
    if (definition.type === "enum" && definition.values) {
      return (
        <div
          key={key}
          className="space-y-1"
        >
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {key.replace(/_/g, " ")}
          </label>
          <select
            value={value === undefined ? "" : String(value)}
            onChange={(event) =>
              handleParamChange(
                uiKey as string,
                event.target.value === ""
                  ? undefined
                  : definition.values?.[0] &&
                    typeof definition.values[0] === "number"
                    ? Number(event.target.value)
                    : event.target.value
              )
            }
            disabled={isSubmitting || isExpanding}
            className={`w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 ${isSubmitting || isExpanding ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {!definition.required && (
              <option value="">
                Default
              </option>
            )}
            {definition.values.map((option: string | number) => (
              <option key={String(option)} value={String(option)}>
                {String(option)}
              </option>
            ))}
          </select>
        </div>
      );
    }
    if (definition.type === "boolean") {
      return (
        <label
          key={key}
          className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300"
        >
          <span>{key.replace(/_/g, " ")}</span>
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) =>
              handleParamChange(uiKey as string, event.target.checked)
            }
            disabled={isSubmitting || isExpanding}
          />
        </label>
      );
    }
    const isNumber = definition.type === "number";
    return (
      <div
        key={key}
        className="space-y-1"
      >
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {key.replace(/_/g, " ")}
        </label>
        <input
          type={isNumber ? "number" : "text"}
          value={
            value === undefined ? "" : isNumber ? Number(value) : String(value)
          }
          onChange={(event) =>
            handleParamChange(
              uiKey as string,
              event.target.value === ""
                ? undefined
                : isNumber
                  ? Number(event.target.value)
                  : event.target.value
            )
          }
          disabled={isSubmitting || isExpanding}
          className={`w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 ${isSubmitting || isExpanding ? "opacity-50 cursor-not-allowed" : ""}`}
        />
      </div>
    );
  };

  const addToHistory = useCallback(
    (newPrompt: string) => {
      const currentHistory = historyRef.current;
      const currentIndex = historyIndexRef.current;

      if (currentHistory[currentIndex] === newPrompt) return;

      const nextHistory = currentHistory.slice(0, currentIndex + 1);
      nextHistory.push(newPrompt);
      if (nextHistory.length > 50) nextHistory.shift();

      const nextIndex = nextHistory.length - 1;
      historyRef.current = nextHistory;
      historyIndexRef.current = nextIndex;

      setHistory(nextHistory);
      setHistoryIndex(nextIndex);

      if (connection && newPrompt.trim()) {
        const modelId = modelKey.replace(/^(image:|video:|special:|upscale:)/, "");
        void recordPrompt(connection, {
          workspaceId: connection.workspaceId,
          tab: modelKind === "special" ? "video" : modelKind,
          modelId,
          prompt: newPrompt.trim(),
        }).catch(() => {
          // best-effort
        });
      }
    },
    [connection, modelKey, modelKind]
  );

  useEffect(() => {
    const syncPrompt = () => {
      const next = getControlsPrompt();
      const actions = consumeControlsActions();
      if (actions.length) {
        queueControlsActions(actions);
      }

      if (typeof next !== "string") return;
      if (next === prompt) return;
      setPrompt(next);
      addToHistory(next);
    };

    const off = onControlsStoreChange(syncPrompt);
    return off;
  }, [addToHistory, prompt, queueControlsActions, setPrompt]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setPrompt(history[newIndex]);
    }
  }, [historyIndex, history, setPrompt]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setPrompt(history[newIndex]);
    }
  }, [historyIndex, history, setPrompt]);

  // Initialize history
  useEffect(() => {
    if (history.length === 0 && prompt) {
      setHistory([prompt]);
      setHistoryIndex(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync activeTab with modelKey to ensure consistency
  useEffect(() => {
    if (modelKey.startsWith("video:") && activeTab !== "video") {
      setActiveTab("video");
    } else if (modelKey.startsWith("image:") && activeTab !== "image") {
      setActiveTab("image");
    }
  }, [modelKey, activeTab, setActiveTab]);

  const handleExpandPrompt = async (type: "natural" | "yaml") => {
    if (!prompt.trim()) {
      setStatus("Please enter a prompt first.");
      setTimeout(() => setStatus(null), 3000);
      return;
    }

    setIsExpanding(true);
    try {
      const mode = modelKind === "video" ? "video" : "image";

      // Helper to process any image reference (upload or slot)
      const processRef = async (ref: { preview?: string; url?: string }) => {
        try {
          if (ref.preview) {
            const response = await fetch(ref.preview);
            const blob = await response.blob();
            if (blob.size < 4 * 1024 * 1024) {
              return await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
            } else {
              // Image too large for base64, check if we have a valid public URL
              if (!ref.url || ref.url.includes("localhost") || ref.url.includes("127.0.0.1")) {
                throw new Error("Image too large for VLM (max 4MB) and no public URL available.");
              }
            }
          }
          return ref.url;
        } catch (e) {
          console.error("Failed to process reference image:", e);
          return ref.url;
        }
      };

      const validReferenceUrls: string[] = [];

      // Process standard reference uploads
      for (const ref of referenceUploads) {
        if (
          ref.url &&
          typeof ref.createdAt === "number" &&
          Date.now() - ref.createdAt > UPLOAD_URL_TTL_MS
        ) {
          continue;
        }
        const result = await processRef(ref);
        if (result) validReferenceUrls.push(result);
      }

      // If in video mode, also check start/end frames
      if (mode === "video") {
        if (
          (startFrame.preview || startFrame.url) &&
          !(
            startFrame.url &&
            typeof startFrame.createdAt === "number" &&
            Date.now() - startFrame.createdAt > UPLOAD_URL_TTL_MS
          )
        ) {
          const result = await processRef(startFrame);
          if (result) validReferenceUrls.push(result);
        }
        if (
          (endFrame.preview || endFrame.url) &&
          !(
            endFrame.url &&
            typeof endFrame.createdAt === "number" &&
            Date.now() - endFrame.createdAt > UPLOAD_URL_TTL_MS
          )
        ) {
          const result = await processRef(endFrame);
          if (result) validReferenceUrls.push(result);
        }
      }

      // Save current state before expansion
      addToHistory(prompt);

      const expanded = await expandPrompt(prompt, type, mode, validReferenceUrls, promptMode);
      setPrompt(expanded);

      // Save new state after expansion
      addToHistory(expanded);
    } catch (error) {
      console.error("Expand prompt failed:", error);
      setStatus(`Failed to expand prompt: ${error instanceof Error ? error.message : String(error)}`);
      setTimeout(() => setStatus(null), 5000);
    } finally {
      if (isMounted.current) {
        setIsExpanding(false);
      }
    }
  };

  const handleAlter = async () => {
    if (!prompt.trim() || !alterInstruction.trim() || isAltering || isSubmitting) return;

    try {
      setIsAltering(true);
      const mode = activeTab === "image" ? "image" : "video";

      // Save current state before alteration
      addToHistory(prompt);

      const altered = await alterPrompt(prompt, alterInstruction, mode, promptMode);
      setPrompt(altered);
      setAlterInstruction("");

      // Save new state after alteration
      addToHistory(altered);
    } catch (error) {
      console.error("Alter prompt failed:", error);
      setStatus(`Failed to alter prompt: ${error instanceof Error ? error.message : String(error)}`);
      setTimeout(() => setStatus(null), 5000);
    } finally {
      if (isMounted.current) {
        setIsAltering(false);
      }
    }
  };

  const handleGenerate = async (event: FormEvent) => {
    event.preventDefault();

    if (!connection) {
      setStatus("Please connect to a workspace first.");
      setTimeout(() => setStatus(null), 3000);
      return;
    }

    setIsSubmitting(true);

    // Artificial delay for UX
    await new Promise((resolve) => setTimeout(resolve, 600));

    if (!isMounted.current) return;

    try {
      const modelId = modelKey.replace(/^(image:|video:|special:|upscale:)/, "");
      const modelSpec = MODEL_SPECS.find((m) => m.id === modelId);
      const imageModelSpec = IMAGE_MODELS.find((m) => m.id === modelId);


      let endpoint = "";
      let category: "image" | "video" = "image";
      let provider: ModelProvider = "fal";

      let payload: Record<string, unknown> | undefined;

      let callOptions: ProviderCallOptions | undefined;

      if (modelSpec) {
        endpoint = modelSpec.endpoint;
        category = "video";
        provider = modelSpec.provider ?? "fal";
        callOptions = modelSpec.taskConfig ? { taskConfig: modelSpec.taskConfig } : undefined;
        const startFrameUrl =
          startFrame.url &&
            supportsStartFrame !== false &&
            !(
              typeof startFrame.createdAt === "number" &&
              Date.now() - startFrame.createdAt > UPLOAD_URL_TTL_MS
            )
            ? startFrame.url
            : undefined;
        const endFrameUrl =
          endFrame.url &&
            supportsEndFrame === true &&
            !(
              typeof endFrame.createdAt === "number" &&
              Date.now() - endFrame.createdAt > UPLOAD_URL_TTL_MS
            )
            ? endFrame.url
            : undefined;

        const unifiedPayload: UnifiedPayload = {
          modelId,
          prompt,
          aspect_ratio: aspectRatio,
          resolution: imageResolution,
          start_frame_url: startFrameUrl,
          end_frame_url: endFrameUrl,
          reference_image_urls: videoReferenceUrls,
          seed: 1569,
          duration: paramValues.duration as string | number | undefined,
          generate_audio: paramValues.generate_audio as boolean | undefined,
        };

        payload = buildModelInput(modelSpec, unifiedPayload);

        // Use dynamic endpoint from adapter if available (e.g., LTX-2 T2V/I2V switching)
        if (modelSpec.adapter?.getEndpoint) {
          endpoint = modelSpec.adapter.getEndpoint(unifiedPayload);
        }
      } else if (imageModelSpec) {
        endpoint = imageModelSpec.endpoint;
        category = "image";
        provider = imageModelSpec.provider ?? "fal";
        callOptions = imageModelSpec.taskConfig ? { taskConfig: imageModelSpec.taskConfig } : undefined;

        const maxImagesConfig = imageModelSpec.ui?.maxImages;
        const parsedMaxImages = maxImagesConfig
          ? maxImagesConfig.default ?? maxImagesConfig.min ?? 1
          : undefined;

        const imageJob = {
          prompt: prompt.trim(),
          imageUrls: imageReferenceUrls,
          aspectRatio,
          seed: 1569,
          imageResolution: imageModelSpec.ui?.resolutions ? imageResolution : undefined,
          maxImages: parsedMaxImages,
          numImages: parsedMaxImages,
        };

        payload = imageModelSpec.mapInput(imageJob);

      } else if (selectedSpecial) {
        // Handle special models (e.g., V2V)
        endpoint = selectedSpecial.endpoint;
        category = "video"; // V2V outputs video
        provider = selectedSpecial.provider as ModelProvider;
        callOptions = selectedSpecial.taskConfig ? { taskConfig: selectedSpecial.taskConfig } : undefined;

        // Get valid video URLs
        const validVideoUrls = videoInputUploads
          .filter(
            (entry) =>
              entry.url &&
              typeof entry.createdAt === "number" &&
              Date.now() - entry.createdAt <= UPLOAD_URL_TTL_MS
          )
          .map((entry) => entry.url as string);

        if (validVideoUrls.length === 0) {
          throw new Error("Please upload at least one video file.");
        }

        const specialPayload = buildSpecialModelInput(selectedSpecial, {
          modelId: selectedSpecial.id,
          prompt: prompt.trim(),
          video_urls: validVideoUrls,
          duration: paramValues.duration as string | undefined,
          resolution: paramValues.resolution as string | undefined,
        });

        payload = specialPayload;

      } else {
        throw new Error("Model not found");
      }

      if (!endpoint || !payload || !modelId || !category) {
        throw new Error("Model configuration is incomplete.");
      }
      if (!getProviderKey(provider)) {
        throw new Error(
          `Missing ${getProviderEnvVar(provider)}. Add it to .env.local and restart the app.`
        );
      }

      addToHistory(prompt);

      addJob(
        category,
        prompt.trim() || modelId,
        {
          endpoint,
          payload,
          modelId,
          category,
          provider,
          callOptions: callOptions ?? {},
          seed: "1569",
          prompt,
          connection,
          refreshTree,
        },
        async (data: unknown, log) => {
          const {
            endpoint,
            payload,
            modelId,
            category,
            provider,
            callOptions,
            seed,
            prompt,
            connection,
            refreshTree,
          } = data as {
            endpoint: string;
            payload: Record<string, unknown>;
            modelId: string;
            category: "image" | "video";
            provider: ModelProvider;
            callOptions?: ProviderCallOptions;
            seed: string;
            prompt: string;
            connection: WorkspaceConnection;
            refreshTree: (path?: string) => Promise<void>;
          };

          log("Calling model API...");
          const result = await callModelEndpoint(
            provider,
            endpoint,
            payload,
            { ...callOptions, log }
          );

          let downloadedBlob: Blob | undefined;
          let resultUrlStr: string | undefined;

          if (result.blob) {
            downloadedBlob = result.blob;
          } else if (result.url) {
            resultUrlStr = result.url;
            log("Downloading result...");
            try {
              downloadedBlob = await downloadBlob(result.url);
            } catch {
              log(`Download failed, retrying in 2s...`);
              // Retry once after 2 seconds
              try {
                await new Promise(resolve => setTimeout(resolve, 2000));
                downloadedBlob = await downloadBlob(result.url);
                log("Retry successful!");
              } catch (retryError) {
                log(`Failed to download result: ${retryError instanceof Error ? retryError.message : String(retryError)}`);
                // Continue without blob
              }
            }
          } else {
            throw new Error("No result from model");
          }

          // Determine extension
          let extension = category === "image" ? "png" : "mp4";
          if (resultUrlStr) {
            try {
              const urlObj = new URL(resultUrlStr);
              const pathname = urlObj.pathname;
              const ext = pathname.split(".").pop();
              if (ext && ext.length >= 3 && ext.length <= 4) {
                extension = ext;
              } else if (downloadedBlob) {
                const type = downloadedBlob.type;
                const mimeExt = extensionFromMime(type);
                if (mimeExt) {
                  extension = mimeExt;
                }
              }
            } catch {
              // ignore
            }
          }

          const folder = category === "image" ? "images" : "videos";
          const filename = buildFilename(modelId, prompt, extension, seed);
          const relPath = buildDatedMediaPath(folder, filename);

          if (downloadedBlob && connection) {
            log("Saving to workspace...");
            await uploadFile(connection, relPath, downloadedBlob);
            try {
              await recordGeneration(connection, {
                workspaceId: connection.workspaceId,
                outputRelPath: relPath,
                outputMime: downloadedBlob.type || undefined,
                outputSize: downloadedBlob.size,
                category,
                modelId,
                provider,
                endpoint,
                prompt,
                seed,
                payload,
              });
            } catch (error) {
              log(`Metadata write failed: ${error instanceof Error ? error.message : String(error)}`);
            }
            await refreshTree(relPath);
          } else if (!downloadedBlob) {
            log(`Result available at URL (could not save to workspace): ${resultUrlStr}`);
          }

          return resultUrlStr || "Blob saved";
        }
      );
    } catch (error) {
      console.error(error);
      setStatus(error instanceof Error ? error.message : "Generation failed");
    } finally {
      if (isMounted.current) {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <form className="flex h-full flex-col text-sm" onSubmit={handleGenerate}>
      <div className="flex-1 space-y-3 pb-32">
        <div className="space-y-3">
          <div className="flex rounded-lg bg-white/5 p-1">
            {(["image", "video", "special"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                disabled={isSubmitting || isExpanding}
                onClick={() => {
                  setActiveTab(tab);
                  if (tab === "image" && IMAGE_MODELS.length) {
                    setModelKey(`image:${IMAGE_MODELS[0].id}`);
                  } else if (tab === "video" && MODEL_SPECS.length) {
                    setModelKey(`video:${MODEL_SPECS[0].id}`);
                  } else if (tab === "special" && SPECIAL_MODELS.length) {
                    setModelKey(`special:${SPECIAL_MODELS[0].id}`);
                  }
                }}
                className={`flex-1 rounded-md py-1.5 text-xs font-semibold capitalize transition-all ${activeTab === tab
                  ? "bg-slate-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
                  } ${isSubmitting || isExpanding ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="space-y-1">

            <select
              value={modelKey}
              disabled={isSubmitting || isExpanding}
              onChange={(event) => {
                setModelKey(event.target.value);
              }}
              className={`w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 ${isSubmitting || isExpanding ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {activeTab === "video" && (
                <optgroup label="Video Pipelines">
                  {MODEL_SPECS.map((spec) => (
                    <option key={spec.id} value={`video:${spec.id}`}>
                      {spec.label ?? spec.id}
                    </option>
                  ))}
                </optgroup>
              )}

              {activeTab === "image" && (
                <optgroup label="Image Pipelines">
                  {IMAGE_MODELS.map((spec) => (
                    <option key={spec.id} value={`image:${spec.id}`}>
                      {spec.label}
                    </option>
                  ))}
                </optgroup>
              )}

              {activeTab === "special" && (
                <optgroup label="Special Pipelines">
                  {SPECIAL_MODELS.map((spec) => (
                    <option key={spec.id} value={`special:${spec.id}`}>
                      {spec.label}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
        </div>

        {/* IMAGE CONTROLS */}
        {modelKind === "image" ? (
          <div className="space-y-4">
            {/* 1. Reference Uploads (Top) */}
            {/* 1. Reference Uploads (Top) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Reference Images (optional)
                </label>
                <span className="text-[10px] text-slate-500">Max 5</span>
              </div>

              <div
                className={`relative flex min-h-[60px] flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-transparent p-2 transition ${isReferenceDragActive
                  ? "border-sky-400 shadow-lg shadow-sky-500/20"
                  : "hover:border-white/20"
                  } ${isSubmitting || isExpanding ? "opacity-50 cursor-not-allowed" : ""}`}
                onDragEnter={(event) => {
                  if (isSubmitting || isExpanding) return;
                  event.preventDefault();
                  setIsReferenceDragActive(true);
                }}
                onDragLeave={(event) => {
                  if (isSubmitting || isExpanding) return;
                  event.preventDefault();
                  setIsReferenceDragActive(false);
                }}
                onDragOver={(event) => {
                  if (isSubmitting || isExpanding) return;
                  event.preventDefault();
                  setIsReferenceDragActive(true);
                }}
                onDrop={(event) => {
                  if (isSubmitting || isExpanding) return;
                  event.preventDefault();
                  setIsReferenceDragActive(false);
                  void handleReferenceDrop(event.dataTransfer);
                }}
              >
                <input
                  ref={referenceInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={isSubmitting || isExpanding}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    void handleReferenceFiles(event.target.files);
                    event.target.value = "";
                  }}
                />

                {/* Previews */}
                {referenceUploads.map((entry) => (
                  <div
                    key={entry.id}
                    className="group relative h-10 w-10 shrink-0 overflow-hidden rounded-md border border-white/10 bg-black/20"
                    title={entry.name}
                  >
                    <img
                      src={entry.preview}
                      alt={entry.name}
                      className="h-full w-full object-cover"
                    />
                    {entry.uploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <Spinner size="sm" />
                      </div>
                    )}
                    <button
                      type="button"
                      className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeReference(entry.id);
                      }}
                      disabled={isSubmitting || isExpanding}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-white hover:text-rose-400"
                      >
                        <path d="M18 6 6 18" />
                        <path d="m6 6 12 12" />
                      </svg>
                    </button>
                  </div>
                ))}

                {/* Add Button */}
                {referenceUploads.length < 5 && (
                  <button
                    type="button"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-dashed border-white/20 bg-white/5 text-slate-400 transition hover:border-sky-400 hover:text-sky-200"
                    onClick={() => referenceInputRef.current?.click()}
                    title="Add image"
                    disabled={isSubmitting || isExpanding}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12h14" />
                      <path d="M12 5v14" />
                    </svg>
                  </button>
                )}

                {/* Empty State Text */}
                {referenceUploads.length === 0 && (
                  <span className="ml-1 text-xs text-slate-500 pointer-events-none">
                    Drag images or click +
                  </span>
                )}
              </div>
            </div>

            {/* 2. Prompt */}
            <div className="space-y-1">

              <div className="relative">
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  onBlur={() => addToHistory(prompt)}
                  rows={6}
                  disabled={isSubmitting || isExpanding}
                  className={`w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-3 text-sm text-white outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 pb-10 ${isSubmitting || isExpanding ? "opacity-50 cursor-not-allowed" : ""}`}
                />
                <div className="absolute bottom-2 right-2 flex gap-1">
                  <button
                    type="button"
                    onClick={undo}
                    disabled={historyIndex <= 0 || isSubmitting || isExpanding}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 text-slate-300 transition hover:bg-white/20 hover:text-white disabled:opacity-30"
                    title="Undo"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></svg>
                  </button>
                  <button
                    type="button"
                    onClick={redo}
                    disabled={historyIndex >= history.length - 1 || isSubmitting || isExpanding}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 text-slate-300 transition hover:bg-white/20 hover:text-white disabled:opacity-30"
                    title="Redo"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" /></svg>
                  </button>
                  <div className="w-px bg-white/10 mx-1" />
                  <button
                    type="button"
                    onClick={() => handleExpandPrompt("natural")}
                    disabled={isExpanding || isSubmitting || !prompt.trim()}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-indigo-500/30 bg-indigo-500/20 text-indigo-200 transition hover:bg-indigo-500/40 hover:text-white disabled:opacity-50"
                    title="Expand with Natural Language"
                  >
                    {isExpanding ? (
                      <Spinner size="sm" />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /><path d="M5 3v4" /><path d="M9 3v4" /><path d="M3 5h4" /><path d="M3 9h4" /></svg>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExpandPrompt("yaml")}
                    disabled={isExpanding || isSubmitting || !prompt.trim()}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-indigo-500/30 bg-indigo-500/20 text-indigo-200 transition hover:bg-indigo-500/40 hover:text-white disabled:opacity-50"
                    title="Expand to YAML"
                  >
                    {isExpanding ? (
                      <Spinner size="sm" />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><path d="M12 13v6" /><path d="M12 13h-2" /><path d="M12 13h2" /></svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Alter Box */}
              <div className="flex gap-2 pt-2">
                <input
                  type="text"
                  value={alterInstruction}
                  onChange={(e) => setAlterInstruction(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleAlter();
                    }
                  }}
                  placeholder="Refine prompt (e.g. 'make it darker', 'add rain')..."
                  disabled={isSubmitting || isExpanding || isAltering}
                  className={`flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 placeholder:text-slate-600 ${isSubmitting || isExpanding || isAltering ? "opacity-50 cursor-not-allowed" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => void handleAlter()}
                  disabled={!prompt.trim() || !alterInstruction.trim() || isSubmitting || isExpanding || isAltering}
                  className="flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Apply Alteration"
                >
                  {isAltering ? (
                    <Spinner size="sm" />
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* 3. Aspect ratio & model-specific inputs */}
            {/* 3. Aspect ratio & model-specific inputs */}
            <div className="space-y-2">
              {modelKind === "image" && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Aspect ratio
                  </label>
                  <select
                    value={aspectRatio}
                    onChange={(event) => setAspectRatio(event.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                  >
                    {(selectedImage?.ui?.aspectRatios ??
                      [
                        { value: "16:9", label: "16:9" },
                        { value: "4:3", label: "4:3" },
                        { value: "1:1", label: "1:1" },
                        { value: "3:2", label: "3:2" },
                        { value: "9:16", label: "9:16" },
                      ]).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {modelKind === "image" && selectedImage?.ui?.resolutions ? (
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Resolution
                  </label>
                  <select
                    value={imageResolution}
                    onChange={(event) => setImageResolution(event.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                  >
                    {selectedImage?.ui?.resolutions?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>

            {/* 4. Seed */}

          </div>
        ) : null}

        {/* VIDEO CONTROLS */}
        {modelKind === "video" ? (
          <div className="space-y-4">
            {/* Start/End Frames */}
            {supportsStartFrame ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="min-w-0">
                  <UploadZone
                    label="Start frame"
                    accept="image/*"
                    slot={startFrame}
                    onFile={handleStartFrameSelect}
                    extractFiles={extractFilesFromDataTransfer}
                  />
                </div>

                {supportsEndFrame ? (
                  <div className="min-w-0 flex-1">
                    <UploadZone
                      label="End frame (optional)"
                      accept="image/*"
                      slot={endFrame}
                      onFile={handleEndFrameSelect}
                      extractFiles={extractFilesFromDataTransfer}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Prompt */}
            <div className="space-y-1">

              <div className="relative">
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  onBlur={() => addToHistory(prompt)}
                  rows={6}
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-3 text-sm text-white outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 pb-10"
                />
                <div className="absolute bottom-2 right-2 flex gap-1">
                  <button
                    type="button"
                    onClick={undo}
                    disabled={historyIndex <= 0}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 text-slate-300 transition hover:bg-white/20 hover:text-white disabled:opacity-30"
                    title="Undo"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></svg>
                  </button>
                  <button
                    type="button"
                    onClick={redo}
                    disabled={historyIndex >= history.length - 1}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 text-slate-300 transition hover:bg-white/20 hover:text-white disabled:opacity-30"
                    title="Redo"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" /></svg>
                  </button>
                  <div className="w-px bg-white/10 mx-1" />

                  {/* Prompt Mode Toggle */}
                  <button
                    type="button"
                    onClick={() => setPromptMode(prev => prev === "photoreal" ? "general" : "photoreal")}
                    disabled={isExpanding}
                    className={`flex h-7 w-7 items-center justify-center rounded-md border transition disabled:opacity-50 ${promptMode === "photoreal"
                        ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/40 hover:text-white"
                        : "border-amber-500/30 bg-amber-500/20 text-amber-200 hover:bg-amber-500/40 hover:text-white"
                      }`}
                    title={`Current Mode: ${promptMode === "photoreal" ? "Photorealistic (Camera Aware)" : "General (Creative Description)"}`}
                  >
                    {promptMode === "photoreal" ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                    )}
                  </button>
                  <div className="w-px bg-white/10 mx-1" />
                  <button
                    type="button"
                    onClick={() => handleExpandPrompt("natural")}
                    disabled={isExpanding || !prompt.trim()}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-indigo-500/30 bg-indigo-500/20 text-indigo-200 transition hover:bg-indigo-500/40 hover:text-white disabled:opacity-50"
                    title="Expand with Natural Language"
                  >
                    {isExpanding ? (
                      <Spinner size="sm" />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /><path d="M5 3v4" /><path d="M9 3v4" /><path d="M3 5h4" /><path d="M3 9h4" /></svg>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExpandPrompt("yaml")}
                    disabled={isExpanding || !prompt.trim()}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-indigo-500/30 bg-indigo-500/20 text-indigo-200 transition hover:bg-indigo-500/40 hover:text-white disabled:opacity-50"
                    title="Expand to YAML"
                  >
                    {isExpanding ? (
                      <Spinner size="sm" />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><path d="M12 13v6" /><path d="M12 13h-2" /><path d="M12 13h2" /></svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Alter Box */}
              <div className="flex gap-2 pt-2">
                <input
                  type="text"
                  value={alterInstruction}
                  onChange={(e) => setAlterInstruction(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleAlter();
                    }
                  }}
                  placeholder="Refine prompt (e.g. 'make it darker', 'add rain')..."
                  disabled={isSubmitting || isExpanding || isAltering}
                  className={`flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 placeholder:text-slate-600 ${isSubmitting || isExpanding || isAltering ? "opacity-50 cursor-not-allowed" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => void handleAlter()}
                  disabled={!prompt.trim() || !alterInstruction.trim() || isSubmitting || isExpanding || isAltering}
                  className="flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Apply Alteration"
                >
                  {isAltering ? (
                    <Spinner size="sm" />
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Dynamic Params: Duration and other settings side by side */}
            {selectedVideo ? (
              <div className="grid grid-cols-2 gap-2">
                {/* Duration */}
                {selectedVideo.params.duration && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Duration
                    </label>
                    {selectedVideo.params.duration.type === "enum" && selectedVideo.params.duration.values ? (
                      <select
                        value={paramValues.duration === undefined ? "" : String(paramValues.duration)}
                        onChange={(event) =>
                          handleParamChange(
                            "duration",
                            event.target.value === ""
                              ? undefined
                              : typeof selectedVideo.params.duration?.values?.[0] === "number"
                                ? Number(event.target.value)
                                : event.target.value
                          )
                        }
                        disabled={isSubmitting || isExpanding}
                        className={`w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 ${isSubmitting || isExpanding ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        {!selectedVideo.params.duration.required && (
                          <option value="">Default</option>
                        )}
                        {selectedVideo.params.duration.values.map((option: string | number) => (
                          <option key={String(option)} value={String(option)}>
                            {String(option)}s
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="number"
                        value={paramValues.duration === undefined ? "" : Number(paramValues.duration)}
                        onChange={(event) =>
                          handleParamChange(
                            "duration",
                            event.target.value === "" ? undefined : Number(event.target.value)
                          )
                        }
                        disabled={isSubmitting || isExpanding}
                        className={`w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 ${isSubmitting || isExpanding ? "opacity-50 cursor-not-allowed" : ""}`}
                      />
                    )}
                  </div>
                )}

                {/* Other params - sound/audio first, then others */}
                {(Object.entries(selectedVideo.params) as Array<
                  [string, ParamDefinition | undefined]
                >)
                  .filter(([key]) => key !== "duration" && key !== "aspect_ratio" && key !== "aspectRatio" && key !== "resolution")
                  .sort(([keyA], [keyB]) => {
                    // Prioritize sound/audio params to appear first (next to duration)
                    const soundKeys = ["sound", "audio", "generate_audio", "with_audio", "enable_audio", "has_audio"];
                    const aIsSound = soundKeys.some(sk => keyA.toLowerCase().includes(sk));
                    const bIsSound = soundKeys.some(sk => keyB.toLowerCase().includes(sk));
                    if (aIsSound && !bIsSound) return -1;
                    if (!aIsSound && bIsSound) return 1;
                    return 0;
                  })
                  .map(([key, definition]) =>
                    definition ? renderParamControl(key, definition) : null
                  )
                  .filter(Boolean)}
              </div>
            ) : null}

            {/* Aspect ratio & Resolution for Video - below other params */}
            <div className="grid grid-cols-2 gap-2">
              {(selectedVideo?.params?.aspect_ratio || selectedVideo?.params?.aspectRatio) && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Aspect ratio
                  </label>
                  <select
                    value={aspectRatio}
                    onChange={(event) => setAspectRatio(event.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                  >
                    {(selectedVideo?.params?.aspect_ratio?.values ?? selectedVideo?.params?.aspectRatio?.values ?? []).map((val) => (
                      <option key={String(val)} value={String(val)}>
                        {String(val)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedVideo?.params?.resolution ? (
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Resolution
                  </label>
                  <select
                    value={imageResolution}
                    onChange={(event) => setImageResolution(event.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                  >
                    {selectedVideo?.params?.resolution?.values?.map((val) => (
                      <option key={String(val)} value={String(val)}>
                        {String(val)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>

            {/* Reference Images (for video models that support it) */}
            {referenceLimit > 0 ? (
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Reference Images (max 5)
                </label>
                <div
                  className={`relative flex min-h-[100px] flex-col justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-transparent p-3 transition ${isReferenceDragActive
                    ? "border-sky-400 shadow-lg shadow-sky-500/20"
                    : "hover:border-white/20"
                    }`}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setIsReferenceDragActive(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    setIsReferenceDragActive(false);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsReferenceDragActive(true);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsReferenceDragActive(false);
                    void handleReferenceDrop(event.dataTransfer);
                  }}
                >
                  <input
                    ref={referenceInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      void handleReferenceFiles(event.target.files);
                      event.target.value = "";
                    }}
                  />

                  {referenceUploads.length === 0 ? (
                    <div
                      className="flex flex-col items-center justify-center py-2 text-center cursor-pointer"
                      onClick={() => referenceInputRef.current?.click()}
                    >
                      <div className="mb-2 rounded-full bg-white/5 p-2 text-slate-400">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                      </div>
                      <div className="text-xs text-slate-400">
                        <span className="font-medium text-slate-300">Click to upload</span> or drag and drop
                      </div>
                      <div className="mt-1 text-[10px] text-slate-500">
                        Max 5 images
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      {referenceUploads.map((entry) => (
                        <div
                          key={entry.id}
                          className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-white/10 bg-black/20 group"
                          title={entry.name}
                        >
                          <img
                            src={entry.preview}
                            alt={entry.name}
                            className="h-full w-full object-cover"
                          />
                          {entry.uploading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                              <Spinner size="sm" />
                            </div>
                          )}
                          <button
                            type="button"
                            className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-rose-500 group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeReference(entry.id);
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                          </button>
                        </div>
                      ))}

                      {/* Add more button (small square) */}
                      {referenceUploads.length < 5 && (
                        <button
                          type="button"
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-dashed border-white/20 bg-white/5 text-slate-400 transition hover:border-sky-400 hover:text-sky-200"
                          onClick={() => referenceInputRef.current?.click()}
                          title="Add more images"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : null
        }

        {/* SPECIAL CONTROLS */}
        {modelKind === "special" && selectedSpecial ? (
          <div className="space-y-4">
            {/* Video Input Uploads */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Reference Videos (required)
                </label>
                <span className="text-[10px] text-slate-500">
                  Max {selectedSpecial.videoInputConfig?.max ?? 3}
                </span>
              </div>

              <div
                className={`relative flex min-h-[100px] flex-col justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-transparent p-3 transition ${isReferenceDragActive
                  ? "border-sky-400 shadow-lg shadow-sky-500/20"
                  : "hover:border-white/20"
                  } ${isSubmitting || isExpanding ? "opacity-50 cursor-not-allowed" : ""}`}
                onDragEnter={(event) => {
                  if (isSubmitting || isExpanding) return;
                  event.preventDefault();
                  setIsReferenceDragActive(true);
                }}
                onDragLeave={(event) => {
                  if (isSubmitting || isExpanding) return;
                  event.preventDefault();
                  setIsReferenceDragActive(false);
                }}
                onDragOver={(event) => {
                  if (isSubmitting || isExpanding) return;
                  event.preventDefault();
                  setIsReferenceDragActive(true);
                }}
                onDrop={async (event) => {
                  if (isSubmitting || isExpanding) return;
                  event.preventDefault();
                  setIsReferenceDragActive(false);

                  // Use the same file extraction as image uploads (handles both OS and app file browser)
                  const allFiles = await extractFilesFromDataTransfer(event.dataTransfer);
                  console.log("Dropped files:", allFiles.map(f => ({ name: f.name, type: f.type, size: f.size })));

                  // Check MIME type OR file extension for video detection
                  const isVideoFile = (f: File) => {
                    if (f.type.startsWith("video/")) return true;
                    const ext = f.name.toLowerCase().split(".").pop();
                    return ["mp4", "mov", "mkv", "webm", "avi"].includes(ext ?? "");
                  };

                  const files = allFiles.filter(isVideoFile);
                  console.log("Filtered video files:", files.length);

                  if (files.length === 0) {
                    setStatus("Please drop video files (mp4, mov, mkv).");
                    setTimeout(() => setStatus(null), 3000);
                    return;
                  }
                  const maxVideos = selectedSpecial.videoInputConfig?.max ?? 3;
                  const availableSlots = maxVideos - videoInputUploads.length;
                  if (availableSlots <= 0) {
                    setStatus(`Maximum ${maxVideos} videos allowed.`);
                    setTimeout(() => setStatus(null), 3000);
                    return;
                  }
                  const filesToUpload = files.slice(0, availableSlots);
                  for (const file of filesToUpload) {
                    const id = Math.random().toString(36).slice(2);
                    const preview = URL.createObjectURL(file);
                    setVideoInputUploads((prev) => [
                      ...prev,
                      { id, preview, name: file.name, uploading: true },
                    ]);
                    try {
                      const url = await uploadToFal(file);
                      setVideoInputUploads((prev) =>
                        prev.map((item) =>
                          item.id === id
                            ? { ...item, uploading: false, url, createdAt: Date.now() }
                            : item
                        )
                      );
                    } catch {
                      setVideoInputUploads((prev) =>
                        prev.map((item) =>
                          item.id === id
                            ? { ...item, uploading: false, error: "Upload failed" }
                            : item
                        )
                      );
                    }
                  }
                }}
              >
                <input
                  type="file"
                  accept="video/mp4,video/quicktime,video/x-matroska"
                  multiple
                  className="hidden"
                  id="video-input-upload"
                  disabled={isSubmitting || isExpanding}
                  onChange={async (event) => {
                    // Check MIME type OR file extension for video detection
                    const isVideoFile = (f: File) => {
                      if (f.type.startsWith("video/")) return true;
                      const ext = f.name.toLowerCase().split(".").pop();
                      return ["mp4", "mov", "mkv", "webm", "avi"].includes(ext ?? "");
                    };

                    const files = Array.from(event.target.files ?? []).filter(isVideoFile);
                    event.target.value = "";
                    if (!files.length) return;
                    const maxVideos = selectedSpecial.videoInputConfig?.max ?? 3;
                    const availableSlots = maxVideos - videoInputUploads.length;
                    if (availableSlots <= 0) {
                      setStatus(`Maximum ${maxVideos} videos allowed.`);
                      setTimeout(() => setStatus(null), 3000);
                      return;
                    }
                    const filesToUpload = files.slice(0, availableSlots);
                    for (const file of filesToUpload) {
                      const id = Math.random().toString(36).slice(2);
                      const preview = URL.createObjectURL(file);
                      setVideoInputUploads((prev) => [
                        ...prev,
                        { id, preview, name: file.name, uploading: true },
                      ]);
                      try {
                        const url = await uploadToFal(file);
                        setVideoInputUploads((prev) =>
                          prev.map((item) =>
                            item.id === id
                              ? { ...item, uploading: false, url, createdAt: Date.now() }
                              : item
                          )
                        );
                      } catch {
                        setVideoInputUploads((prev) =>
                          prev.map((item) =>
                            item.id === id
                              ? { ...item, uploading: false, error: "Upload failed" }
                              : item
                          )
                        );
                      }
                    }
                  }}
                />

                {videoInputUploads.length === 0 ? (
                  <label
                    htmlFor="video-input-upload"
                    className="flex flex-col items-center justify-center py-2 text-center cursor-pointer"
                  >
                    <div className="mb-2 rounded-full bg-white/5 p-2 text-slate-400">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m22 8-6 4 6 4V8Z" />
                        <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
                      </svg>
                    </div>
                    <div className="text-xs text-slate-400">
                      <span className="font-medium text-slate-300">Click to upload</span> or drag videos
                    </div>
                    <div className="mt-1 text-[10px] text-slate-500">
                      MP4, MOV, MKV (max 10MB each)
                    </div>
                  </label>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    {videoInputUploads.map((entry) => (
                      <div
                        key={entry.id}
                        className="relative h-16 w-24 shrink-0 overflow-hidden rounded-md border border-white/10 bg-black/20 group"
                        title={entry.name}
                      >
                        <video
                          src={entry.preview}
                          className="h-full w-full object-cover"
                          muted
                        />
                        {entry.uploading && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                            <Spinner size="sm" />
                          </div>
                        )}
                        {entry.error && (
                          <div className="absolute inset-0 flex items-center justify-center bg-red-500/20 text-[10px] text-red-300">
                            Error
                          </div>
                        )}
                        <button
                          type="button"
                          className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-rose-500 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            setVideoInputUploads((prev) => prev.filter((item) => item.id !== entry.id));
                          }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6 6 18" />
                            <path d="m6 6 12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}

                    {videoInputUploads.length < (selectedSpecial.videoInputConfig?.max ?? 3) && (
                      <label
                        htmlFor="video-input-upload"
                        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-dashed border-white/20 bg-white/5 text-slate-400 transition hover:border-sky-400 hover:text-sky-200 cursor-pointer"
                        title="Add more videos"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14" />
                          <path d="M12 5v14" />
                        </svg>
                      </label>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Prompt */}
            <div className="space-y-1">
              <div className="relative">
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  onBlur={() => addToHistory(prompt)}
                  placeholder="Describe what should happen in the video..."
                  rows={4}
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-3 text-sm text-white outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                />
              </div>
            </div>

            {/* Duration and Resolution */}
            <div className="grid grid-cols-2 gap-2">
              {selectedSpecial.params.duration && selectedSpecial.params.duration.values && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Duration
                  </label>
                  <select
                    value={paramValues.duration === undefined ? String(selectedSpecial.params.duration.default ?? selectedSpecial.params.duration.values[0]) : String(paramValues.duration)}
                    onChange={(event) => handleParamChange("duration", event.target.value)}
                    disabled={isSubmitting || isExpanding}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                  >
                    {selectedSpecial.params.duration.values.map((val) => (
                      <option key={String(val)} value={String(val)}>
                        {String(val)}s
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedSpecial.params.resolution && selectedSpecial.params.resolution.values && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Resolution
                  </label>
                  <select
                    value={paramValues.resolution === undefined ? String(selectedSpecial.params.resolution.default ?? selectedSpecial.params.resolution.values[0]) : String(paramValues.resolution)}
                    onChange={(event) => handleParamChange("resolution", event.target.value)}
                    disabled={isSubmitting || isExpanding}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                  >
                    {selectedSpecial.params.resolution.values.map((val) => (
                      <option key={String(val)} value={String(val)}>
                        {String(val)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        ) : null}


      </div >

      <div className="sticky bottom-0 left-0 right-0 mt-auto space-y-2 border-t border-white/10 bg-slate-950/95 p-3 shadow-[0_-6px_25px_rgba(0,0,0,0.7)] backdrop-blur">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="submit"
            disabled={pendingUploads || isMissingImageReference || isSubmitting}
            className="rounded-xl bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-sky-500/30 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-sky-500/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {isSubmitting
              ? "Queueing..."
              : pendingUploads
                ? "Waiting on uploads…"
                : isMissingImageReference
                  ? "Add a reference image"
                  : "✨ Generate"}
          </button>
          {pricingLabel ? (
            <span className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-sm font-semibold text-amber-200">
              {pricingLabel}
            </span>
          ) : null}
        </div>
        {status ? (
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">
            {status}
          </div>
        ) : isMissingImageReference ? (
          <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            Add at least one reference image to generate with this model.
          </div>
        ) : null}
      </div>
    </form >
  );
}
