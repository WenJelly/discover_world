import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { MediaAssetDownloadResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

import { downloadAsset, formatFileSize } from "./photo-utils";

interface DownloadButtonProps {
  /** Direct URL to the original asset. Empty string disables the button. */
  url: string;
  /** Suggested filename for the saved file. */
  filename?: string;
  /** Original file size in bytes; rendered as a "(45.7MB)" suffix when > 0. */
  fileSize?: number;
  /** Whether the viewer is permitted to download the original. */
  canDownload?: boolean;
  /** Optionally asks the backend to authorize and count the download first. */
  onDownloadRequest?: () => Promise<MediaAssetDownloadResponse>;
  /** Fired after a download is initiated (e.g. to bump the download count). */
  onDownloaded?: (response?: MediaAssetDownloadResponse) => void;
  className?: string;
}

/**
 * Primary "下载原图" action. Fetches the asset as a blob so the browser saves
 * it instead of navigating, with a loading state for the round-trip.
 */
export function DownloadButton({
  url,
  filename,
  fileSize = 0,
  canDownload = true,
  onDownloadRequest,
  onDownloaded,
  className,
}: DownloadButtonProps) {
  const [loading, setLoading] = useState(false);
  const sizeLabel = formatFileSize(fileSize);
  const disabled = (!url && !onDownloadRequest) || !canDownload || loading;

  const handleDownload = async () => {
    if (disabled) return;
    setLoading(true);
    try {
      if (onDownloadRequest) {
        const res = await onDownloadRequest();
        const ok = await downloadAsset(res.url, res.filename || filename);
        if (ok) onDownloaded?.(res);
        return;
      }
      const ok = await downloadAsset(url, filename);
      if (ok) onDownloaded?.();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      onClick={handleDownload}
      disabled={disabled}
      className={cn(
        "bg-blue-600 text-white hover:bg-blue-600/90",
        className
      )}
      aria-label="下载原图"
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Download className="size-4" aria-hidden="true" />
      )}
      {canDownload ? "下载原图" : "无下载权限"}
      {canDownload && sizeLabel ? (
        <span className="opacity-80">({sizeLabel})</span>
      ) : null}
    </Button>
  );
}
