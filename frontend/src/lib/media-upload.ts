import type { MediaAssetUploadByUrlRequest } from "./types";

export type MediaUploadMetadata = {
  id?: string;
  title?: string;
  description?: string;
  category?: string;
  tags?: string[];
  visibility?: string;
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

function titleFromUrl(parsedUrl: URL) {
  const pathName = parsedUrl.pathname.split("/").filter(Boolean).pop() ?? "";
  try {
    return stripExtension(decodeURIComponent(pathName)) || "远程图片";
  } catch {
    return stripExtension(pathName) || "远程图片";
  }
}

function appendIfPresent(formData: FormData, key: string, value?: string) {
  const cleaned = cleanText(value);
  if (cleaned) {
    formData.append(key, cleaned);
  }
}

export function buildMediaAssetUploadFormData(
  file: File,
  metadata: MediaUploadMetadata = {}
) {
  const formData = new FormData();
  const tags = cleanTags(metadata.tags);

  formData.append("file", file);
  appendIfPresent(formData, "id", metadata.id);
  formData.append("title", cleanText(metadata.title) || titleFromFileName(file.name));
  appendIfPresent(formData, "description", metadata.description);
  appendIfPresent(formData, "category", metadata.category);
  if (tags.length > 0) {
    formData.append("tags", JSON.stringify(tags));
  }
  formData.append("visibility", cleanText(metadata.visibility) || "public");

  return formData;
}

export function buildAccountAvatarUploadFormData(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return formData;
}

export function buildMediaAssetUrlUploadRequest(
  fileUrl: string,
  metadata: MediaUploadMetadata = {}
): MediaAssetUploadByUrlRequest {
  const normalizedUrl = cleanText(fileUrl);
  if (!normalizedUrl) {
    throw new Error("图片 URL 不能为空");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(normalizedUrl);
  } catch {
    throw new Error("请输入有效的图片 URL");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("仅支持 http 或 https 图片 URL");
  }

  const tags = cleanTags(metadata.tags);
  const request: MediaAssetUploadByUrlRequest = {
    fileUrl: normalizedUrl,
    title: cleanText(metadata.title) || titleFromUrl(parsedUrl),
    visibility: cleanText(metadata.visibility) || "public",
  };

  const id = cleanText(metadata.id);
  const description = cleanText(metadata.description);
  const category = cleanText(metadata.category);
  if (id) request.id = id;
  if (description) request.description = description;
  if (category) request.category = category;
  if (tags.length > 0) request.tags = tags;

  return request;
}
