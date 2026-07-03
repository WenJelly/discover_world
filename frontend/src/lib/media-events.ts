import type { MediaAssetResponse } from "./types";

export const MEDIA_ASSET_UPLOADED_EVENT = "discover-world:media-asset-uploaded";

export type MediaAssetUploadedEventDetail = {
  asset: MediaAssetResponse;
};

export function shouldDisplayUploadedMediaAsset(asset: MediaAssetResponse) {
  return (
    asset.status === "active" &&
    asset.visibility === "public" &&
    asset.auditStatus === "approved"
  );
}

export function notifyMediaAssetUploaded(asset: MediaAssetResponse) {
  window.dispatchEvent(
    new CustomEvent<MediaAssetUploadedEventDetail>(MEDIA_ASSET_UPLOADED_EVENT, {
      detail: { asset },
    })
  );
}
