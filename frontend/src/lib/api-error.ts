export type ApiErrorContext = "request" | "upload";

const REQUEST_TIMEOUT_MESSAGE = "服务响应超时，请稍后重试。";
const UPLOAD_TIMEOUT_MESSAGE =
  "图片上传超时，请检查网络后重试；如果图片较大，可以先压缩后再上传。";
const STORAGE_UPLOAD_FAILURE_MESSAGE = "图片上传到存储服务失败，请稍后重试。";
const SERVICE_UNAVAILABLE_MESSAGE = "服务暂时不可用，请稍后重试。";

function isDeadlineError(message: string) {
  const lower = message.toLowerCase();
  return (
    lower.includes("context deadline exceeded") ||
    lower.includes("deadline exceeded") ||
    lower.includes("timed out") ||
    lower.includes("timeout") ||
    message.includes("超时")
  );
}

function isObjectStorageUploadError(message: string) {
  const lower = message.toLowerCase();
  return (
    message.includes("上传 COS 失败") ||
    lower.includes("cos upload request failed") ||
    lower.includes("upload cos failed") ||
    lower.includes("object storage")
  );
}

export function normalizeApiErrorMessage(
  message: string | null | undefined,
  context: ApiErrorContext = "request"
) {
  const cleaned = `${message ?? ""}`.trim();
  if (!cleaned) return SERVICE_UNAVAILABLE_MESSAGE;

  if (isDeadlineError(cleaned)) {
    return context === "upload" ? UPLOAD_TIMEOUT_MESSAGE : REQUEST_TIMEOUT_MESSAGE;
  }

  if (context === "upload" && isObjectStorageUploadError(cleaned)) {
    return STORAGE_UPLOAD_FAILURE_MESSAGE;
  }

  return cleaned;
}
