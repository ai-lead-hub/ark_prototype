import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { PromptBuilderV2 } from "./PromptBuilder";
import { BatchPromptModal } from "./BatchPromptModal";
import { CameraMovementSelector } from "./ui/CameraMovementSelector";
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
import { expandPrompt, alterPrompt, expandKlingO1ReferencePrompt } from "../lib/llm";
import { buildDatedMediaPath } from "../lib/storage-paths";
import {
  consumeControlsActions,
  getControlsPrompt,
  onControlsStoreChange,
  type ControlsAction,
  type ControlsFileRef,
} from "../lib/controls-store";
import { recordRecentReference } from "../lib/recent-references";
import { useRandomizeSeed } from "../lib/useRandomizeSeed";
import { useElements } from "../state/elements";

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
  /** File object for deferred upload - uploaded at generation time */
  file?: File;
  /** True if restored from saved generation payload (may be expired) */
  restoredFromUrl?: boolean;
};

const UPLOAD_URL_TTL_MS = 30 * 60 * 1000;
const IMAGE_REFERENCE_UPLOADS_KEY = "controls_imageReferenceUploads_v1";
const VIDEO_START_FRAME_KEY = "controls_videoStartFrame_v1";
const VIDEO_END_FRAME_KEY = "controls_videoEndFrame_v1";
const IMAGE_HISTORY_KEY = "controls_imageHistory_v1";
const VIDEO_HISTORY_KEY = "controls_videoHistory_v1";
const HISTORY_MAX_SIZE = 50;

type PersistedHistory = {
  entries: string[];
  index: number;
};

function loadHistoryFromStorage(tab: "image" | "video"): PersistedHistory {
  if (typeof localStorage === "undefined") return { entries: [], index: -1 };
  try {
    const key = tab === "image" ? IMAGE_HISTORY_KEY : VIDEO_HISTORY_KEY;
    const raw = localStorage.getItem(key);
    if (!raw) return { entries: [], index: -1 };
    const parsed = JSON.parse(raw) as PersistedHistory;
    if (!Array.isArray(parsed.entries)) return { entries: [], index: -1 };
    return {
      entries: parsed.entries.slice(-HISTORY_MAX_SIZE),
      index: Math.min(parsed.index, parsed.entries.length - 1),
    };
  } catch {
    return { entries: [], index: -1 };
  }
}

function saveHistoryToStorage(tab: "image" | "video", entries: string[], index: number): void {
  if (typeof localStorage === "undefined") return;
  try {
    const key = tab === "image" ? IMAGE_HISTORY_KEY : VIDEO_HISTORY_KEY;
    localStorage.setItem(key, JSON.stringify({ entries: entries.slice(-HISTORY_MAX_SIZE), index }));
  } catch {
    // Ignore storage errors
  }
}

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

