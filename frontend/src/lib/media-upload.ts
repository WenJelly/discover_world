import type { MediaAssetDirectUploadInitRequest } from "./types";

export const MEDIA_UPLOAD_ACCEPT =
  ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function isSupportedUploadImageFile(file: File) {
  const mimeType = file.type.trim().toLowerCase();
  if (mimeType) {
    return SUPPORTED_IMAGE_MIME_TYPES.has(mimeType);
  }
  return /\.(?:jpe?g|png|webp)$/i.test(file.name);
}

export type MediaUploadMetadata = {
  id?: string;
  title?: string;
  description?: string;
  category?: string;
  tags?: string[];
  visibility?: string;
  assetUsage?: string;
};

export type MediaDirectUploadImageMetadata = {
  width?: number;
  height?: number;
  dominantColor?: string;
  blurHash?: string;
};

function cleanText(value?: string) {
  return value?.trim() ?? "";
}

function cleanTags(tags?: string[]) {
  return (tags ?? []).map((tag) => tag.trim()).filter(Boolean);
}

function stripExtension(value: string) {
  const cleaned = value.trim();
  const lastDotIndex = cleaned.lastIndexOf(".");
  if (lastDotIndex <= 0) return cleaned;
  return cleaned.slice(0, lastDotIndex);
}

function titleFromFileName(fileName: string) {
  return stripExtension(fileName) || "本地图片";
}

export function buildMediaAssetDirectUploadInitRequest(
  file: File,
  metadata: MediaUploadMetadata = {},
  imageMetadata: MediaDirectUploadImageMetadata = {}
): MediaAssetDirectUploadInitRequest {
  const tags = cleanTags(metadata.tags);
  const request: MediaAssetDirectUploadInitRequest = {
    fileName: file.name,
    fileSize: file.size,
    contentType: cleanText(file.type),
    title: cleanText(metadata.title) || titleFromFileName(file.name),
    visibility: cleanText(metadata.visibility) || "public",
    assetUsage: cleanText(metadata.assetUsage) || "work",
  };

  const id = cleanText(metadata.id);
  const description = cleanText(metadata.description);
  const category = cleanText(metadata.category);
  const dominantColor = cleanText(imageMetadata.dominantColor);
  const blurHash = cleanText(imageMetadata.blurHash);
  if (id) request.id = id;
  if (description) request.description = description;
  if (category) request.category = category;
  if (tags.length > 0) request.tags = tags;
  if (imageMetadata.width && imageMetadata.width > 0) {
    request.width = Math.round(imageMetadata.width);
  }
  if (imageMetadata.height && imageMetadata.height > 0) {
    request.height = Math.round(imageMetadata.height);
  }
  if (dominantColor) request.dominantColor = dominantColor;
  if (blurHash) request.blurHash = blurHash;

  return request;
}
