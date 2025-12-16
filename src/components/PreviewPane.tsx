import { useCallback, useEffect, useRef, useState } from "react";
import { useCatalog } from "../state/useCatalog";
import { FILE_ENTRY_MIME } from "../lib/drag-constants";
import { getFileUrl, uploadFile, type WorkspaceConnection } from "../lib/api/files";
import ImageComparer from "./ImageComparer";
import { UPSCALE_MODELS } from "../lib/upscale-models";
import { useQueue } from "../state/queue";
import { downloadBlob } from "../lib/providers/shared";
import { callModelEndpoint, getProviderEnvVar, getProviderKey, type ModelProvider, type ProviderCallOptions } from "../lib/providers";
import { buildFilename } from "../lib/filename";
import { uploadToFal } from "../lib/fal";
import { compressImage } from "../lib/image-utils";
import { recordFileMetadata, recordGeneration } from "../lib/api/meta";
import { enqueueControlsAction } from "../lib/controls-store";
import { recordRecentReference } from "../lib/recent-references";
import ImageEditor from "./ImageEditor";




export default function PreviewPane({
  isFullScreen,
  onToggleFullScreen,
}: {
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;
}) {
  const {
    state: { selected, connection },
    actions: { refreshTree },
  } = useCatalog();
  const { addJob } = useQueue();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sentFileMetaRef = useRef<Set<string>>(new Set());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [canCapture, setCanCapture] = useState(false);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [captureStatus, setCaptureStatus] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [cropAspect, setCropAspect] = useState("16:9");
  const [cropBusy, setCropBusy] = useState(false);

  const [cropStatus, setCropStatus] = useState<string | null>(null);
  const [upscaleBusy, setUpscaleBusy] = useState(false);
  const [upscaleStatus, setUpscaleStatus] = useState<string | null>(null);
  const [quickStatus, setQuickStatus] = useState<string | null>(null);
  const cropPresets = [
    { value: "16:9", label: "16:9" },
    { value: "1:1", label: "1:1" },
    { value: "4:3", label: "4:3" },
    { value: "3:2", label: "3:2" },
    { value: "9:16", label: "9:16" },
  ] as const;

  const [mode, setMode] = useState<"preview" | "compare">("preview");

  const handleDragStart = (event: React.DragEvent) => {
    if (!selected || selected.kind !== "file" || !connection) return;
    event.dataTransfer.setData(
      FILE_ENTRY_MIME,
      JSON.stringify({
        workspaceId: connection.workspaceId,
        path: selected.relPath,
        name: selected.name,
        mime: selected.mime,
      })
    );
    event.dataTransfer.effectAllowed = "copy";
  };



  useEffect(() => {
    setCanCapture(false);
    setCaptureStatus(null);
    setVideoDuration(null);
    setCropStatus(null);
    setCropAspect("16:9");
    setCropBusy(false);
    setUpscaleStatus(null);
    setUpscaleBusy(false);
    setQuickStatus(null);
  }, [selected?.id]);

  const workspaceKey = connection
    ? `${connection.apiBase}|${connection.workspaceId}`
    : "";

  const pushControlsFileAction = useCallback(
    (type: "useStartFrame" | "useEndFrame" | "addReferenceImage") => {
      if (!connection || !selected || selected.kind !== "file") return;

      if (!selected.mime.startsWith("image/")) {
        setQuickStatus("Select an image file to use it as a frame/reference.");
        setTimeout(() => setQuickStatus(null), 2500);
        return;
      }

      enqueueControlsAction({
        type,
        file: {
          workspaceId: connection.workspaceId,
          relPath: selected.relPath,
          name: selected.name,
          mime: selected.mime,
        },
      });

      if (workspaceKey) {
        recordRecentReference(
          workspaceKey,
          { relPath: selected.relPath, name: selected.name, mime: selected.mime },
          type === "useStartFrame"
            ? "startFrame"
            : type === "useEndFrame"
              ? "endFrame"
              : "reference"
        );
      }

      setQuickStatus(
        type === "useStartFrame"
          ? "Sent to Controls: Start frame"
          : type === "useEndFrame"
            ? "Sent to Controls: End frame"
            : "Sent to Controls: Reference image"
      );
      setTimeout(() => setQuickStatus(null), 2000);
    },
    [connection, selected, workspaceKey]
  );

  const pushRecreateAction = useCallback(() => {
    if (!connection || !selected || selected.kind !== "file") return;

    enqueueControlsAction({
      type: "recreateFromOutput",
      workspaceId: connection.workspaceId,
      relPath: selected.relPath,
    });

    setQuickStatus("Loading saved settings in Controls…");
    setTimeout(() => setQuickStatus(null), 2500);
  }, [connection, selected]);

  const ensureMetadataReady = useCallback(async () => {
    const video = videoRef.current;
    if (!video) {
      throw new Error("Video is not ready for capture.");
    }
    if (video.readyState >= video.HAVE_METADATA) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error("Timeout waiting for video metadata."));
      }, 10000);

      const onLoaded = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error("Unable to load video metadata for capture."));
      };
      const cleanup = () => {
        clearTimeout(timeoutId);
        video.removeEventListener("loadedmetadata", onLoaded);
        video.removeEventListener("error", onError);
      };
      video.addEventListener("loadedmetadata", onLoaded);
      video.addEventListener("error", onError);
    });
  }, []);

  const seekToTime = useCallback(
    (time: number) =>
      new Promise<void>((resolve, reject) => {
        const video = videoRef.current;
        if (!video) {
          reject(new Error("Video element missing."));
          return;
        }
        const target =
          Number.isFinite(video.duration) && video.duration > 0
            ? Math.min(Math.max(time, 0), video.duration)
            : Math.max(time, 0);

        if (Math.abs(video.currentTime - target) < 0.001) {
          resolve();
          return;
        }

        const handleSeeked = () => {
          cleanup();
          resolve();
        };
        const handleError = () => {
          cleanup();
          reject(new Error("Unable to seek to requested frame."));
        };
        const cleanup = () => {
          video.removeEventListener("seeked", handleSeeked);
          video.removeEventListener("error", handleError);
        };

        video.addEventListener("seeked", handleSeeked, { once: true });
        video.addEventListener("error", handleError, { once: true });
        video.currentTime = target;
      }),
    []
  );

  const captureFrameToBlob = useCallback(async (): Promise<Blob> => {
    const video = videoRef.current;
    if (!video) {
      throw new Error("Video is not ready for capture.");
    }
    const canvas = document.createElement("canvas");
    const width = video.videoWidth || Math.max(video.clientWidth, 1);
    const height = video.videoHeight || Math.max(video.clientHeight, 1);
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Unable to prepare drawing surface for capture.");
    }
    context.drawImage(video, 0, 0, width, height);
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Unable to extract frame as image."));
          return;
        }
        resolve(blob);
      }, "image/png");
    });
  }, []);

  const captureFrame = useCallback(
    async (targetTime?: number, label?: string) => {
      if (!connection || !selected || selected.kind !== "file") {
        setCaptureStatus("Frame extraction is only available when a workspace and video are selected.");
        return;
      }
      if (!selected.mime.startsWith("video")) {
        setCaptureStatus("Frame extraction is only available for videos.");
        return;
      }
      const video = videoRef.current;
      if (!video) {
        setCaptureStatus("Video is not ready for capture.");
        return;
      }

      setCaptureBusy(true);
      setCaptureStatus(label ?? "Extracting frame…");

      try {
        await ensureMetadataReady();
        const rawTime =
          typeof targetTime === "number" ? targetTime : video.currentTime;
        const duration =
          videoDuration ??
          (Number.isFinite(video.duration) && video.duration > 0
            ? video.duration
            : undefined);
        const captureTime =
          typeof rawTime === "number" && Number.isFinite(rawTime)
            ? duration !== undefined
              ? Math.min(Math.max(rawTime, 0), duration)
              : Math.max(rawTime, 0)
            : 0;
        if (typeof targetTime === "number") {
          await seekToTime(captureTime);
        }

        const blob = await captureFrameToBlob();
        const directoryParts = selected.relPath.split("/");
        const filename = directoryParts.pop() ?? selected.name;
        const baseDir = directoryParts.join("/");
        const baseName = filename.replace(/\.[^.]+$/, "");
        const msStamp = Math.round(captureTime * 1000);
        const outputName = `${baseName}_frame_${msStamp}ms.png`;
        const relPath = baseDir ? `${baseDir}/${outputName}` : outputName;

        await uploadFile(connection, relPath, blob);
        await refreshTree(selected.relPath);
        setCaptureStatus(`Saved frame to ${relPath}`);
      } catch (err) {
        setCaptureStatus(
          err instanceof Error ? err.message : "Unable to extract frame."
        );
      } finally {
        setCaptureBusy(false);
      }
    },
    [
      captureFrameToBlob,
      ensureMetadataReady,
      connection,
      refreshTree,
      selected,
      seekToTime,
      videoDuration,
    ]
  );

  const handleMetadataLoaded = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setLoading(false);
    setCanCapture(true);
    setVideoDuration(
      Number.isFinite(video.duration) && video.duration > 0
        ? video.duration
        : null
    );

    if (connection && selected?.kind === "file") {
      const key = `${connection.workspaceId}:${selected.relPath}`;
      if (!sentFileMetaRef.current.has(key)) {
        sentFileMetaRef.current.add(key);
        const duration =
          Number.isFinite(video.duration) && video.duration > 0
            ? video.duration
            : undefined;
        const hasSameDims =
          typeof selected.width === "number" &&
          typeof selected.height === "number" &&
          selected.width === video.videoWidth &&
          selected.height === video.videoHeight;
        const hasSameDuration =
          duration === undefined ||
          (typeof selected.duration === "number" &&
            Number.isFinite(selected.duration) &&
            Math.abs(selected.duration - duration) < 0.25);

        if (hasSameDims && hasSameDuration) return;
        void recordFileMetadata(connection, {
          workspaceId: connection.workspaceId,
          relPath: selected.relPath,
          width: video.videoWidth,
          height: video.videoHeight,
          duration,
        }).catch(() => {
          sentFileMetaRef.current.delete(key);
        });
      }
    }
  }, [connection, selected]);

  const handleCropSave = useCallback(async () => {
    if (!connection || !selected || selected.kind !== "file" || !selected.mime.startsWith("image")) {
      setCropStatus("Cropping is only available for images.");
      return;
    }
    if (!previewUrl) {
      setCropStatus("No image available to crop.");
      return;
    }
    const parts = cropAspect.split(":").map(Number);
    if (parts.length !== 2 || parts.some((p) => !Number.isFinite(p) || p <= 0)) {
      setCropStatus("Invalid aspect ratio.");
      return;
    }
    const [ratioW, ratioH] = parts;

    setCropBusy(true);
    setCropStatus("Preparing crop…");

    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.src = previewUrl;
      await img.decode();

      const imgWidth = img.naturalWidth || img.width;
      const imgHeight = img.naturalHeight || img.height;
      if (!imgWidth || !imgHeight) {
        throw new Error("Unable to read image dimensions.");
      }

      // Exact integer aspect ratio cropping
      const kW = Math.floor(imgWidth / ratioW);
      const kH = Math.floor(imgHeight / ratioH);
      const k = Math.min(kW, kH);

      const cropWidth = k * ratioW;
      const cropHeight = k * ratioH;

      const sx = Math.floor((imgWidth - cropWidth) / 2);
      const sy = Math.floor((imgHeight - cropHeight) / 2);

      const canvas = document.createElement("canvas");
      canvas.width = cropWidth;
      canvas.height = cropHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Unable to prepare canvas for crop.");
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, sx, sy, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

      const mime = selected.mime && selected.mime.startsWith("image/")
        ? selected.mime
        : "image/png";

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((out) => {
          if (out) return resolve(out);
          reject(new Error("Unable to create cropped image."));
        }, mime);
      });

      const directoryParts = selected.relPath.split("/");
      const filename = directoryParts.pop() ?? selected.name;
      const baseDir = directoryParts.join("/");
      const baseName = filename.replace(/\.[^.]+$/, "");
      const suffix = cropAspect.replace(/:/g, "x");
      const ext = mime.includes("jpeg") ? "jpg" : mime.split("/").pop() || "png";
      const outputName = `${baseName}_crop_${suffix}.${ext}`;
      const relPath = baseDir ? `${baseDir}/${outputName}` : outputName;

      await uploadFile(connection, relPath, blob);
      await refreshTree(selected.relPath);
      setCropStatus(`Saved crop to ${relPath}`);
    } catch (error) {
      setCropStatus(
        error instanceof Error ? error.message : "Unable to crop image."
      );
    } finally {
      setCropBusy(false);
    }
  }, [cropAspect, previewUrl, selected, connection, refreshTree]);

  const handleUpscale = useCallback(async () => {
    if (!connection || !selected || selected.kind !== "file") {
      setUpscaleStatus("No file selected.");
      return;
    }
    const isImage = selected.mime.startsWith("image");
    const isVideo = selected.mime.startsWith("video");

    if (!isImage && !isVideo) {
      setUpscaleStatus("Upscaling is only available for images and videos.");
      return;
    }

    if (!previewUrl) {
      setUpscaleStatus("No file available to upscale.");
      return;
    }

    const modelId = isImage ? "seedvr-image-upscale" : "topaz-video-upscale";
    const modelSpec = UPSCALE_MODELS.find((m) => m.id === modelId);

    if (!modelSpec) {
      setUpscaleStatus("Upscale model not found.");
      return;
    }

    setUpscaleBusy(true);
    setUpscaleStatus("Starting upscale...");

    try {
      const provider = modelSpec.provider ?? "fal";
      if (!getProviderKey(provider)) {
        throw new Error(
          `Missing ${getProviderEnvVar(provider)}. Add it to .env.local and restart the app.`
        );
      }

      // Upload file to get a public URL
      setUpscaleStatus("Uploading file...");
      const response = await fetch(previewUrl);
      const blob = await response.blob();
      const file = new File([blob], selected.name, { type: selected.mime });

      // Compress if it's an image, otherwise just upload
      let fileToUpload = file;
      if (isImage) {
        setUpscaleStatus("Compressing & Uploading...");
        fileToUpload = await compressImage(file);
      }

      const url = await uploadToFal(fileToUpload);

      const payload = modelSpec.mapInput({
        sourceUrl: url,
        upscaleFactor: "2", // Default to 2x
      });

      addJob(
        "upscale",
        `Upscale ${selected.name}`,
        {
          endpoint: modelSpec.endpoint,
          payload,
          modelId: modelSpec.id,
          category: isImage ? "image" : "video",
          provider,
          callOptions: modelSpec.taskConfig ? { taskConfig: modelSpec.taskConfig } : undefined,
          seed: "",
          prompt: "Upscale",
          connection,
          refreshTree,
        },
        async (data: unknown, log) => {
          const {
            endpoint,
            payload,
            provider,
            callOptions,
            connection,
            refreshTree,
          } = data as {
            endpoint: string;
            payload: Record<string, unknown>;
            provider: ModelProvider;
            callOptions?: ProviderCallOptions;
            connection: WorkspaceConnection;
            refreshTree: (path?: string) => Promise<void>;
          };

          log("Calling upscale API...");
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
              }
            }
          } else {
            throw new Error("No result from model");
          }

          const ext = isImage ? "png" : "mp4";
          const filename = buildFilename(modelSpec.id, "upscale", ext, "");
          const directoryParts = selected.relPath.split("/");
          directoryParts.pop();
          const baseDir = directoryParts.join("/");
          const relPath = baseDir ? `${baseDir}/${filename}` : filename;

          if (downloadedBlob && connection) {
            log("Saving to workspace...");
            await uploadFile(connection, relPath, downloadedBlob);
            try {
              await recordGeneration(connection, {
                workspaceId: connection.workspaceId,
                outputRelPath: relPath,
                outputMime: downloadedBlob.type || undefined,
                outputSize: downloadedBlob.size,
                category: "upscale",
                modelId: modelSpec.id,
                provider,
                endpoint,
                prompt: "Upscale",
                seed: "",
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

      setUpscaleStatus("Upscale job queued.");
      setTimeout(() => setUpscaleStatus(null), 3000);

    } catch (error) {
      console.error("Upscale failed:", error);
      setUpscaleStatus(`Upscale failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setUpscaleBusy(false);
    }
  }, [connection, selected, previewUrl, refreshTree, addJob]);

  const selectedRelPath = selected?.relPath;
  const selectedKind = selected?.kind;

  useEffect(() => {
    if (!connection || !selectedRelPath || selectedKind === "dir") {
      setError(null);
      setPreviewUrl(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setPreviewUrl(getFileUrl(connection, selectedRelPath, { includeToken: true }));
  }, [connection, selectedRelPath, selectedKind]);



  const handleDownload = async () => {
    if (!previewUrl || !selected) return;
    try {
      const response = await fetch(previewUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = selected.name;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  if (!connection) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-1 border-b border-white/10 bg-white/5 px-2">
          <button
            onClick={() => setMode("preview")}
            className={`px-4 py-2 text-xs font-semibold transition-colors ${mode === "preview"
              ? "border-b-2 border-sky-500 text-white"
              : "text-slate-400 hover:text-white"
              }`}
          >
            Preview
          </button>
          <button
            onClick={() => setMode("compare")}
            className={`px-4 py-2 text-xs font-semibold transition-colors ${mode === "compare"
              ? "border-b-2 border-sky-500 text-white"
              : "text-slate-400 hover:text-white"
              }`}
          >
            Compare
          </button>
          {onToggleFullScreen && (
            <button
              onClick={onToggleFullScreen}
              className="ml-auto px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              {isFullScreen ? "Exit Full Screen" : "Full Screen"}
            </button>
          )}
        </div>
        {mode === "compare" ? (
          <ImageComparer />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="max-w-xs rounded-lg border border-dashed border-white/20 bg-gradient-to-br from-sky-500/5 to-indigo-500/5 p-6 text-center text-sm">
              <div className="mb-3 text-4xl">👁️</div>
              <div className="mb-2 font-semibold text-sky-200">
                Preview Panel
              </div>
              <div className="text-slate-300">
                Connect a workspace first, then click any file to preview it here.
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (mode === "compare") {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-1 border-b border-white/10 bg-white/5 px-2">
          <button
            onClick={() => setMode("preview")}
            className="px-4 py-2 text-xs font-semibold transition-colors text-slate-400 hover:text-white"
          >
            Preview
          </button>
          <button
            onClick={() => setMode("compare")}
            className="px-4 py-2 text-xs font-semibold transition-colors border-b-2 border-sky-500 text-white"
          >
            Compare
          </button>
          {onToggleFullScreen && (
            <button
              onClick={onToggleFullScreen}
              className="ml-auto px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              {isFullScreen ? "Exit Full Screen" : "Full Screen"}
            </button>
          )}
        </div>
        <ImageComparer />
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-1 border-b border-white/10 bg-white/5 px-2 mb-3 shrink-0">
          <button
            onClick={() => setMode("preview")}
            className="px-4 py-2 text-xs font-semibold transition-colors border-b-2 border-sky-500 text-white"
          >
            Preview
          </button>
          <button
            onClick={() => setMode("compare")}
            className="px-4 py-2 text-xs font-semibold transition-colors text-slate-400 hover:text-white"
          >
            Compare
          </button>
          {onToggleFullScreen && (
            <button
              onClick={onToggleFullScreen}
              className="ml-auto px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              {isFullScreen ? "Exit Full Screen" : "Full Screen"}
            </button>
          )}
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="max-w-xs rounded-lg border border-white/10 bg-white/5 p-6 text-center text-sm">
            <div className="mb-3 text-4xl">👈</div>
            <div className="mb-2 font-semibold text-white">
              No File Selected
            </div>
            <div className="text-slate-300">
              Click on any image or video from the file browser to see a live preview here.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (selected.kind === "dir") {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-1 border-b border-white/10 bg-white/5 px-2 mb-3 shrink-0">
          <button
            onClick={() => setMode("preview")}
            className="px-4 py-2 text-xs font-semibold transition-colors border-b-2 border-sky-500 text-white"
          >
            Preview
          </button>
          <button
            onClick={() => setMode("compare")}
            className="px-4 py-2 text-xs font-semibold transition-colors text-slate-400 hover:text-white"
          >
            Compare
          </button>
          {onToggleFullScreen && (
            <button
              onClick={onToggleFullScreen}
              className="ml-auto px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              {isFullScreen ? "Exit Full Screen" : "Full Screen"}
            </button>
          )}
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="max-w-xs rounded-lg border border-white/10 bg-white/5 p-6 text-center text-sm">
            <div className="mb-3 text-4xl">📁</div>
            <div className="mb-2 font-semibold text-white">
              Directory Selected
            </div>
            <div className="text-slate-300">
              "{selected.name}" is a folder. Select a file instead to view its contents.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col">
      {isFullScreen && onToggleFullScreen && (
        <button
          onClick={onToggleFullScreen}
          className="absolute right-4 top-4 z-50 rounded-lg bg-black/60 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-red-500/80"
        >
          Exit Full Screen
        </button>
      )}

      {!isFullScreen && (
        <div className="flex items-center gap-1 border-b border-white/10 bg-white/5 px-2 mb-3 shrink-0">
          <button
            onClick={() => setMode("preview")}
            className="px-4 py-2 text-xs font-semibold transition-colors border-b-2 border-sky-500 text-white"
          >
            Preview
          </button>
          <button
            onClick={() => setMode("compare")}
            className="px-4 py-2 text-xs font-semibold transition-colors text-slate-400 hover:text-white"
          >
            Compare
          </button>
          {onToggleFullScreen && (
            <button
              onClick={onToggleFullScreen}
              className="ml-auto px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Full Screen
            </button>
          )}
        </div>
      )}

      {/* Full-screen image editor */}
      {isFullScreen && selected.mime.startsWith("image") && previewUrl && connection ? (
        <ImageEditor
          imageUrl={previewUrl}
          imageName={selected.name}
          onSave={async (blob, filename) => {
            const directoryParts = selected.relPath.split("/");
            directoryParts.pop();
            const baseDir = directoryParts.join("/");
            const relPath = baseDir ? `${baseDir}/${filename}` : filename;
            await uploadFile(connection, relPath, blob);
            await refreshTree(relPath);
          }}
          onClose={() => onToggleFullScreen?.()}
        />
      ) : (
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto min-h-0">
          <div className="flex-1 min-h-0 rounded-2xl border border-white/10 bg-black/30 p-4">
            {error ? (
              <div className="text-sm text-rose-300">{error}</div>
            ) : !previewUrl ? (
              <div className="text-sm text-slate-400">Loading preview…</div>
            ) : (
              <div className="relative h-full w-full">
                {selected.mime.startsWith("video") ? (
                  <video
                    key={previewUrl}
                    ref={videoRef}
                    src={previewUrl}
                    crossOrigin="anonymous"
                    preload="metadata"
                    playsInline
                    controls
                    draggable={selected.kind === "file"}
                    onDragStart={handleDragStart}
                    onError={() => {
                      setLoading(false);
                      setError("Unable to load video preview.");
                    }}
                    onLoadedData={() => {
                      setLoading(false);
                    }}
                    onLoadedMetadata={handleMetadataLoaded}
                    onDurationChange={handleMetadataLoaded}
                    className="h-full w-full rounded-xl border border-white/10 bg-black object-contain"
                  />
                ) : (
                  <img
                    src={previewUrl}
                    alt={selected.name}
                    draggable={selected.kind === "file"}
                    onDragStart={handleDragStart}
                    onLoad={() => setLoading(false)}
                    onError={() => {
                      setLoading(false);
                      setError("Unable to load image preview.");
                    }}
                    className="h-full w-full rounded-xl border border-white/10 object-contain"
                  />
                )}
                {loading ? (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 text-sm text-slate-200 backdrop-blur-sm">
                    Loading preview…
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {!isFullScreen && (
            <>
              {selected && selected.mime.startsWith("video") ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-xs text-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={!canCapture || captureBusy}
                        onClick={() => void captureFrame(undefined, "Extracting current frame…")}
                        className="rounded-lg border border-white/10 px-2 py-1 font-semibold text-slate-100 transition hover:border-sky-400 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {captureBusy ? "..." : "Extract"}
                      </button>
                      <button
                        type="button"
                        disabled={!canCapture || captureBusy}
                        onClick={() => void captureFrame(0, "Extracting start frame…")}
                        className="rounded-lg border border-white/10 px-2 py-1 font-semibold text-slate-100 transition hover:border-sky-400 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Start
                      </button>
                      <button
                        type="button"
                        disabled={!canCapture || captureBusy || !videoDuration}
                        onClick={() => {
                          const endTime =
                            videoDuration ??
                            (videoRef.current?.duration && Number.isFinite(videoRef.current.duration)
                              ? videoRef.current.duration
                              : 0);
                          void captureFrame(Math.max(endTime - 0.001, 0), "Extracting end frame…");
                        }}
                        className="rounded-lg border border-white/10 px-2 py-1 font-semibold text-slate-100 transition hover:border-sky-400 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        End
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (videoRef.current) {
                            videoRef.current.load();
                          }
                        }}
                        className="rounded-lg border border-white/10 px-2 py-1 font-semibold text-slate-100 transition hover:border-sky-400 hover:text-sky-200"
                        title="Reload video if stuck"
                      >
                        ↻
                      </button>
                      <button
                        type="button"
                        disabled={upscaleBusy}
                        onClick={() => void handleUpscale()}
                        className="rounded-lg border border-white/10 px-2 py-1 font-semibold text-slate-100 transition hover:border-sky-400 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {upscaleBusy ? "..." : "Upscale"}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={pushRecreateAction}
                        className="rounded-lg border border-white/10 p-1.5 text-slate-100 transition hover:border-indigo-400 hover:text-indigo-200"
                        title="Recreate (load prompt/model used to make this file)"
                        aria-label="Recreate"
                      >
                        ⟳
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDownload()}
                        className="rounded-lg border border-white/10 p-1.5 text-slate-100 transition hover:border-sky-400 hover:text-sky-200"
                        title="Download original"
                        aria-label="Download"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  {captureStatus ? (
                    <div className="mt-2 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-[10px]">
                      {captureStatus}
                    </div>
                  ) : null}
                  {upscaleStatus ? (
                    <div className="mt-2 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-[10px]">
                      {upscaleStatus}
                    </div>
                  ) : null}
                  {quickStatus ? (
                    <div className="mt-2 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-[10px]">
                      {quickStatus}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {selected && selected.kind === "file" && selected.mime.startsWith("image") ? (
                <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <select
                        value={cropAspect}
                        onChange={(event) => setCropAspect(event.target.value)}
                        className="rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-xs text-white outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                      >
                        {cropPresets.map((preset) => (
                          <option key={preset.value} value={preset.value}>
                            {preset.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={cropBusy}
                        onClick={() => void handleCropSave()}
                        className="rounded-lg border border-white/10 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:border-sky-400 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {cropBusy ? "Cropping…" : "Crop"}
                      </button>
                      <button
                        type="button"
                        disabled={upscaleBusy}
                        onClick={() => void handleUpscale()}
                        className="rounded-lg border border-white/10 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:border-sky-400 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {upscaleBusy ? "Upscaling…" : "Upscale"}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={pushRecreateAction}
                        className="rounded-lg border border-white/10 p-1.5 text-slate-100 transition hover:border-indigo-400 hover:text-indigo-200"
                        title="Recreate (load prompt/model used to make this file)"
                        aria-label="Recreate"
                      >
                        ⟳
                      </button>
                      <button
                        type="button"
                        onClick={() => pushControlsFileAction("useStartFrame")}
                        className="rounded-lg border border-white/10 p-1.5 text-slate-100 transition hover:border-emerald-400 hover:text-emerald-200"
                        title="Use as start frame"
                        aria-label="Use as start frame"
                      >
                        ⏮
                      </button>
                      <button
                        type="button"
                        onClick={() => pushControlsFileAction("useEndFrame")}
                        className="rounded-lg border border-white/10 p-1.5 text-slate-100 transition hover:border-emerald-400 hover:text-emerald-200"
                        title="Use as end frame"
                        aria-label="Use as end frame"
                      >
                        ⏭
                      </button>
                      <button
                        type="button"
                        onClick={() => pushControlsFileAction("addReferenceImage")}
                        className="rounded-lg border border-white/10 p-1.5 text-slate-100 transition hover:border-sky-400 hover:text-sky-200"
                        title="Add as reference image"
                        aria-label="Add as reference image"
                      >
                        ⊕
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDownload()}
                        className="rounded-lg border border-white/10 p-1.5 text-slate-100 transition hover:border-sky-400 hover:text-sky-200"
                        title="Download original"
                        aria-label="Download"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  {cropStatus ? (
                    <div className="rounded-md border border-white/10 bg-black/40 px-2 py-2 text-[11px] text-slate-200">
                      {cropStatus}
                    </div>
                  ) : null}
                  {upscaleStatus ? (
                    <div className="rounded-md border border-white/10 bg-black/40 px-2 py-2 text-[11px] text-slate-200">
                      {upscaleStatus}
                    </div>
                  ) : null}
                  {quickStatus ? (
                    <div className="rounded-md border border-white/10 bg-black/40 px-2 py-2 text-[11px] text-slate-200">
                      {quickStatus}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}
