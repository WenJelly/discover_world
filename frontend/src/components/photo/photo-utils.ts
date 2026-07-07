import type { PhotoExif } from "./PhotoMetadata";

/**
 * Downloads an asset by fetching it as a blob so the browser saves the file
 * instead of navigating. Falls back to opening the URL directly when the blob
 * fetch is blocked (e.g. cross-origin without CORS). Resolves `true` when a
 * download was initiated so callers can bump a download counter.
 */
export async function downloadAsset(
  url: string,
  filename?: string
): Promise<boolean> {
  if (!url) return false;
  try {
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) throw new Error(`下载失败: ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename || "photo";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
    return true;
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
    return false;
  }
}

/** Human-readable file size, e.g. "45.7MB". Empty string for non-positive input. */
export function formatFileSize(bytes: number) {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

/**
 * Best-effort EXIF parser over `metadataJson`. Tolerant of a nested `exif`
 * object or flat top-level keys; returns an empty object on any failure.
 */
export function parseExif(metadataJson?: string | null): PhotoExif {
  if (!metadataJson || !metadataJson.trim()) return {};
  try {
    const raw = JSON.parse(metadataJson) as Record<string, unknown>;
    const source = (raw.exif && typeof raw.exif === "object"
      ? (raw.exif as Record<string, unknown>)
      : raw) as Record<string, unknown>;

    const pick = (...keys: string[]): string | undefined => {
      for (const key of keys) {
        const value = source[key];
        if (value === undefined || value === null || value === "") continue;
        return String(value);
      }
      return undefined;
    };

    return {
      aperture: pick("aperture", "fNumber", "apertureValue"),
      focalLength: pick("focalLength", "focal"),
      shutterSpeed: pick("shutterSpeed", "exposureTime", "shutter"),
      iso: pick("iso", "isoSpeed", "ISOSpeedRatings"),
      cameraModel: pick("cameraModel", "model", "camera"),
      lensModel: pick("lensModel", "lens", "lensMake"),
    };
  } catch {
    return {};
  }
}
