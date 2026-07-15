import { useCallback, useEffect, useState } from "react";
import { toast as sonner } from "sonner";
import { Loader2, RefreshCw, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  ApiError,
  fetchAdminMediaAssetList,
  reviewMediaAsset,
} from "@/lib/api";
import { getMediaUrl } from "@/lib/format";
import type { MediaAssetResponse } from "@/lib/types";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
}

export function AdminMediaReviewPanel() {
  const [pendingMedia, setPendingMedia] = useState<MediaAssetResponse[]>([]);
  const [mediaReviewLoading, setMediaReviewLoading] = useState(false);
  const [mediaReviewMessage, setMediaReviewMessage] = useState("");
  const [reviewingMediaId, setReviewingMediaId] = useState("");

  const loadPendingMedia = useCallback(async () => {
    setMediaReviewLoading(true);
    try {
      const page = await fetchAdminMediaAssetList({
        auditStatus: "pending",
        pageNum: 1,
        pageSize: 24,
        variantOption: { compressType: 2 },
      });
      setPendingMedia(page.list ?? []);
    } catch {
      return;
    } finally {
      setMediaReviewLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPendingMedia();
  }, [loadPendingMedia]);

  const handleReviewMedia = async (
    asset: MediaAssetResponse,
    auditStatus: "approved" | "rejected"
  ) => {
    setReviewingMediaId(asset.id);
    try {
      await reviewMediaAsset({
        id: asset.id,
        auditStatus,
        reviewMessage: mediaReviewMessage.trim() || undefined,
      });
      setPendingMedia((current) => current.filter((item) => item.id !== asset.id));
      setMediaReviewMessage("");
      sonner.success(auditStatus === "approved" ? "作品已通过" : "作品已拒绝");
    } catch (error) {
      sonner.error("审核操作失败", {
        description: getErrorMessage(error, "请稍后重试。"),
      });
    } finally {
      setReviewingMediaId("");
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <ShieldAlert className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              媒体审核
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              查看待审核作品，并通过或拒绝公开展示。
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={mediaReviewLoading}
          aria-busy={mediaReviewLoading}
          onClick={() => void loadPendingMedia()}
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          刷新
        </Button>
      </div>
      <div className="space-y-4 px-6 py-6">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          审核备注
          <textarea
            value={mediaReviewMessage}
            onChange={(event) => setMediaReviewMessage(event.target.value)}
            placeholder="拒绝时建议填写原因，通过可留空"
            rows={3}
            className="mt-2 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        {mediaReviewLoading ? (
          <div className="flex justify-center py-12 text-slate-500">
            <Loader2
              className="size-5 animate-spin"
              aria-label="媒体审核加载中"
            />
          </div>
        ) : pendingMedia.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            暂无待审核作品
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pendingMedia.map((asset) => (
              <article
                key={asset.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="aspect-[4/3] bg-slate-200 dark:bg-slate-800">
                  <img
                    src={getMediaUrl(asset)}
                    alt={asset.title}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="space-y-3 p-4">
                  <div>
                    <h3 className="line-clamp-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {asset.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                      {asset.owner?.nickname ||
                        asset.owner?.username ||
                        "未知用户"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={reviewingMediaId === asset.id}
                      aria-busy={reviewingMediaId === asset.id}
                      onClick={() =>
                        void handleReviewMedia(asset, "approved")
                      }
                    >
                      {reviewingMediaId === asset.id ? (
                        <Spinner aria-label="加载中" />
                      ) : null}
                      通过
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={reviewingMediaId === asset.id}
                      aria-busy={reviewingMediaId === asset.id}
                      onClick={() =>
                        void handleReviewMedia(asset, "rejected")
                      }
                    >
                      拒绝
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