type UploadSlotState = UploadSlot & {
  createdAt?: number;
  /** File object for deferred upload - uploaded at generation time */
  file?: File;
};



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
  const elementsState = useElements();

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
  type PromptMode = "photoreal" | "audiogen" | "editing" | "general" | "timestep";
  type ImagePromptMode = "photoreal" | "editing" | "general";
  type VideoPromptMode = "photoreal" | "audiogen" | "timestep";
  const legacyPromptMode = getStored<PromptMode | null>("promptMode", null);
  const initialImagePromptMode: ImagePromptMode =
    legacyPromptMode === "editing" || legacyPromptMode === "general" || legacyPromptMode === "photoreal"
      ? legacyPromptMode
      : "photoreal";
  const initialVideoPromptMode: VideoPromptMode =
    legacyPromptMode === "audiogen" || legacyPromptMode === "timestep" || legacyPromptMode === "photoreal"
      ? legacyPromptMode
      : "photoreal";

  const [imagePromptMode, setImagePromptMode] = usePersistentState<ImagePromptMode>(
    "imagePromptMode",
    initialImagePromptMode
  );
  const [videoPromptMode, setVideoPromptMode] = usePersistentState<VideoPromptMode>(
    "videoPromptMode",
    initialVideoPromptMode
  );
  const [specialPromptMode, setSpecialPromptMode] = usePersistentState<PromptMode>(
    "specialPromptMode",
    initialImagePromptMode
  );

  const prompt = activeTab === "image" ? imagePrompt : activeTab === "video" ? videoPrompt : specialPrompt;
  const promptMode: PromptMode =
    activeTab === "video" ? videoPromptMode : activeTab === "special" ? specialPromptMode : imagePromptMode;
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

  // Multishot prompts state for Kling V3
  const [multishotPrompts, setMultishotPrompts] = useState<Array<{ prompt: string; duration: number }>>([]);
  const [currentMultishotPrompt, setCurrentMultishotPrompt] = useState("");
  const [currentMultishotDuration, setCurrentMultishotDuration] = useState(5);
  const [useMultishot, setUseMultishot] = useState(false);

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
  const [randomizeSeed] = useRandomizeSeed();
  const [imageResolution, setImageResolution] = useState("1K");
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);
  // const [busy, setBusy] = useState(false);
  const [isReferenceDragActive, setIsReferenceDragActive] = useState(false);
  const [showPromptStudio, setShowPromptStudio] = useState(false);
  const [showCameraSelector, setShowCameraSelector] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchQueue, setBatchQueue] = useState<string[]>([]);
  const [batchIndex, setBatchIndex] = useState(0);
  const isBatchProcessing = batchQueue.length > 0;
  // Reference model state (Kling O1 Reference)
  // Images are stored locally (blob URLs) until Generate is pressed for speed
  type ElementUpload = {
    id: string;
    frontalPreview: string;
    frontalFile?: File;  // Store file for deferred upload
    frontalUrl?: string;
    frontalUploading: boolean;
    referenceImages: Array<{
      id: string;
      preview: string;
      file?: File;  // Store file for deferred upload
      url?: string;
      uploading: boolean;
    }>;
  };
  const [referenceStyleImages, setReferenceStyleImages] = useState<Array<{
    id: string;
    preview: string;
    file?: File;  // Store file for deferred upload
    url?: string;
    uploading: boolean;
  }>>([]);
  const [elements, setElements] = useState<ElementUpload[]>([]);

  // Autocomplete state for @Image/@Element references
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const imagePromptTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const referenceInputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  // Was previous submission complete? Track to detect completion
  const wasSubmittingRef = useRef(false);


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
    Record<string, string | number | boolean | string[] | undefined>
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

  // Batch processing: auto-submit when batch starts or after each job completes
  useEffect(() => {
    // Detect when submission completes (was submitting, now not)
    if (wasSubmittingRef.current && !isSubmitting && isBatchProcessing) {
      // Previous job completed, move to next prompt
      const nextIndex = batchIndex + 1;
      if (nextIndex < batchQueue.length) {
        setBatchIndex(nextIndex);
        setPrompt(batchQueue[nextIndex]);
        // Trigger form submission after a short delay to allow state to update
        setTimeout(() => {
          formRef.current?.requestSubmit();
        }, 500);
      } else {
        // All done
        setBatchQueue([]);
        setBatchIndex(0);
        setStatus(`Batch complete: ${batchQueue.length} images generated`);
        setTimeout(() => setStatus(null), 5000);
      }
    }
    wasSubmittingRef.current = isSubmitting;
  }, [isSubmitting, isBatchProcessing, batchIndex, batchQueue]);

  // When batch queue is first set, trigger initial submission
  useEffect(() => {
    if (batchQueue.length > 0 && batchIndex === 0 && !isSubmitting) {
      setTimeout(() => {
        formRef.current?.requestSubmit();
      }, 300);
    }
  }, [batchQueue]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (selectedSpecial) {
      // Kling V3 Pro has dynamic pricing based on duration and audio
      if (selectedSpecial.id === "kling-v3-pro") {
        const duration = Number(paramValues.duration ?? selectedSpecial.params.duration?.default ?? 5);
        const generateAudio = paramValues.generate_audio ?? selectedSpecial.params.generate_audio?.default ?? true;
        const rate = generateAudio ? 0.336 : 0.224;
        const total = (duration * rate).toFixed(2);
        return `$${total} (${duration}s, ${generateAudio ? "audio on" : "audio off"})`;
      }
      return selectedSpecial.pricing;
    }
    return undefined;
  }, [selectedVideo, selectedImage, selectedSpecial, paramValues]);

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

      // Compress the image for later upload
      const compressed = await compressImage(file);

      // Register preview immediately for responsiveness - keep blob URL for display
      const preview = registerPreview(URL.createObjectURL(compressed));

      // Store compressed file for deferred upload at generation time
      setStartFrame({
        uploading: false,
        preview,
        name: file.name,
        file: compressed,
        // No url yet - will be uploaded when Generate is pressed
      });
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

      // Compress the image for later upload
      const compressed = await compressImage(file);

      // Register preview immediately for responsiveness
      const preview = registerPreview(URL.createObjectURL(compressed));

      // Store compressed file for deferred upload at generation time
      setEndFrame({
        uploading: false,
        preview,
        name: file.name,
        file: compressed,
        // No url yet - will be uploaded when Generate is pressed
      });
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

      const filesToAdd = newFiles.slice(0, availableSlots);
      if (newFiles.length > availableSlots) {
        setStatus(`Only adding ${availableSlots} images (max 5).`);
        setTimeout(() => setStatus(null), 3000);
      }

      // Compress and store files for deferred upload
      const entries: ReferenceUpload[] = [];
      for (const file of filesToAdd) {
        const compressed = await compressImage(file);
        const preview = registerPreview(URL.createObjectURL(compressed));
        entries.push({
          id: Math.random().toString(36).slice(2),
          preview,
          name: file.name,
          uploading: false,
          file: compressed,
          // No url yet - will be uploaded when Generate is pressed
        });
      }

      setReferenceUploads((prev) => [...prev, ...entries]);
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
          // Record as recent reference for quick access
          const conn = connectionRef.current;
          if (conn) {
            const wk = `${conn.apiBase}|${conn.workspaceId}`;
            recordRecentReference(wk, { relPath: action.file.relPath, name: action.file.name, mime: action.file.mime }, "startFrame");
          }
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
          // Record as recent reference for quick access
          const conn = connectionRef.current;
          if (conn) {
            const wk = `${conn.apiBase}|${conn.workspaceId}`;
            recordRecentReference(wk, { relPath: action.file.relPath, name: action.file.name, mime: action.file.mime }, "endFrame");
          }
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
          // Record as recent reference for quick access
          const conn = connectionRef.current;
          if (conn) {
            const wk = `${conn.apiBase}|${conn.workspaceId}`;
            recordRecentReference(wk, { relPath: action.file.relPath, name: action.file.name, mime: action.file.mime }, "reference");
          }
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

          // === RESTORE REFERENCES FROM SAVED PAYLOAD (graceful fallback) ===
          try {
            const payload = (meta.payload ?? {}) as Record<string, unknown>;
            // Extract the nested input object - this is where the actual reference URLs are stored
            const input = (payload.input ?? payload) as Record<string, unknown>;

            // Try to restore start frame - check both nested input and top-level payload
            // API keys vary: image_url (FAL Kling), start_image_url, first_frame_image, image (generic)
            const savedStartFrame =
              input.image_url ||
              input.start_image_url ||
              input.first_frame_image ||
              input.image ||
              payload.start_frame_url ||
              payload.image_url;
            if (savedStartFrame && typeof savedStartFrame === "string") {
              setStartFrame({
                url: savedStartFrame,
                preview: savedStartFrame,
                uploading: false,
                createdAt: Date.now(),
              });
            }

            // Try to restore end frame
            // API keys vary: tail_image_url (FAL Kling), end_image_url, last_frame_image
            const savedEndFrame =
              input.tail_image_url ||
              input.end_image_url ||
              input.last_frame_image ||
              payload.end_frame_url;
            if (savedEndFrame && typeof savedEndFrame === "string") {
              setEndFrame({
                url: savedEndFrame,
                preview: savedEndFrame,
                uploading: false,
                createdAt: Date.now(),
              });
            }

            // Try to restore reference images - use correct setter based on category
            // API keys vary: image_urls (Seedance, GPT Image), input_urls, reference_image_urls, control_images
            const savedRefs =
              input.image_urls ||
              input.input_urls ||
              input.reference_image_urls ||
              input.control_images ||
              payload.reference_image_urls ||
              payload.image_urls ||
              [];
            if (Array.isArray(savedRefs) && savedRefs.length > 0) {
              const restoredRefs: ReferenceUpload[] = savedRefs
                .filter((url: unknown): url is string => typeof url === "string" && url.length > 0)
                .slice(0, 5)
                .map((url: string) => ({
                  id: Math.random().toString(36).slice(2),
                  url,
                  preview: url,
                  name: "restored",
                  uploading: false,
                  createdAt: Date.now(),
                  restoredFromUrl: true,
                }));
              if (restoredRefs.length > 0) {
                // Use correct setter based on category, not modelKind (which hasn't updated yet)
                if (category === "image") {
                  setImageReferenceUploads(restoredRefs);
                } else {
                  setVideoReferenceUploads(restoredRefs);
                }
              }
            }
          } catch (e) {
            // Payload parsing failed - proceed with just prompt (graceful fallback)
            console.warn("Failed to restore references from payload:", e);
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

  // Count valid references (those with file or url - will be uploaded at generation time)
  const validImageRefCount = modelKind === "image" && (selectedImage?.maxRefs ?? 0) !== 0
    ? referenceUploads.filter((e) => e.file || e.url).length
    : 0;

  // Note: validVideoRefCount could be computed similarly if video reference validation is needed


  const imageRequiresReference =
    modelKind === "image" && selectedImage?.requireReference === true;
  const isMissingImageReference =
    imageRequiresReference && validImageRefCount === 0;








  const handleReferenceDrop = useCallback(
    async (dataTransfer: DataTransfer | null) => {
      if (!dataTransfer) return;

      // Check if this is a workspace file (has FILE_ENTRY_MIME data)
      const payloadRaw = dataTransfer.getData(FILE_ENTRY_MIME);
      if (payloadRaw && connection) {
        try {
          const payload = JSON.parse(payloadRaw) as {
            workspaceId: string;
            path: string;
            name?: string;
            mime?: string;
          };
          if (payload.workspaceId === connection.workspaceId) {
            // Record as recent reference for workspace files
            const wk = `${connection.apiBase}|${connection.workspaceId}`;
            const name = payload.name ?? payload.path.split("/").filter(Boolean).pop() ?? "file";
            recordRecentReference(wk, { relPath: payload.path, name, mime: payload.mime ?? "image/png" }, "reference");
          }
        } catch {
          // Ignore parsing errors
        }
      }

      // Continue with normal file extraction and handling
      const files = await extractFilesFromDataTransfer(dataTransfer);
      if (files.length) {
        const dt = new DataTransfer();
        files.forEach(f => dt.items.add(f));
        await handleReferenceFiles(dt.files);
      }
    },
    [connection, extractFilesFromDataTransfer, handleReferenceFiles]
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
    value: string | number | boolean | string[] | undefined
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
    if (definition.type === "array") {
      // Render text input for array values (comma-separated)
      const arrayValue = Array.isArray(value) ? value.join(", ") : "";
      return (
        <div
          key={key}
          className="space-y-1"
        >
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {key.replace(/_/g, " ")}
          </label>
          <input
            type="text"
            placeholder="Enter comma-separated values"
            value={arrayValue}
            onChange={(event) => {
              const inputValue = event.target.value;
              if (inputValue.trim() === "") {
                handleParamChange(uiKey as string, undefined);
              } else {
                const values = inputValue.split(",").map((v) => v.trim()).filter(Boolean);
                handleParamChange(uiKey as string, values);
              }
            }}
            disabled={isSubmitting || isExpanding}
            className={`w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 ${isSubmitting || isExpanding ? "opacity-50 cursor-not-allowed" : ""}`}
          />
          <p className="text-[10px] text-slate-500">Comma-separated list (max 5)</p>
        </div>
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
      if (nextHistory.length > HISTORY_MAX_SIZE) nextHistory.shift();

      const nextIndex = nextHistory.length - 1;
      historyRef.current = nextHistory;
      historyIndexRef.current = nextIndex;

      setHistory(nextHistory);
      setHistoryIndex(nextIndex);

      // Persist history to localStorage
      const tab = activeTab === "image" ? "image" : "video";
      saveHistoryToStorage(tab, nextHistory, nextIndex);

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
    [activeTab, connection, modelKey, modelKind]
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
      historyIndexRef.current = newIndex;
      setHistoryIndex(newIndex);
      setPrompt(history[newIndex]);
    }
  }, [historyIndex, history, setPrompt]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      historyIndexRef.current = newIndex;
      setHistoryIndex(newIndex);
      setPrompt(history[newIndex]);
    }
  }, [historyIndex, history, setPrompt]);

  // Store tab before it changes so we can save history for it
  const prevTabRef = useRef<"image" | "video" | "special" | "upscale">(activeTab);

  // Load history from localStorage when tab changes, save current tab's history before switching
  useEffect(() => {
    const prevTab = prevTabRef.current;
    prevTabRef.current = activeTab;

    // Save current history for previous tab (if it was image or video)
    if ((prevTab === "image" || prevTab === "video") && prevTab !== activeTab) {
      saveHistoryToStorage(prevTab, historyRef.current, historyIndexRef.current);
    }

    // Load history for new tab
    if (activeTab === "image" || activeTab === "video") {
      const loaded = loadHistoryFromStorage(activeTab);
      // If we have stored history, use it; otherwise start fresh with current prompt
      if (loaded.entries.length > 0) {
        historyRef.current = loaded.entries;
        historyIndexRef.current = loaded.index >= 0 ? loaded.index : loaded.entries.length - 1;
        setHistory(loaded.entries);
        setHistoryIndex(historyIndexRef.current);
      } else if (prompt) {
        const initialHistory = [prompt];
        historyRef.current = initialHistory;
        historyIndexRef.current = 0;
        setHistory(initialHistory);
        setHistoryIndex(0);
      } else {
        historyRef.current = [];
        historyIndexRef.current = -1;
        setHistory([]);
        setHistoryIndex(-1);
      }
    } else {
      // For special/upscale tabs, just reset with current prompt
      const initialHistory = prompt ? [prompt] : [];
      historyRef.current = initialHistory;
      historyIndexRef.current = initialHistory.length - 1;
      setHistory(initialHistory);
      setHistoryIndex(initialHistory.length - 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]); // Only react to tab changes

  // Sync activeTab with modelKey to ensure consistency
  useEffect(() => {
    if (modelKey.startsWith("video:") && activeTab !== "video") {
      setActiveTab("video");
    } else if (modelKey.startsWith("image:") && activeTab !== "image") {
      setActiveTab("image");
    }
  }, [modelKey, activeTab, setActiveTab]);

  const handleExpandPrompt = async (type: "natural") => {
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

  const handleAlter = async (instructionOverride?: string) => {
    const instruction = instructionOverride ?? alterInstruction;
    if (!prompt.trim() || !instruction.trim() || isAltering || isSubmitting) return;

    try {
      setIsAltering(true);
      const mode = activeTab === "image" ? "image" : "video";

      // Save current state before alteration
      addToHistory(prompt);

      const altered = await alterPrompt(prompt, instruction, mode, promptMode);
      setPrompt(altered);
      if (!instructionOverride) {
        setAlterInstruction("");
      }

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
      // === DEFERRED UPLOADS: Upload files that haven't been uploaded yet ===
      setStatus("Preparing files...");

      // Upload start frame if it has a file but no URL
      let uploadedStartFrameUrl = startFrame.url;
      if (startFrame.file && !startFrame.url) {
        try {
          uploadedStartFrameUrl = await uploadToFal(startFrame.file);
          setStartFrame((prev) => ({
            ...prev,
            url: uploadedStartFrameUrl,
            createdAt: Date.now(),
          }));
        } catch (error) {
          console.error("Failed to upload start frame:", error);
          setStatus("Failed to upload start frame. Please try again.");
          setIsSubmitting(false);
          setTimeout(() => setStatus(null), 3000);
          return;
        }
      }

      // Upload end frame if it has a file but no URL
      let uploadedEndFrameUrl = endFrame.url;
      if (endFrame.file && !endFrame.url) {
        try {
          uploadedEndFrameUrl = await uploadToFal(endFrame.file);
          setEndFrame((prev) => ({
            ...prev,
            url: uploadedEndFrameUrl,
            createdAt: Date.now(),
          }));
        } catch (error) {
          console.error("Failed to upload end frame:", error);
          setStatus("Failed to upload end frame. Please try again.");
          setIsSubmitting(false);
          setTimeout(() => setStatus(null), 3000);
          return;
        }
      }

      // Upload reference images that have files but no URLs
      // Use standardized filenames (image_1.jpg, image_2.jpg, etc.) so models can understand reference order
      const uploadedReferenceUrls: string[] = [];
      let refIndex = 1;
      for (const ref of referenceUploads) {
        if (ref.file && !ref.url) {
          try {
            // Get file extension from original file or default to jpg
            const ext = ref.file.name.split('.').pop()?.toLowerCase() || 'jpg';
            const standardizedName = `image_${refIndex}.${ext}`;
            const uploadedUrl = await uploadToFal(ref.file, standardizedName);
            uploadedReferenceUrls.push(uploadedUrl);
            setReferenceUploads((prev) =>
              prev.map((item) =>
                item.id === ref.id
                  ? { ...item, url: uploadedUrl, createdAt: Date.now() }
                  : item
              )
            );
            refIndex++;
          } catch (error) {
            console.error(`Failed to upload reference ${ref.name}:`, error);
            // Continue with other references, skip failed ones
          }
        } else if (ref.url) {
          uploadedReferenceUrls.push(ref.url);
          refIndex++;
        }
      }

      setStatus(null);
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

        // Use freshly uploaded URLs (deferred upload)
        const startFrameUrl = supportsStartFrame !== false ? uploadedStartFrameUrl : undefined;
        const endFrameUrl = supportsEndFrame === true ? uploadedEndFrameUrl : undefined;

        // For video models, use uploaded video reference URLs
        const videoRefUrls = modelKind === "video" && referenceLimit > 0
          ? uploadedReferenceUrls.slice(0, referenceLimit)
          : [];

        const unifiedPayload: UnifiedPayload = {
          modelId,
          prompt,
          aspect_ratio: aspectRatio,
          resolution: imageResolution,
          start_frame_url: startFrameUrl,
          end_frame_url: endFrameUrl,
          reference_image_urls: videoRefUrls,
          seed: randomizeSeed ? Math.floor(Math.random() * 100000) : 1569,
          duration: paramValues.duration as string | number | undefined,
          generate_audio: paramValues.generate_audio as boolean | undefined,
          character_id_list: paramValues.character_id_list as string[] | undefined,
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

        // Use freshly uploaded reference URLs for image models
        const imageRefUrls = modelKind === "image" && (selectedImage?.maxRefs ?? 0) !== 0
          ? uploadedReferenceUrls.slice(0, Math.min(selectedImage?.maxRefs ?? 5, 5))
          : [];

        // Transform @img1, @img2, etc. references in prompt to image_1, image_2, etc.
        let processedPrompt = prompt.trim();
        for (let i = 1; i <= imageRefUrls.length; i++) {
          // Replace @img1 -> image_1, @img2 -> image_2, etc. (case insensitive)
          processedPrompt = processedPrompt.replace(new RegExp(`@img${i}\\b`, 'gi'), `image_${i}`);
        }

        const imageJob = {
          prompt: processedPrompt,
          imageUrls: imageRefUrls,
          aspectRatio,
          seed: randomizeSeed ? Math.floor(Math.random() * 100000) : 1569,
          imageResolution: imageModelSpec.ui?.resolutions ? imageResolution : undefined,
          maxImages: parsedMaxImages,
          numImages: parsedMaxImages,
        };

        payload = imageModelSpec.mapInput(imageJob);

      } else if (selectedSpecial) {
        // Handle special models (V2V, T2V/I2V like Sora 2)
        endpoint = selectedSpecial.endpoint;
        category = "video"; // All special models output video
        provider = selectedSpecial.provider as ModelProvider;
        callOptions = selectedSpecial.taskConfig ? { taskConfig: selectedSpecial.taskConfig } : undefined;

        if (selectedSpecial.inputType === "video") {
          // V2V models - require video input
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
        } else if (selectedSpecial.inputType === "image") {
          // T2V/I2V models like Sora 2 - optional image input

          // Upload start frame if present but not yet uploaded
          // Note: reusing outer uploadedStartFrameUrl variable
          uploadedStartFrameUrl = startFrame.url;
          if (startFrame.file && !startFrame.url) {
            try {
              uploadedStartFrameUrl = await uploadToFal(startFrame.file);
              setStartFrame((prev) => ({
                ...prev,
                url: uploadedStartFrameUrl,
                createdAt: Date.now(),
              }));
            } catch (error) {
              console.error("Failed to upload start frame:", error);
              setStatus("Failed to upload start frame. Please try again.");
              setIsSubmitting(false);
              setTimeout(() => setStatus(null), 3000);
              return;
            }
          }

          const specialPayload = buildSpecialModelInput(selectedSpecial, {
            modelId: selectedSpecial.id,
            prompt: prompt.trim(),
            start_frame_url: uploadedStartFrameUrl,
            duration: paramValues.duration as string | undefined,
            aspect_ratio: paramValues.aspect_ratio as string | undefined,
            character_id_list: paramValues.character_id_list as string[] | undefined,
          });

          payload = specialPayload;
        } else if (selectedSpecial.inputType === "both") {
          // Models that require both image and video (e.g., Motion Control)

          // Upload start frame if present but not yet uploaded
          // Note: reusing outer uploadedStartFrameUrl variable
          uploadedStartFrameUrl = startFrame.url;
          if (startFrame.file && !startFrame.url) {
            try {
              uploadedStartFrameUrl = await uploadToFal(startFrame.file);
              setStartFrame((prev) => ({
                ...prev,
                url: uploadedStartFrameUrl,
                createdAt: Date.now(),
              }));
            } catch (error) {
              console.error("Failed to upload image:", error);
              setStatus("Failed to upload image. Please try again.");
              setIsSubmitting(false);
              setTimeout(() => setStatus(null), 3000);
              return;
            }
          }

          if (!uploadedStartFrameUrl) {
            throw new Error("Please upload an image.");
          }

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
            throw new Error("Please upload a video.");
          }

          const specialPayload = buildSpecialModelInput(selectedSpecial, {
            modelId: selectedSpecial.id,
            prompt: prompt.trim(),
            start_frame_url: uploadedStartFrameUrl,
            video_urls: validVideoUrls,
            character_orientation: paramValues.character_orientation as string | undefined,
            mode: paramValues.mode as string | undefined,
          });

          payload = specialPayload;
        } else if (selectedSpecial.inputType === "references") {
          // Reference models like Kling O1 Reference - multi-ref + elements
          // Files are stored locally until Generate is pressed, now upload them

          setStatus("Uploading reference images...");

          // Upload reference style images that have files but no URLs
          const uploadedImageUrls: string[] = [];
          for (const img of referenceStyleImages) {
            if (img.file && !img.url) {
              try {
                const uploadedUrl = await uploadToFal(img.file);
                uploadedImageUrls.push(uploadedUrl);
                setReferenceStyleImages((prev) => prev.map((i) => i.id === img.id ? { ...i, url: uploadedUrl, uploading: false } : i));
              } catch (error) {
                console.error(`Failed to upload reference image:`, error);
                // Skip failed uploads
              }
            } else if (img.url) {
              uploadedImageUrls.push(img.url);
            }
          }

          setStatus("Uploading elements...");

          // Upload element images that have files but no URLs
          const uploadedElements: Array<{ frontal_image_url: string; reference_image_urls: string[] }> = [];
          for (const el of elements) {
            // Upload frontal image
            let frontalUrl = el.frontalUrl;
            if (el.frontalFile && !el.frontalUrl) {
              try {
                frontalUrl = await uploadToFal(el.frontalFile);
                setElements((prev) => prev.map((e) => e.id === el.id ? { ...e, frontalUrl, frontalUploading: false } : e));
              } catch (error) {
                console.error(`Failed to upload element frontal:`, error);
                continue; // Skip this element entirely
              }
            }

            if (!frontalUrl) continue;

            // Upload element reference images
            const refUrls: string[] = [];
            for (const ref of el.referenceImages) {
              if (ref.file && !ref.url) {
                try {
                  const uploadedUrl = await uploadToFal(ref.file);
                  refUrls.push(uploadedUrl);
                  setElements((prev) => prev.map((e) => e.id === el.id ? {
                    ...e,
                    referenceImages: e.referenceImages.map((r) => r.id === ref.id ? { ...r, url: uploadedUrl, uploading: false } : r)
                  } : e));
                } catch (error) {
                  console.error(`Failed to upload element reference:`, error);
                  // Skip failed reference
                }
              } else if (ref.url) {
                refUrls.push(ref.url);
              }
            }

            uploadedElements.push({
              frontal_image_url: frontalUrl,
              reference_image_urls: refUrls,
            });
          }

          setStatus(null);

          const specialPayload = buildSpecialModelInput(selectedSpecial, {
            modelId: selectedSpecial.id,
            prompt: prompt.trim(),
            image_urls: uploadedImageUrls,
            elements: uploadedElements,
            duration: paramValues.duration as string | undefined,
            aspect_ratio: paramValues.aspect_ratio as string | undefined,
          });

          // For fal-client provider, use just the input part since callFalSubscribe wraps it
          // For kie provider, use the full payload structure
          payload = selectedSpecial.provider === "fal-client" ? specialPayload.input : specialPayload;
        } else if (selectedSpecial.inputType === "kling-v3") {
          // Kling V3 Pro - Start/End frames + Elements + Multishot
          setStatus("Uploading frames...");

          // Upload start frame if needed
          let uploadedStartFrameUrl = startFrame.url;
          if (startFrame.file && !startFrame.url) {
            try {
              uploadedStartFrameUrl = await uploadToFal(startFrame.file);
              setStartFrame((prev) => ({ ...prev, url: uploadedStartFrameUrl, createdAt: Date.now() }));
            } catch (error) {
              console.error("Failed to upload start frame:", error);
              setStatus("Failed to upload start frame");
              setIsSubmitting(false);
              return;
            }
          }

          // Upload end frame if needed
          let uploadedEndFrameUrl = endFrame.url;
          if (endFrame.file && !endFrame.url) {
            try {
              uploadedEndFrameUrl = await uploadToFal(endFrame.file);
              setEndFrame((prev) => ({ ...prev, url: uploadedEndFrameUrl, createdAt: Date.now() }));
            } catch (error) {
              console.error("Failed to upload end frame:", error);
              setStatus("Failed to upload end frame");
              setIsSubmitting(false);
              return;
            }
          }

          setStatus("Processing elements...");

          // Process elements from Elements Manager
          const uploadedElements: Array<{
            frontal_image_url?: string;
            reference_image_urls?: string[];
            video_url?: string;
          }> = [];

          // Build full URL helper  
          const buildElementUrl = (path: string): string => {
            if (path.startsWith("http")) return path;
            const API_BASE = import.meta.env.VITE_FILE_API_BASE ?? "http://localhost:8787";
            const API_TOKEN = import.meta.env.VITE_FILE_API_TOKEN;
            const url = new URL(`${API_BASE}${path}`);
            if (API_TOKEN) {
              url.searchParams.set("token", API_TOKEN);
            }
            return url.toString();
          };

          // Process selected elements from Elements Manager - UPLOAD TO FAL
          for (const selectedEl of elementsState.selectedElements) {
            const el = selectedEl.element;

            if (selectedEl.mode === "video" && el.videoReferenceUrl) {
              // Upload video to FAL
              setStatus(`Uploading video element: ${el.name}...`);
              const videoUrl = buildElementUrl(el.videoReferenceUrl);
              try {
                const response = await fetch(videoUrl);
                const videoBlob = await response.blob();
                // Convert Blob to File for uploadToFal
                const videoFile = new File([videoBlob], `${el.name}_video.mp4`, { type: videoBlob.type });
                const uploadedVideoUrl = await uploadToFal(videoFile);
                uploadedElements.push({ video_url: uploadedVideoUrl });
              } catch (error) {
                console.error(`Failed to upload element video ${el.name}:`, error);
                setStatus(`Failed to upload video for ${el.name}`);
                setIsSubmitting(false);
                setTimeout(() => setStatus(null), 3000);
                return;
              }
            } else {
              // Upload frontal + reference images to FAL
              setStatus(`Uploading images for element: ${el.name}...`);
              try {
                // Upload frontal image
                const frontalUrl = buildElementUrl(el.frontalImageUrl);
                const frontalResponse = await fetch(frontalUrl);
                const frontalBlob = await frontalResponse.blob();
                const frontalFile = new File([frontalBlob], `${el.name}_frontal.png`, { type: frontalBlob.type });
                const uploadedFrontalUrl = await uploadToFal(frontalFile);

                // Upload reference images
                const uploadedRefUrls: string[] = [];
                if (el.referenceImageUrls?.length > 0) {
                  for (const refUrl of el.referenceImageUrls) {
                    const refFullUrl = buildElementUrl(refUrl);
                    const refResponse = await fetch(refFullUrl);
                    const refBlob = await refResponse.blob();
                    const refFile = new File([refBlob], `${el.name}_ref.png`, { type: refBlob.type });
                    const uploadedRefUrl = await uploadToFal(refFile);
                    uploadedRefUrls.push(uploadedRefUrl);
                  }
                }

                uploadedElements.push({
                  frontal_image_url: uploadedFrontalUrl,
                  reference_image_urls: uploadedRefUrls,
                });
              } catch (error) {
                console.error(`Failed to upload element images ${el.name}:`, error);
                setStatus(`Failed to upload images for ${el.name}`);
                setIsSubmitting(false);
                setTimeout(() => setStatus(null), 3000);
                return;
              }
            }
          }

          setStatus(null);

          // Build multi_prompt if useMultishot is true and multishotPrompts has items
          const multiPrompt = useMultishot && multishotPrompts.length > 0
            ? multishotPrompts.map((shot) => ({ prompt: shot.prompt, duration: String(shot.duration) }))
            : undefined;

          const specialPayload = buildSpecialModelInput(selectedSpecial, {
            modelId: selectedSpecial.id,
            prompt: prompt.trim(),
            start_frame_url: uploadedStartFrameUrl,
            end_frame_url: uploadedEndFrameUrl,
            elements: uploadedElements,
            duration: paramValues.duration as string | undefined,
            aspect_ratio: paramValues.aspect_ratio as string | undefined,
            generate_audio: paramValues.generate_audio as boolean | undefined,
            multi_prompt: multiPrompt,
          });

          payload = selectedSpecial.provider === "fal-client" ? specialPayload.input : specialPayload;
        }


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
    <form ref={formRef} className="flex h-full flex-col text-sm" onSubmit={handleGenerate}>
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
                  ref={imagePromptTextareaRef}
                  value={prompt}
                  onChange={(event) => {
                    const newValue = event.target.value;
                    setPrompt(newValue);

                    // Check if we should show autocomplete (typing @)
                    const cursorPos = event.target.selectionStart;
                    const textBefore = newValue.slice(0, cursorPos);
                    const atMatch = textBefore.match(/@([a-zA-Z0-9]*)$/);

                    if (atMatch && referenceUploads.filter(r => r.file || r.url).length > 0) {
                      setShowAutocomplete(true);
                      setAutocompleteIndex(0);
                    } else {
                      setShowAutocomplete(false);
                    }
                  }}
                  onBlur={() => {
                    addToHistory(prompt);
                    setTimeout(() => setShowAutocomplete(false), 150);
                  }}
                  onKeyDown={(event) => {
                    if (showAutocomplete) {
                      const imgCount = referenceUploads.filter(r => r.file || r.url).length;
                      const options: string[] = [];
                      for (let i = 1; i <= imgCount; i++) options.push(`@img${i}`);

                      if (options.length > 0) {
                        if (event.key === "ArrowDown") {
                          event.preventDefault();
                          setAutocompleteIndex((prev) => (prev + 1) % options.length);
                          return;
                        }
                        if (event.key === "ArrowUp") {
                          event.preventDefault();
                          setAutocompleteIndex((prev) => (prev - 1 + options.length) % options.length);
                          return;
                        }
                        if (event.key === "Enter" || event.key === "Tab") {
                          event.preventDefault();
                          const selected = options[autocompleteIndex];
                          const textarea = event.target as HTMLTextAreaElement;
                          const cursorPos = textarea.selectionStart;
                          const textBefore = prompt.slice(0, cursorPos);
                          const atMatch = textBefore.match(/@([a-zA-Z0-9]*)$/);
                          if (atMatch) {
                            const before = textBefore.slice(0, -atMatch[0].length);
                            const after = prompt.slice(cursorPos);
                            const newPrompt = before + selected + " " + after;
                            setPrompt(newPrompt);
                            setShowAutocomplete(false);
                            setTimeout(() => {
                              const newPos = before.length + selected.length + 1;
                              textarea.setSelectionRange(newPos, newPos);
                            }, 0);
                          }
                          return;
                        }
                        if (event.key === "Escape") {
                          event.preventDefault();
                          setShowAutocomplete(false);
                          return;
                        }
                      }
                    }
                  }}
                  placeholder="Type @ to reference uploaded images (e.g., @img1)..."
                  rows={6}
                  disabled={isSubmitting || isExpanding}
                  className={`w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-3 text-sm text-white outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 pb-10 ${isSubmitting || isExpanding ? "opacity-50 cursor-not-allowed" : ""}`}
                />

                {/* Autocomplete popup for image references */}
                {showAutocomplete && (() => {
                  const imgCount = referenceUploads.filter(r => r.file || r.url).length;
                  if (imgCount === 0) return null;

                  const options = referenceUploads.filter(r => r.file || r.url).map((r, idx) => ({
                    label: `@img${idx + 1}`,
                    preview: r.preview,
                    name: r.name
                  }));

                  return (
                    <div className="absolute left-3 top-full mt-1 z-50 rounded-lg border border-white/20 bg-slate-900 shadow-xl overflow-hidden max-w-[280px]">
                      {options.map((opt, idx) => (
                        <button
                          key={opt.label}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            const textarea = imagePromptTextareaRef.current;
                            if (!textarea) return;
                            const cursorPos = textarea.selectionStart;
                            const textBefore = prompt.slice(0, cursorPos);
                            const atMatch = textBefore.match(/@([a-zA-Z0-9]*)$/);
                            if (atMatch) {
                              const before = textBefore.slice(0, -atMatch[0].length);
                              const after = prompt.slice(cursorPos);
                              const newPrompt = before + opt.label + " " + after;
                              setPrompt(newPrompt);
                              setShowAutocomplete(false);
                            }
                          }}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition ${idx === autocompleteIndex ? "bg-sky-500/30 text-white" : "text-slate-300 hover:bg-white/10"}`}
                        >
                          <img src={opt.preview} alt={opt.name} className="h-6 w-6 rounded object-cover" />
                          <span className="font-medium text-sky-300">{opt.label}</span>
                          <span className="truncate text-xs text-slate-500">{opt.name}</span>
                        </button>
                      ))}
                    </div>
                  );
                })()}
                <div className="absolute bottom-2 left-2 flex gap-1">
                  <button
                    type="button"
                    onClick={() => setShowPromptStudio(true)}
                    disabled={isExpanding || isSubmitting}
                    className="flex h-7 w-9 items-center justify-center rounded-md border border-purple-500/30 bg-purple-500/20 text-purple-200 transition hover:bg-purple-500/40 hover:text-white disabled:opacity-50"
                    title="Open Photography Prompt Studio"
                  >
                    <span className="text-lg">🔭</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBatchModal(true)}
                    disabled={isExpanding || isSubmitting || isBatchProcessing}
                    className="flex h-7 w-9 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/20 text-amber-200 transition hover:bg-amber-500/40 hover:text-white disabled:opacity-50"
                    title="Batch Prompt Input"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                      <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                    </svg>
                  </button>
                </div>
                <div className="absolute bottom-2 right-2 flex gap-1">
                  <button
                    type="button"
                    onClick={undo}
                    disabled={historyIndex <= 0 || isSubmitting || isExpanding}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-rose-500/30 bg-rose-500/20 text-rose-200 transition hover:bg-rose-500/30 hover:text-white disabled:opacity-30 disabled:hover:bg-rose-500/20"
                    title="Undo"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></svg>
                  </button>
                  <button
                    type="button"
                    onClick={redo}
                    disabled={historyIndex >= history.length - 1 || isSubmitting || isExpanding}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-rose-500/30 bg-rose-500/20 text-rose-200 transition hover:bg-rose-500/30 hover:text-white disabled:opacity-30 disabled:hover:bg-rose-500/20"
                    title="Redo"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" /></svg>
                  </button>
                  <div className="w-px bg-white/10 mx-1" />
                  <button
                    type="button"
                    onClick={() => setImagePromptMode((prev) =>
                      prev === "photoreal" ? "editing" : prev === "editing" ? "general" : "photoreal"
                    )}
                    disabled={isExpanding}
                    className={`flex h-7 w-7 items-center justify-center rounded-md border transition disabled:opacity-50 ${imagePromptMode === "photoreal"
                      ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/40 hover:text-white"
                      : imagePromptMode === "editing"
                        ? "border-cyan-500/30 bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/40 hover:text-white"
                        : "border-amber-500/30 bg-amber-500/20 text-amber-200 hover:bg-amber-500/40 hover:text-white"
                      }`}
                    title={`Current Mode: ${imagePromptMode === "photoreal" ? "Photorealistic (Camera Aware)"
                      : imagePromptMode === "editing" ? "Editing (Angle/Modify)"
                        : "General (Creative)"
                      }`}
                  >
                    {imagePromptMode === "photoreal" ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></svg>
                    ) : imagePromptMode === "editing" ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /><path d="M3 9h6" /></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                    )}
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

          </div>
        ) : null}

        {/* VIDEO CONTROLS */}
        {modelKind === "video" ? (
          <div className="space-y-2">
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

            {/* Upload Expiration Warning */}
            {supportsStartFrame && startFrame.url && startFrame.createdAt && (
              (() => {
                const ageMs = Date.now() - startFrame.createdAt;
                const remainingMs = UPLOAD_URL_TTL_MS - ageMs;
                const remainingMins = Math.floor(remainingMs / 60000);
                if (remainingMins <= 10 && remainingMins > 0) {
                  return (
                    <div className="text-xs text-amber-400 flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      Upload expires in ~{remainingMins} min. Re-upload if generation takes longer.
                    </div>
                  );
                }
                if (remainingMs <= 0) {
                  return (
                    <div className="text-xs text-red-400 flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      Upload expired. Please re-upload the start frame.
                    </div>
                  );
                }
                return null;
              })()
            )}

            {/* Prompt */}
            <div className="space-y-1">

              <div className="relative">
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  onBlur={() => addToHistory(prompt)}
                  rows={4}
                  disabled={isSubmitting || isExpanding}
                  className={`w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 pb-10 ${isSubmitting || isExpanding ? "opacity-50 cursor-not-allowed" : ""}`}
                />
                <div className="absolute bottom-2 right-2 flex gap-1">
                  <button
                    type="button"
                    onClick={undo}
                    disabled={historyIndex <= 0 || isSubmitting || isExpanding}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-rose-500/30 bg-rose-500/20 text-rose-200 transition hover:bg-rose-500/30 hover:text-white disabled:opacity-30 disabled:hover:bg-rose-500/20"
                    title="Undo"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></svg>
                  </button>
                  <button
                    type="button"
                    onClick={redo}
                    disabled={historyIndex >= history.length - 1 || isSubmitting || isExpanding}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-rose-500/30 bg-rose-500/20 text-rose-200 transition hover:bg-rose-500/30 hover:text-white disabled:opacity-30 disabled:hover:bg-rose-500/20"
                    title="Redo"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" /></svg>
                  </button>
                  <div className="w-px bg-white/10 mx-1" />

                  {/* Prompt Mode Toggle - 3 modes for video: photoreal, audiogen, timestep */}
                  <button
                    type="button"
                    onClick={() => setVideoPromptMode((prev) =>
                      prev === "photoreal" ? "audiogen" : prev === "audiogen" ? "timestep" : "photoreal"
                    )}
                    disabled={isExpanding}
                    className={`flex h-7 w-7 items-center justify-center rounded-md border transition disabled:opacity-50 ${videoPromptMode === "photoreal"
                      ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/40 hover:text-white"
                      : videoPromptMode === "audiogen"
                        ? "border-purple-500/30 bg-purple-500/20 text-purple-200 hover:bg-purple-500/40 hover:text-white"
                        : "border-amber-500/30 bg-amber-500/20 text-amber-200 hover:bg-amber-500/40 hover:text-white"
                      }`}
                    title={`Current Mode: ${videoPromptMode === "photoreal"
                      ? "Photorealistic (Camera Aware)"
                      : videoPromptMode === "audiogen"
                        ? "Audio-Gen (Sound Aware)"
                        : "Timestep (Beat-by-Beat)"
                      }`}
                  >
                    {videoPromptMode === "photoreal" ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></svg>
                    ) : videoPromptMode === "audiogen" ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 10v3" /><path d="M6 6v11" /><path d="M10 3v18" /><path d="M14 8v7" /><path d="M18 5v13" /><path d="M22 10v3" /></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
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
                </div>
                {/* Camera Movement Selector Button (Bottom Left) */}
                {/* Camera Movement Selector Button (Bottom Left) */}
                <div className="absolute bottom-2 left-2">
                  <button
                    type="button"
                    onClick={() => setShowCameraSelector(!showCameraSelector)}
                    disabled={isSubmitting || isExpanding}
                    className={`flex h-7 w-9 items-center justify-center rounded-md border transition ${showCameraSelector
                      ? "border-sky-500 bg-sky-500/40 text-white"
                      : "border-sky-500/30 bg-sky-500/20 text-sky-200 hover:bg-sky-500/40 hover:text-white"
                      } disabled:opacity-50`}
                    title="Add Camera Movement"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8Z" /><rect width="14" height="12" x="2" y="6" rx="2" ry="2" /></svg>
                  </button>

                  {/* Camera Selector Popover */}
                  {showCameraSelector && (
                    <div className="absolute top-full left-0 mt-2 z-50">
                      <CameraMovementSelector
                        onSelect={(text: string) => {
                          const instruction = `Rewrite the prompt to completely REPLACE any existing camera movement with this one: "${text}". Keep the rest of the visual details intact.`;
                          void handleAlter(instruction);
                          setShowCameraSelector(false);
                        }}
                        onClose={() => setShowCameraSelector(false)}
                      />
                    </div>
                  )}
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

                {/* Aspect Ratio - next to Duration */}
                {(selectedVideo?.params?.aspect_ratio || selectedVideo?.params?.aspectRatio) && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Aspect ratio
                    </label>
                    <select
                      value={aspectRatio}
                      onChange={(event) => setAspectRatio(event.target.value)}
                      disabled={isSubmitting || isExpanding}
                      className={`w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 ${isSubmitting || isExpanding ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      {(selectedVideo?.params?.aspect_ratio?.values ?? selectedVideo?.params?.aspectRatio?.values ?? []).map((val) => (
                        <option key={String(val)} value={String(val)}>
                          {String(val)}
                        </option>
                      ))}
                    </select>
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

            {/* Resolution for Video - separate row below */}
            {selectedVideo?.params?.resolution && (
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Resolution
                </label>
                <select
                  value={imageResolution}
                  onChange={(event) => setImageResolution(event.target.value)}
                  disabled={isSubmitting || isExpanding}
                  className={`w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 ${isSubmitting || isExpanding ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {selectedVideo?.params?.resolution?.values?.map((val) => (
                    <option key={String(val)} value={String(val)}>
                      {String(val)}
                    </option>
                  ))}
                </select>
              </div>
            )}

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
            {/* Video Input for V2V models */}
            {selectedSpecial.inputType === "video" && (
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
            )}

            {/* Image Input for Sora 2 and similar T2V/I2V models */}
            {selectedSpecial.inputType === "image" && (
              <div className="space-y-3">
                {/* Start Frame Upload */}
                {selectedSpecial.imageInputConfig?.startFrame && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Start Frame (optional)
                    </label>
                    <UploadZone
                      label="Start frame"
                      accept="image/*"
                      slot={startFrame}
                      onFile={handleStartFrameSelect}
                      extractFiles={extractFilesFromDataTransfer}
                    />
                  </div>
                )}

                {/* Aspect Ratio (for Sora 2) */}
                {selectedSpecial.params.aspect_ratio && selectedSpecial.params.aspect_ratio.values && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Aspect Ratio
                    </label>
                    <select
                      value={paramValues.aspect_ratio === undefined ? String(selectedSpecial.params.aspect_ratio.default ?? selectedSpecial.params.aspect_ratio.values[0]) : String(paramValues.aspect_ratio)}
                      onChange={(event) => handleParamChange("aspect_ratio", event.target.value)}
                      disabled={isSubmitting || isExpanding}
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                    >
                      {selectedSpecial.params.aspect_ratio.values.map((val) => (
                        <option key={String(val)} value={String(val)}>
                          {String(val)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Character IDs (for Sora 2) */}
                {selectedSpecial.params.character_id_list && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Character IDs
                    </label>
                    <input
                      type="text"
                      placeholder="Enter comma-separated character IDs (max 5)"
                      value={Array.isArray(paramValues.character_id_list) ? (paramValues.character_id_list as string[]).join(", ") : ""}
                      onChange={(event) => {
                        const inputValue = event.target.value;
                        if (inputValue.trim() === "") {
                          handleParamChange("character_id_list", undefined);
                        } else {
                          const values = inputValue.split(",").map((v) => v.trim()).filter(Boolean);
                          handleParamChange("character_id_list", values);
                        }
                      }}
                      disabled={isSubmitting || isExpanding}
                      className={`w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 ${isSubmitting || isExpanding ? "opacity-50 cursor-not-allowed" : ""}`}
                    />
                    <p className="text-[10px] text-slate-500">Create characters at kie.ai/sora-2?model=sora-2-characters</p>
                  </div>
                )}
              </div>
            )}

            {/* Both Image + Video Input (e.g., Kling Motion Control) */}
            {selectedSpecial.inputType === "both" && (
              <div className="space-y-3">
                {/* Image Upload */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Person Image (required)
                  </label>
                  <UploadZone
                    label="Upload image"
                    accept="image/*"
                    slot={startFrame}
                    onFile={handleStartFrameSelect}
                    extractFiles={extractFilesFromDataTransfer}
                  />
                </div>

                {/* Video Upload */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Motion Video (required)
                  </label>
                  <div
                    className={`relative flex min-h-[80px] flex-col justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-transparent p-3 transition ${isReferenceDragActive ? "border-sky-400 shadow-lg shadow-sky-500/20" : "hover:border-white/20"}`}
                    onDragEnter={(e) => { e.preventDefault(); setIsReferenceDragActive(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setIsReferenceDragActive(false); }}
                    onDragOver={(e) => { e.preventDefault(); setIsReferenceDragActive(true); }}
                    onDrop={async (e) => {
                      e.preventDefault();
                      setIsReferenceDragActive(false);
                      const files = await extractFilesFromDataTransfer(e.dataTransfer);
                      const videoFile = files.find((f) => f.type.startsWith("video/"));
                      if (videoFile && videoInputUploads.length < 1) {
                        const entryId = crypto.randomUUID();
                        const preview = URL.createObjectURL(videoFile);
                        setVideoInputUploads([{ id: entryId, name: videoFile.name, preview, uploading: true }]);
                        try {
                          const url = await uploadToFal(videoFile);
                          setVideoInputUploads((prev) => prev.map((item) => item.id === entryId ? { ...item, url, uploading: false, createdAt: Date.now() } : item));
                        } catch {
                          setVideoInputUploads((prev) => prev.map((item) => item.id === entryId ? { ...item, uploading: false, error: "Upload failed" } : item));
                        }
                      }
                    }}
                  >
                    {videoInputUploads.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-2 text-center">
                        <div className="mb-1 text-xl">🎬</div>
                        <div className="text-xs text-slate-400">
                          Drag and drop a video file
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {videoInputUploads.map((entry) => (
                          <div key={entry.id} className="relative h-12 w-16 overflow-hidden rounded bg-black/30 group">
                            <video src={entry.preview} className="h-full w-full object-cover" muted />
                            {entry.uploading && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/50"><Spinner size="sm" /></div>
                            )}
                            <button
                              type="button"
                              onClick={() => setVideoInputUploads([])}
                              className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white opacity-0 hover:bg-rose-500 group-hover:opacity-100"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Character Orientation */}
                {selectedSpecial.params.character_orientation && selectedSpecial.params.character_orientation.values && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Orientation</label>
                    <select
                      value={paramValues.character_orientation === undefined ? String(selectedSpecial.params.character_orientation.default) : String(paramValues.character_orientation)}
                      onChange={(event) => handleParamChange("character_orientation", event.target.value)}
                      disabled={isSubmitting || isExpanding}
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                    >
                      {selectedSpecial.params.character_orientation.values.map((val) => (
                        <option key={String(val)} value={String(val)}>{String(val)}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Mode (720p/1080p) */}
                {selectedSpecial.params.mode && selectedSpecial.params.mode.values && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Resolution</label>
                    <select
                      value={paramValues.mode === undefined ? String(selectedSpecial.params.mode.default) : String(paramValues.mode)}
                      onChange={(event) => handleParamChange("mode", event.target.value)}
                      disabled={isSubmitting || isExpanding}
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                    >
                      {selectedSpecial.params.mode.values.map((val) => (
                        <option key={String(val)} value={String(val)}>{String(val)}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* References Input (Kling O1 Reference) */}
            {selectedSpecial.inputType === "references" && (
              <div className="space-y-4">
                {/* Reference Images for Style */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Reference Images (style/appearance)
                  </label>
                  <p className="text-[10px] text-slate-500">Use @Image1, @Image2, etc. in prompt</p>
                  <div
                    className={`flex flex-wrap gap-2 min-h-[56px] rounded-lg p-1 transition ${isReferenceDragActive ? "bg-sky-500/10 ring-1 ring-sky-400" : ""}`}
                    onDragEnter={(e) => { e.preventDefault(); setIsReferenceDragActive(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setIsReferenceDragActive(false); }}
                    onDragOver={(e) => { e.preventDefault(); setIsReferenceDragActive(true); }}
                    onDrop={async (e) => {
                      e.preventDefault();
                      setIsReferenceDragActive(false);
                      const files = await extractFilesFromDataTransfer(e.dataTransfer);
                      const imageFiles = files.filter((f) => f.type.startsWith("image/"));
                      for (const file of imageFiles) {
                        if (referenceStyleImages.length >= 7) break;
                        const id = crypto.randomUUID();
                        const preview = URL.createObjectURL(file);
                        // Store file locally - upload on Generate
                        setReferenceStyleImages((prev) => [...prev, { id, preview, file, uploading: false }]);
                      }
                    }}
                  >
                    {referenceStyleImages.map((img, idx) => (
                      <div key={img.id} className="relative h-12 w-12 overflow-hidden rounded border border-white/10 group">
                        <img src={img.preview} alt={`Image ${idx + 1}`} className="h-full w-full object-cover" />
                        {img.uploading && <div className="absolute inset-0 flex items-center justify-center bg-black/50"><Spinner size="sm" /></div>}
                        <div className="absolute bottom-0 left-0 bg-black/70 px-1 text-[9px] text-white">@Image{idx + 1}</div>
                        <button
                          type="button"
                          onClick={() => setReferenceStyleImages((prev) => prev.filter((i) => i.id !== img.id))}
                          className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white opacity-0 hover:bg-rose-500 group-hover:opacity-100"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                        </button>
                      </div>
                    ))}
                    {referenceStyleImages.length < 7 && (
                      <label className="flex h-12 w-12 cursor-pointer items-center justify-center rounded border border-dashed border-white/20 text-slate-400 hover:border-sky-400 hover:text-sky-400">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const id = crypto.randomUUID();
                          const preview = URL.createObjectURL(file);
                          // Store file locally - upload on Generate
                          setReferenceStyleImages((prev) => [...prev, { id, preview, file, uploading: false }]);
                          e.target.value = "";
                        }} />
                      </label>
                    )}
                  </div>
                </div>

                {/* Elements */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Elements (characters/objects)
                  </label>
                  <p className="text-[10px] text-slate-500">Use @Element1, @Element2, etc. in prompt. Each needs a frontal image.</p>
                  {elements.map((el, elIdx) => (
                    <div key={el.id} className="rounded-lg border border-white/10 bg-white/5 p-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-300">@Element{elIdx + 1}</span>
                        <button type="button" onClick={() => setElements((prev) => prev.filter((e) => e.id !== el.id))} className="text-xs text-rose-400 hover:text-rose-300">Remove</button>
                      </div>
                      <div className="flex items-start gap-2">
                        {/* Frontal */}
                        {(el.frontalUrl || el.frontalFile || el.frontalPreview) ? (
                          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded border border-white/10 group">
                            <img src={el.frontalPreview} className="h-full w-full object-cover" alt="Frontal" />
                            {el.frontalUploading && <div className="absolute inset-0 flex items-center justify-center bg-black/50"><Spinner size="sm" /></div>}
                            <div className="absolute bottom-0 left-0 bg-black/70 px-1 text-[8px] text-white">Frontal</div>
                            <button
                              type="button"
                              onClick={() => setElements((prev) => prev.map((elem) => elem.id === el.id ? { ...elem, frontalUrl: undefined, frontalFile: undefined, frontalPreview: "" } : elem))}
                              className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white opacity-0 hover:bg-rose-500 group-hover:opacity-100"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                            </button>
                          </div>
                        ) : (
                          <div
                            className="flex h-14 w-14 shrink-0 cursor-pointer flex-col items-center justify-center rounded border border-dashed border-white/20 text-[9px] text-slate-400 hover:border-sky-400 transition"
                            onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); }}
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.add("border-sky-400", "bg-sky-500/10"); }}
                            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.remove("border-sky-400", "bg-sky-500/10"); }}
                            onDrop={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              e.currentTarget.classList.remove("border-sky-400", "bg-sky-500/10");
                              const files = await extractFilesFromDataTransfer(e.dataTransfer);
                              const imageFile = files.find((f) => f.type.startsWith("image/"));
                              if (imageFile) {
                                const preview = URL.createObjectURL(imageFile);
                                // Store file locally - upload on Generate
                                setElements((prev) => prev.map((elem) => elem.id === el.id ? { ...elem, frontalPreview: preview, frontalFile: imageFile, frontalUploading: false } : elem));
                              }
                            }}
                            onClick={() => {
                              const input = document.createElement("input");
                              input.type = "file";
                              input.accept = "image/*";
                              input.onchange = (e) => {
                                const file = (e.target as HTMLInputElement).files?.[0];
                                if (!file) return;
                                const preview = URL.createObjectURL(file);
                                // Store file locally - upload on Generate
                                setElements((prev) => prev.map((elem) => elem.id === el.id ? { ...elem, frontalPreview: preview, frontalFile: file, frontalUploading: false } : elem));
                              };
                              input.click();
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
                            <span>Frontal</span>
                          </div>
                        )}
                        {/* Reference images for this element */}
                        <div className="flex flex-wrap gap-1">
                          {el.referenceImages.map((ref) => (
                            <div key={ref.id} className="relative h-10 w-10 overflow-hidden rounded border border-white/10 group">
                              <img src={ref.preview} className="h-full w-full object-cover" alt="Ref" />
                              {ref.uploading && <div className="absolute inset-0 flex items-center justify-center bg-black/50"><Spinner size="sm" /></div>}
                              <button type="button" onClick={() => setElements((prev) => prev.map((elem) => elem.id === el.id ? { ...elem, referenceImages: elem.referenceImages.filter((r) => r.id !== ref.id) } : elem))} className="absolute right-0 top-0 flex h-3 w-3 items-center justify-center rounded-full bg-rose-500 text-white opacity-0 group-hover:opacity-100">×</button>
                            </div>
                          ))}
                          {el.referenceImages.length < 3 && (
                            <div
                              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded border border-dashed border-white/10 text-slate-500 hover:border-sky-400 hover:text-sky-400 transition"
                              onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); }}
                              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.add("border-sky-400", "bg-sky-500/10"); }}
                              onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.remove("border-sky-400", "bg-sky-500/10"); }}
                              onDrop={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                e.currentTarget.classList.remove("border-sky-400", "bg-sky-500/10");
                                const files = await extractFilesFromDataTransfer(e.dataTransfer);
                                const imageFile = files.find((f) => f.type.startsWith("image/"));
                                if (imageFile && el.referenceImages.length < 3) {
                                  const refId = crypto.randomUUID();
                                  const preview = URL.createObjectURL(imageFile);
                                  // Store file locally - upload on Generate
                                  setElements((prev) => prev.map((elem) => elem.id === el.id ? { ...elem, referenceImages: [...elem.referenceImages, { id: refId, preview, file: imageFile, uploading: false }] } : elem));
                                }
                              }}
                              onClick={() => {
                                const input = document.createElement("input");
                                input.type = "file";
                                input.accept = "image/*";
                                input.onchange = (e) => {
                                  const file = (e.target as HTMLInputElement).files?.[0];
                                  if (!file) return;
                                  const refId = crypto.randomUUID();
                                  const preview = URL.createObjectURL(file);
                                  // Store file locally - upload on Generate
                                  setElements((prev) => prev.map((elem) => elem.id === el.id ? { ...elem, referenceImages: [...elem.referenceImages, { id: refId, preview, file, uploading: false }] } : elem));
                                };
                                input.click();
                              }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {elements.length < 5 && (
                    <button type="button" onClick={() => setElements((prev) => [...prev, { id: crypto.randomUUID(), frontalPreview: "", frontalUploading: false, referenceImages: [] }])} className="w-full rounded-lg border border-dashed border-white/20 py-2 text-xs text-slate-400 hover:border-sky-400 hover:text-sky-400">
                      + Add Element
                    </button>
                  )}
                </div>



                {/* Aspect Ratio */}
                {selectedSpecial.params.aspect_ratio && selectedSpecial.params.aspect_ratio.values && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Aspect Ratio</label>
                    <select
                      value={paramValues.aspect_ratio === undefined ? String(selectedSpecial.params.aspect_ratio.default) : String(paramValues.aspect_ratio)}
                      onChange={(event) => handleParamChange("aspect_ratio", event.target.value)}
                      disabled={isSubmitting || isExpanding}
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                    >
                      {selectedSpecial.params.aspect_ratio.values.map((val) => (
                        <option key={String(val)} value={String(val)}>{String(val)}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Kling V3 Input */}
            {selectedSpecial.inputType === "kling-v3" && (
              <div className="space-y-4">
                {/* Start/End Frames */}
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
                  <div className="min-w-0 flex-1">
                    <UploadZone
                      label="End frame (optional)"
                      accept="image/*"
                      slot={endFrame}
                      onFile={handleEndFrameSelect}
                      extractFiles={extractFilesFromDataTransfer}
                    />
                  </div>
                </div>

                {/* Elements Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Elements
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        elementsState.setSelectionMode(true);
                        if (!elementsState.isManagerOpen) {
                          elementsState.toggleManager();
                        }
                      }}
                      className="text-xs text-sky-400 hover:text-sky-300"
                    >
                      + Add from Elements
                    </button>
                  </div>
                  {elementsState.selectedElements.length === 0 ? (
                    <p className="text-xs text-slate-500">No elements selected. Click "Add from Elements" to select characters/objects.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {elementsState.selectedElements.map((selectedEl, idx) => (
                        <div key={`${selectedEl.element.id}-${idx}`} className="relative h-14 w-14 overflow-hidden rounded border border-white/10 group">
                          <img
                            src={`${import.meta.env.VITE_FILE_API_BASE ?? "http://localhost:8787"}${selectedEl.element.frontalImageUrl}?token=${import.meta.env.VITE_FILE_API_TOKEN}`}
                            alt={selectedEl.element.name}
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute top-0 left-0 bg-amber-500/80 px-1 text-[8px] text-white font-bold">
                            @{idx + 1}
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1 text-[8px] text-white truncate">
                            {selectedEl.element.name}
                          </div>
                          <button
                            type="button"
                            onClick={() => elementsState.deselectElement(selectedEl.element.id)}
                            className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white opacity-0 hover:bg-rose-500 group-hover:opacity-100"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Duration, Aspect Ratio, Audio Toggle */}
                <div className="grid grid-cols-3 gap-2">
                  {selectedSpecial.params.duration && selectedSpecial.params.duration.values && (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Duration</label>
                      <select
                        value={paramValues.duration === undefined ? String(selectedSpecial.params.duration.default ?? "5") : String(paramValues.duration)}
                        onChange={(event) => handleParamChange("duration", event.target.value)}
                        disabled={isSubmitting || isExpanding}
                        className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                      >
                        {selectedSpecial.params.duration.values.map((val) => (
                          <option key={String(val)} value={String(val)}>{String(val)}s</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {selectedSpecial.params.aspect_ratio && selectedSpecial.params.aspect_ratio.values && (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Aspect Ratio</label>
                      <select
                        value={paramValues.aspect_ratio === undefined ? String(selectedSpecial.params.aspect_ratio.default ?? "16:9") : String(paramValues.aspect_ratio)}
                        onChange={(event) => handleParamChange("aspect_ratio", event.target.value)}
                        disabled={isSubmitting || isExpanding}
                        className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                      >
                        {selectedSpecial.params.aspect_ratio.values.map((val) => (
                          <option key={String(val)} value={String(val)}>{String(val)}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {selectedSpecial.params.generate_audio && (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Audio</label>
                      <button
                        type="button"
                        onClick={() => handleParamChange("generate_audio", !(paramValues.generate_audio ?? selectedSpecial.params.generate_audio?.default ?? true))}
                        disabled={isSubmitting || isExpanding}
                        className={`w-full rounded-lg border px-3 py-2 text-sm font-medium transition ${paramValues.generate_audio ?? selectedSpecial.params.generate_audio?.default ?? true
                          ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30"
                          : "border-white/10 bg-black/40 text-slate-400 hover:bg-white/5"
                          }`}
                      >
                        {(paramValues.generate_audio ?? selectedSpecial.params.generate_audio?.default ?? true) ? "On" : "Off"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Prompt */}
            <div className="space-y-1">
              {/* For references models, prompt with autocomplete popup */}
              {selectedSpecial.inputType === "references" ? (
                <div className="relative">
                  <textarea
                    ref={promptTextareaRef}
                    value={prompt}
                    onChange={(event) => {
                      const newValue = event.target.value;
                      setPrompt(newValue);

                      // Check if we should show autocomplete (typing @)
                      const cursorPos = event.target.selectionStart;
                      const textBefore = newValue.slice(0, cursorPos);
                      const atMatch = textBefore.match(/@([a-zA-Z]*)$/);

                      if (atMatch) {
                        setShowAutocomplete(true);
                        setAutocompleteIndex(0);
                      } else {
                        setShowAutocomplete(false);
                      }
                    }}
                    onBlur={() => {
                      addToHistory(prompt);
                      // Delay hiding to allow click on autocomplete item
                      setTimeout(() => setShowAutocomplete(false), 150);
                    }}
                    onKeyDown={(event) => {
                      if (showAutocomplete) {
                        // Build options list
                        const imageCount = referenceStyleImages.filter(i => i.file || i.url).length;
                        // Count elements from both local uploads AND Elements Manager selections
                        const localElementCount = elements.filter(e => e.frontalFile || e.frontalUrl).length;
                        const managerElementCount = elementsState.selectedElements.length;
                        const totalElementCount = localElementCount + managerElementCount;
                        const options: string[] = [];
                        for (let i = 1; i <= imageCount; i++) options.push(`@Image${i}`);
                        for (let i = 1; i <= totalElementCount; i++) options.push(`@Element${i}`);

                        if (options.length > 0) {
                          if (event.key === "ArrowDown") {
                            event.preventDefault();
                            setAutocompleteIndex((prev) => (prev + 1) % options.length);
                            return;
                          }
                          if (event.key === "ArrowUp") {
                            event.preventDefault();
                            setAutocompleteIndex((prev) => (prev - 1 + options.length) % options.length);
                            return;
                          }
                          if (event.key === "Enter" || event.key === "Tab") {
                            event.preventDefault();
                            const selected = options[autocompleteIndex];
                            const textarea = event.target as HTMLTextAreaElement;
                            const cursorPos = textarea.selectionStart;
                            const textBefore = prompt.slice(0, cursorPos);
                            const atMatch = textBefore.match(/@([a-zA-Z]*)$/);
                            if (atMatch) {
                              const before = textBefore.slice(0, -atMatch[0].length);
                              const after = prompt.slice(cursorPos);
                              const newPrompt = before + selected + " " + after;
                              setPrompt(newPrompt);
                              setShowAutocomplete(false);
                              setTimeout(() => {
                                const newPos = before.length + selected.length + 1;
                                textarea.setSelectionRange(newPos, newPos);
                              }, 0);
                            }
                            return;
                          }
                          if (event.key === "Escape") {
                            event.preventDefault();
                            setShowAutocomplete(false);
                            return;
                          }
                        }
                      }
                    }}
                    placeholder="Type @ to insert references (e.g., @Image1, @Element1)..."
                    rows={5}
                    disabled={isSubmitting || isExpanding}
                    className={`w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-3 pr-10 text-sm text-white outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 ${isSubmitting || isExpanding ? "opacity-50 cursor-not-allowed" : ""}`}
                  />

                  {/* Autocomplete popup */}
                  {showAutocomplete && (() => {
                    const imageCount = referenceStyleImages.filter(i => i.file || i.url).length;
                    // Count elements from both local uploads AND Elements Manager selections
                    const localElementCount = elements.filter(e => e.frontalFile || e.frontalUrl).length;
                    const managerElementCount = elementsState.selectedElements.length;
                    const totalElementCount = localElementCount + managerElementCount;
                    const options: Array<{ label: string; type: "image" | "element" }> = [];
                    for (let i = 1; i <= imageCount; i++) options.push({ label: `@Image${i}`, type: "image" });
                    for (let i = 1; i <= totalElementCount; i++) options.push({ label: `@Element${i}`, type: "element" });

                    if (options.length === 0) return null;

                    return (
                      <div className="absolute left-3 top-full mt-1 z-50 rounded-lg border border-white/20 bg-slate-900 shadow-xl overflow-hidden">
                        {options.map((opt, idx) => (
                          <button
                            key={opt.label}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              const textarea = promptTextareaRef.current;
                              if (!textarea) return;
                              const cursorPos = textarea.selectionStart;
                              const textBefore = prompt.slice(0, cursorPos);
                              const atMatch = textBefore.match(/@([a-zA-Z]*)$/);
                              if (atMatch) {
                                const before = textBefore.slice(0, -atMatch[0].length);
                                const after = prompt.slice(cursorPos);
                                const newPrompt = before + opt.label + " " + after;
                                setPrompt(newPrompt);
                                setShowAutocomplete(false);
                              }
                            }}
                            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition ${idx === autocompleteIndex ? "bg-sky-500/30 text-white" : "text-slate-300 hover:bg-white/10"}`}
                          >
                            <span className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${opt.type === "image" ? "bg-sky-500/30 text-sky-300" : "bg-amber-500/30 text-amber-300"}`}>
                              {opt.type === "image" ? "I" : "E"}
                            </span>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                  {/* Expand button for references */}
                  <button
                    type="button"
                    onClick={async () => {
                      if (!prompt.trim()) return;
                      setIsExpanding(true);
                      try {
                        const expanded = await expandKlingO1ReferencePrompt(
                          prompt,
                          referenceStyleImages.filter(i => i.url).length,
                          elements.filter(e => e.frontalUrl).length
                        );
                        setPrompt(expanded);
                        addToHistory(expanded);
                      } catch (err) {
                        console.error("Failed to expand prompt:", err);
                        setStatus("Failed to expand prompt");
                        setTimeout(() => setStatus(null), 3000);
                      } finally {
                        setIsExpanding(false);
                      }
                    }}
                    disabled={isSubmitting || isExpanding || !prompt.trim()}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg border border-purple-500/30 bg-purple-500/20 text-purple-200 transition hover:bg-purple-500/40 disabled:opacity-30"
                    title="Expand prompt with AI (adds @Image/@Element references)"
                  >
                    {isExpanding ? (
                      <Spinner size="sm" />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v18" /><path d="m9 6-3 3 3 3" /><path d="m15 12 3 3-3 3" /></svg>
                    )}
                  </button>
                </div>
              ) : selectedSpecial.inputType === "kling-v3" ? (
                <div className="space-y-2">
                  <div className="relative">
                    <textarea
                      ref={promptTextareaRef}
                      value={prompt}
                      onChange={(event) => {
                        const newValue = event.target.value;
                        setPrompt(newValue);

                        // Check if we should show autocomplete (typing @)
                        const cursorPos = event.target.selectionStart;
                        const textBefore = newValue.slice(0, cursorPos);
                        const atMatch = textBefore.match(/@([a-zA-Z]*)$/);

                        if (atMatch) {
                          setShowAutocomplete(true);
                          setAutocompleteIndex(0);
                        } else {
                          setShowAutocomplete(false);
                        }
                      }}
                      onBlur={() => {
                        addToHistory(prompt);
                        setTimeout(() => setShowAutocomplete(false), 150);
                      }}
                      onKeyDown={(event) => {
                        if (showAutocomplete) {
                          // Build options list - only @Element for Kling V3
                          const managerElementCount = elementsState.selectedElements.length;
                          const options: string[] = [];
                          for (let i = 1; i <= managerElementCount; i++) options.push(`@Element${i}`);

                          if (options.length > 0) {
                            if (event.key === "ArrowDown") {
                              event.preventDefault();
                              setAutocompleteIndex((prev) => (prev + 1) % options.length);
                              return;
                            }
                            if (event.key === "ArrowUp") {
                              event.preventDefault();
                              setAutocompleteIndex((prev) => (prev - 1 + options.length) % options.length);
                              return;
                            }
                            if (event.key === "Enter" || event.key === "Tab") {
                              event.preventDefault();
                              const selected = options[autocompleteIndex];
                              const textarea = event.target as HTMLTextAreaElement;
                              const cursorPos = textarea.selectionStart;
                              const textBefore = prompt.slice(0, cursorPos);
                              const atMatch = textBefore.match(/@([a-zA-Z]*)$/);
                              if (atMatch) {
                                const before = textBefore.slice(0, -atMatch[0].length);
                                const after = prompt.slice(cursorPos);
                                const newPrompt = before + selected + " " + after;
                                setPrompt(newPrompt);
                                setShowAutocomplete(false);
                                setTimeout(() => {
                                  const newPos = before.length + selected.length + 1;
                                  textarea.setSelectionRange(newPos, newPos);
                                }, 0);
                              }
                              return;
                            }
                            if (event.key === "Escape") {
                              event.preventDefault();
                              setShowAutocomplete(false);
                              return;
                            }
                          }
                        }
                      }}
                      placeholder="Type @ to insert elements (e.g., @Element1, @Element2)..."
                      rows={4}
                      disabled={isSubmitting || isExpanding}
                      className={`w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-3 pb-10 text-sm text-white outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 ${isSubmitting || isExpanding ? "opacity-50 cursor-not-allowed" : ""}`}
                    />

                    {/* Autocomplete popup for Kling V3 */}
                    {showAutocomplete && (() => {
                      const managerElementCount = elementsState.selectedElements.length;
                      if (managerElementCount === 0) return null;

                      const options = elementsState.selectedElements.map((selectedEl, idx) => ({
                        label: `@Element${idx + 1}`,
                        preview: `${import.meta.env.VITE_FILE_API_BASE ?? "http://localhost:8787"}${selectedEl.element.frontalImageUrl}?token=${import.meta.env.VITE_FILE_API_TOKEN}`,
                        name: selectedEl.element.name,
                        mode: selectedEl.mode
                      }));

                      return (
                        <div className="absolute left-3 top-full mt-1 z-50 rounded-lg border border-white/20 bg-slate-900 shadow-xl overflow-hidden max-w-[280px]">
                          {options.map((opt, idx) => (
                            <button
                              key={opt.label}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                const textarea = promptTextareaRef.current;
                                if (!textarea) return;
                                const cursorPos = textarea.selectionStart;
                                const textBefore = prompt.slice(0, cursorPos);
                                const atMatch = textBefore.match(/@([a-zA-Z]*)$/);
                                if (atMatch) {
                                  const before = textBefore.slice(0, -atMatch[0].length);
                                  const after = prompt.slice(cursorPos);
                                  const newPrompt = before + opt.label + " " + after;
                                  setPrompt(newPrompt);
                                  setShowAutocomplete(false);
                                }
                              }}
                              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition ${idx === autocompleteIndex ? "bg-sky-500/30 text-white" : "text-slate-300 hover:bg-white/10"}`}
                            >
                              <img src={opt.preview} alt={opt.name} className="h-8 w-8 rounded object-cover" />
                              <div className="flex flex-col">
                                <span className="font-medium">{opt.label}</span>
                                <span className="text-xs text-slate-400">{opt.name} ({opt.mode})</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Prompt tools - Bottom Right */}
                    <div className="absolute bottom-2 right-2 flex gap-1">
                      <button
                        type="button"
                        onClick={undo}
                        disabled={historyIndex <= 0 || isExpanding || isSubmitting}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-rose-500/30 bg-rose-500/20 text-rose-200 transition hover:bg-rose-500/30 hover:text-white disabled:opacity-30 disabled:hover:bg-rose-500/20"
                        title="Undo"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></svg>
                      </button>
                      <button
                        type="button"
                        onClick={redo}
                        disabled={historyIndex >= history.length - 1 || isExpanding || isSubmitting}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-rose-500/30 bg-rose-500/20 text-rose-200 transition hover:bg-rose-500/30 hover:text-white disabled:opacity-30 disabled:hover:bg-rose-500/20"
                        title="Redo"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" /></svg>
                      </button>
                      <div className="w-px bg-white/10 mx-1" />
                      {/* Prompt Mode Toggle - Video modes: photoreal, audiogen, timestep */}
                      <button
                        type="button"
                        onClick={() => setSpecialPromptMode((prev) =>
                          prev === "photoreal" ? "audiogen" : prev === "audiogen" ? "timestep" : "photoreal"
                        )}
                        disabled={isExpanding}
                        className={`flex h-7 w-7 items-center justify-center rounded-md border transition disabled:opacity-50 ${specialPromptMode === "photoreal"
                          ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/40 hover:text-white"
                          : specialPromptMode === "audiogen"
                            ? "border-purple-500/30 bg-purple-500/20 text-purple-200 hover:bg-purple-500/40 hover:text-white"
                            : "border-amber-500/30 bg-amber-500/20 text-amber-200 hover:bg-amber-500/40 hover:text-white"
                          }`}
                        title={`Current Mode: ${specialPromptMode === "photoreal"
                          ? "Photorealistic (Camera Aware)"
                          : specialPromptMode === "audiogen"
                            ? "Audio-Gen (Sound Aware)"
                            : "Timestep (Beat-by-Beat)"
                          }`}
                      >
                        {specialPromptMode === "photoreal" ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></svg>
                        ) : specialPromptMode === "audiogen" ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 10v3" /><path d="M6 6v11" /><path d="M10 3v18" /><path d="M14 8v7" /><path d="M18 5v13" /><path d="M22 10v3" /></svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                        )}
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
                    </div>

                    {/* Camera Movement Button - Bottom Left */}
                    <div className="absolute bottom-2 left-2">
                      <button
                        type="button"
                        onClick={() => setShowCameraSelector(!showCameraSelector)}
                        disabled={isSubmitting || isExpanding}
                        className={`flex h-7 w-9 items-center justify-center rounded-md border transition ${showCameraSelector
                          ? "border-sky-500 bg-sky-500/40 text-white"
                          : "border-sky-500/30 bg-sky-500/20 text-sky-200 hover:bg-sky-500/40 hover:text-white"
                          } disabled:opacity-50`}
                        title="Add Camera Movement"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8Z" /><rect width="14" height="12" x="2" y="6" rx="2" ry="2" /></svg>
                      </button>

                      {/* Camera Selector Popover */}
                      {showCameraSelector && (
                        <div className="absolute top-full left-0 mt-2 z-50">
                          <CameraMovementSelector
                            onSelect={(text: string) => {
                              const instruction = `Rewrite the prompt to completely REPLACE any existing camera movement with this one: "${text}". Keep the rest of the visual details intact.`;
                              void handleAlter(instruction);
                              setShowCameraSelector(false);
                            }}
                            onClose={() => setShowCameraSelector(false)}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Multishot Section - OUTSIDE the relative div */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Multishot Prompts
                      </label>
                      <button
                        type="button"
                        onClick={() => setUseMultishot(!useMultishot)}
                        disabled={isSubmitting || isExpanding}
                        className={`text-xs transition ${useMultishot ? "text-sky-400 hover:text-sky-300" : "text-slate-500 hover:text-slate-400"}`}
                      >
                        {useMultishot ? "Disable" : "Enable"}
                      </button>
                    </div>

                    {useMultishot && (
                      <div className="space-y-2 rounded-lg border border-white/10 bg-black/20 p-2">
                        {/* Total Duration Display */}
                        <div className="flex justify-between items-center text-[10px] pb-1 border-b border-white/10">
                          <span className="text-slate-400">Total Duration</span>
                          <span className={`font-medium ${multishotPrompts.reduce((sum, s) => sum + s.duration, 0) >= 15 ? "text-amber-400" : "text-emerald-400"}`}>
                            {multishotPrompts.reduce((sum, s) => sum + s.duration, 0)}s / 15s
                          </span>
                        </div>
                        {multishotPrompts.length === 0 && (
                          <p className="text-xs text-slate-500">No shots added. Add shots below (min 3s each, max 15s total).</p>
                        )}
                        {multishotPrompts.map((shot, index) => (
                          <div key={index} className="flex gap-2 items-start">
                            <div className="flex-1 space-y-1">
                              <input
                                type="text"
                                value={shot.prompt}
                                onChange={(event) => {
                                  const newPrompts = [...multishotPrompts];
                                  newPrompts[index] = { ...shot, prompt: event.target.value };
                                  setMultishotPrompts(newPrompts);
                                }}
                                placeholder={`Shot ${index + 1} prompt...`}
                                disabled={isSubmitting || isExpanding}
                                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                              />
                            </div>
                            <select
                              value={shot.duration}
                              onChange={(event) => {
                                const newPrompts = [...multishotPrompts];
                                newPrompts[index] = { ...shot, duration: Number(event.target.value) };
                                setMultishotPrompts(newPrompts);
                              }}
                              disabled={isSubmitting || isExpanding}
                              className="w-20 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white outline-none focus:border-sky-400"
                            >
                              {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((d) => (
                                <option key={d} value={d}>{d}s</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                const newPrompts = multishotPrompts.filter((_, i) => i !== index);
                                setMultishotPrompts(newPrompts);
                              }}
                              disabled={isSubmitting || isExpanding}
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/20 text-rose-200 transition hover:bg-rose-500/30 disabled:opacity-50"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                            </button>
                          </div>
                        ))}

                        {/* Add New Shot */}
                        <div className="flex gap-2 items-start pt-2 border-t border-white/10">
                          <div className="flex-1 space-y-1">
                            <input
                              type="text"
                              value={currentMultishotPrompt}
                              onChange={(event) => setCurrentMultishotPrompt(event.target.value)}
                              placeholder="New shot prompt..."
                              disabled={isSubmitting || isExpanding}
                              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                            />
                          </div>
                          <select
                            value={currentMultishotDuration}
                            onChange={(event) => setCurrentMultishotDuration(Number(event.target.value))}
                            disabled={isSubmitting || isExpanding}
                            className="w-20 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white outline-none focus:border-sky-400"
                          >
                            {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((d) => (
                              <option key={d} value={d}>{d}s</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              if (currentMultishotPrompt.trim()) {
                                // Calculate current total and check cap (max 15s total)
                                const currentTotal = multishotPrompts.reduce((sum, s) => sum + s.duration, 0);
                                const allowedDuration = Math.min(currentMultishotDuration, 15 - currentTotal);
                                if (allowedDuration >= 3) {
                                  setMultishotPrompts([...multishotPrompts, { prompt: currentMultishotPrompt.trim(), duration: allowedDuration }]);
                                  setCurrentMultishotPrompt("");
                                }
                              }
                            }}
                            disabled={isSubmitting || isExpanding || !currentMultishotPrompt.trim()}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-sky-500/30 bg-sky-500/20 text-sky-200 transition hover:bg-sky-500/30 disabled:opacity-50"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <textarea
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    onBlur={() => addToHistory(prompt)}
                    placeholder="Describe what should happen in the video..."
                    rows={4}
                    disabled={isSubmitting || isExpanding}
                    className={`w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-3 pr-10 text-sm text-white outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 ${isSubmitting || isExpanding ? "opacity-50 cursor-not-allowed" : ""}`}
                  />

                  {/* Undo/Redo buttons */}
                  <div className="absolute right-2 top-2 flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={undo}
                      disabled={historyIndex <= 0 || isExpanding || isSubmitting}
                      className="flex h-6 w-6 items-center justify-center rounded bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
                      title="Undo (previous prompt)"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" /></svg>
                    </button>
                    <button
                      type="button"
                      onClick={redo}
                      disabled={historyIndex >= history.length - 1 || isExpanding || isSubmitting}
                      className="flex h-6 w-6 items-center justify-center rounded bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
                      title="Redo (next prompt)"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 14 5-5-5-5" /><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13" /></svg>
                    </button>
                  </div>

                  {/* Prompt tools */}
                  <div className="mt-2 flex items-center gap-1">
                    {/* Prompt Mode Toggle - Image modes: photoreal, editing, general */}
                    <button
                      type="button"
                      onClick={() => setSpecialPromptMode((prev) => {
                        // For non-Kling-V3 models, cycle through image modes
                        if (prev === "photoreal") return "editing";
                        if (prev === "editing") return "general";
                        return "photoreal";
                      })}
                      disabled={isExpanding}
                      className={`flex h-7 w-7 items-center justify-center rounded-md border transition disabled:opacity-50 ${specialPromptMode === "photoreal"
                        ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/40 hover:text-white"
                        : specialPromptMode === "editing"
                          ? "border-cyan-500/30 bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/40 hover:text-white"
                          : "border-amber-500/30 bg-amber-500/20 text-amber-200 hover:bg-amber-500/40 hover:text-white"
                        }`}
                      title={`Current Mode: ${specialPromptMode === "photoreal" ? "Photorealistic" : specialPromptMode === "editing" ? "Editing" : "General"}`}
                    >
                      {specialPromptMode === "photoreal" ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></svg>
                      ) : specialPromptMode === "editing" ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /><path d="M3 9h6" /></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                      )}
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
                  </div>
                </div>
              )}

              {/* Alter Box */}
              <div className="flex gap-2 pt-2">
                <input
                  type="text"
                  value={alterInstruction}
                  onChange={(event) => setAlterInstruction(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && alterInstruction.trim() && prompt.trim() && !isAltering && !isSubmitting) {
                      void handleAlter();
                    }
                  }}
                  placeholder="Alter: e.g. 'make it more cinematic'"
                  disabled={isAltering || isSubmitting || !prompt.trim()}
                  className={`flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 ${isAltering || isSubmitting || !prompt.trim() ? "opacity-50 cursor-not-allowed" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => void handleAlter()}
                  disabled={isAltering || isSubmitting || !alterInstruction.trim() || !prompt.trim()}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-violet-500/30 bg-violet-500/20 text-violet-200 transition hover:bg-violet-500/40 hover:text-white disabled:opacity-50"
                  title="Apply alteration"
                >
                  {isAltering ? (
                    <Spinner size="sm" />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                  )}
                </button>
              </div>
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
          {/* T2V/I2V Mode Indicator for video models */}
          {modelKind === "video" && supportsStartFrame && (
            <span
              className={`rounded-lg border px-3 py-2 text-center text-xs font-semibold ${startFrame.preview || startFrame.url
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                : "border-sky-500/30 bg-sky-500/10 text-sky-200"
                }`}
              title={
                startFrame.preview || startFrame.url
                  ? "Image-to-Video: Using start frame"
                  : "Text-to-Video: No start frame"
              }
            >
              {startFrame.preview || startFrame.url ? "I2V" : "T2V"}
            </span>
          )}
          {pricingLabel ? (
            <span className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-sm font-semibold text-amber-200">
              {pricingLabel}
            </span>
          ) : null}
        </div>

        {/* Floating Status Toast */}
        {status && (
          <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="rounded-full border border-white/20 bg-slate-900/95 px-4 py-2 text-xs font-medium text-slate-200 shadow-lg backdrop-blur-sm">
              {status}
            </div>
          </div>
        )}

        {/* Missing Reference Warning */}
        {isMissingImageReference && (
          <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            Add at least one reference image to generate with this model.
          </div>
        )}
      </div>

      {showPromptStudio && (
        <PromptBuilderV2
          currentPrompt={prompt}
          initialImages={referenceUploads.map((r) => r.url || r.preview).filter(Boolean)}
          onClose={() => setShowPromptStudio(false)}
          onApply={(newPrompt) => {
            setPrompt(newPrompt);
            setShowPromptStudio(false);
            addToHistory(newPrompt);
          }}
        />
      )}

      <BatchPromptModal
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        onStart={(prompts) => {
          setShowBatchModal(false);
          setBatchQueue(prompts);
          setBatchIndex(0);
          // Set the first prompt immediately
          if (prompts.length > 0) {
            setPrompt(prompts[0]);
          }
        }}
      />
    </form >
  );
}
