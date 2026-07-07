import { useEffect, useState } from "react";
import {
  Download,
  ImageOff,
  Loader2,
  Maximize2,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface PhotoViewerProps {
  /** High-fidelity image URL for the detail view. */
  src: string;
  alt: string;
  /** Original image width / height. Used to size the fixed-height viewer. */
  aspectRatio?: number;
  displayWidth?: number;
  displayHeight?: number;
  /** Dominant color used as a placeholder while the image loads. */
  placeholderColor?: string;
  onFullscreen?: () => void;
  onDownload?: () => void;
  className?: string;
}

/**
 * Left-column image stage: shows the photo full-height without cropping, plus
 * fullscreen and download affordances.
 */
export function PhotoViewer({
  src,
  alt,
  aspectRatio,
  displayWidth,
  displayHeight,
  placeholderColor,
  onFullscreen,
  onDownload,
  className,
}: PhotoViewerProps) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    "loading"
  );

  // Reset the load state whenever the source changes.
  useEffect(() => {
    setStatus("loading");
  }, [src]);

  const safeAspectRatio =
    typeof aspectRatio === "number" && Number.isFinite(aspectRatio) && aspectRatio > 0
      ? aspectRatio
      : 4 / 5;
  const hasDisplaySize = Boolean(displayWidth && displayHeight);

  return (
    <div
      className={cn(
        "group/viewer relative max-h-full max-w-full shrink-0 overflow-hidden rounded-none bg-[#e8edf3]",
        hasDisplaySize ? "min-h-0" : "h-full min-h-[360px]",
        className
      )}
      style={{
        aspectRatio: safeAspectRatio,
        width: displayWidth,
        height: displayHeight,
        ...(placeholderColor ? { backgroundColor: placeholderColor } : {}),
      }}
    >
      <div
        className={cn(
          "relative h-full w-full",
          hasDisplaySize ? "min-h-0" : "min-h-[360px]"
        )}
      >
        {src && status !== "error" ? (
          <img
            src={src}
            alt={alt}
            loading="eager"
            onLoad={() => setStatus("loaded")}
            onError={() => setStatus("error")}
            className={cn(
              "h-full w-full object-contain transition-opacity duration-300",
              status === "loaded" ? "opacity-100" : "opacity-0"
            )}
          />
        ) : null}

        {/* Loading spinner */}
        {status === "loading" && src ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2
              className="size-6 animate-spin text-muted-foreground"
              aria-hidden="true"
            />
          </div>
        ) : null}

        {/* Error / missing state */}
        {status === "error" || !src ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageOff className="size-8" aria-hidden="true" />
            <span className="text-sm">图片加载失败</span>
          </div>
        ) : null}
      </div>

      {/* Fullscreen + download, bottom-right */}
      <div className="absolute bottom-4 right-4 flex items-center gap-2.5">
        {onFullscreen ? (
          <button
            type="button"
            onClick={onFullscreen}
            aria-label="全屏查看"
            className="flex size-10 items-center justify-center rounded-full bg-black/55 text-white shadow-md backdrop-blur-sm transition-all hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <Maximize2 className="size-4" aria-hidden="true" />
          </button>
        ) : null}
        {onDownload ? (
          <button
            type="button"
            onClick={onDownload}
            aria-label="下载图片"
            className="flex size-10 items-center justify-center rounded-full bg-black/55 text-white shadow-md backdrop-blur-sm transition-all hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <Download className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
