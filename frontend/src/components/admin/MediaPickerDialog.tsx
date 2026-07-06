import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Check, ImageOff, Loader2, RefreshCw, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ApiError, fetchMediaAssetCursorList } from "@/lib/api";
import { getMediaUrl } from "@/lib/format";
import type { MediaAssetResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 24;

export type MediaPickerMode = "single" | "multiple";

type MediaPickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: MediaPickerMode;
  title: string;
  description: string;
  /**
   * Asset ids that are already part of the caller's selection. They render as
   * "已选" and cannot be picked again; removal happens in the caller's list.
   */
  excludedIds?: string[];
  /** How many more works may still be picked (multiple mode). */
  maxCount?: number;
  /** Limit the list to one owner's published works. */
  ownerUserId?: string;
  /**
   * Managed mode: assets pre-selected when the dialog opens. Unchecking them
   * removes; confirming an empty selection clears the whole collection.
   */
  initialSelected?: MediaAssetResponse[];
  confirmLabel?: string;
  /** Return false or reject to keep the dialog open. */
  onConfirm: (
    assets: MediaAssetResponse[]
  ) => void | boolean | Promise<void | boolean>;
};

type LoadState = {
  assets: MediaAssetResponse[];
  hasMore: boolean;
  loading: boolean;
  error: string | null;
};

/**
 * Picker over the site's public (approved) works, shared by the hero selector
 * (single) and the featured-stream selector (multiple, append-only).
 */
export function MediaPickerDialog({
  open,
  onOpenChange,
  mode,
  title,
  description,
  excludedIds = [],
  maxCount,
  ownerUserId,
  initialSelected,
  confirmLabel = "确认选择",
  onConfirm,
}: MediaPickerDialogProps) {
  const [searchInput, setSearchInput] = useState("");
  const [searchText, setSearchText] = useState("");
  const [loadState, setLoadState] = useState<LoadState>({
    assets: [],
    hasMore: true,
    loading: false,
    error: null,
  });
  const [selected, setSelected] = useState<Map<string, MediaAssetResponse>>(
    () => new Map()
  );
  const cursorRef = useRef<string | null>(null);
  const requestVersionRef = useRef(0);
  const [confirming, setConfirming] = useState(false);
  const isManaged = initialSelected != null;
  const initialSelectedRef = useRef(initialSelected);
  initialSelectedRef.current = initialSelected;

  const excludedIdSet = useMemo(() => new Set(excludedIds), [excludedIds]);
  const selectionFull =
    mode === "multiple" && maxCount != null && selected.size >= maxCount;

  const loadPage = useCallback(async (reset: boolean, keyword: string) => {
    const version = ++requestVersionRef.current;
    if (reset) {
      cursorRef.current = null;
    }
    setLoadState((s) => ({
      assets: reset ? [] : s.assets,
      hasMore: reset ? true : s.hasMore,
      loading: true,
      error: null,
    }));

    try {
      const page = await fetchMediaAssetCursorList({
        pageSize: PAGE_SIZE,
        cursor: cursorRef.current ?? undefined,
        searchText: keyword || undefined,
        ownerUserId,
        variantOption: { compressType: 2 },
      });
      if (version !== requestVersionRef.current) return;

      cursorRef.current = page.nextCursor || null;
      setLoadState((s) => {
        const seen = new Set(reset ? [] : s.assets.map((a) => a.id));
        const fresh = (page.list ?? []).filter((a) => !seen.has(a.id));
        return {
          assets: reset ? fresh : [...s.assets, ...fresh],
          hasMore: page.hasMore && Boolean(page.nextCursor),
          loading: false,
          error: null,
        };
      });
    } catch (error) {
      if (version !== requestVersionRef.current) return;
      setLoadState((s) => ({
        ...s,
        loading: false,
        error:
          error instanceof ApiError
            ? error.message
            : "作品加载失败，请稍后重试",
      }));
    }
  }, [ownerUserId]);

  // Reset search + selection every time the dialog opens so stale state from
  // a previous session never leaks into a new pick.
  useEffect(() => {
    if (!open) return;
    setSearchInput("");
    setSearchText("");
    setSelected(
      new Map(
        (initialSelectedRef.current ?? []).map((asset) => [asset.id, asset])
      )
    );
    loadPage(true, "");
  }, [open, loadPage]);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const keyword = searchInput.trim();
    setSearchText(keyword);
    loadPage(true, keyword);
  };

  const clearSearch = () => {
    setSearchInput("");
    if (searchText) {
      setSearchText("");
      loadPage(true, "");
    }
  };

  const toggleAsset = (asset: MediaAssetResponse) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (mode === "single") {
        const wasSelected = next.has(asset.id);
        next.clear();
        if (!wasSelected) {
          next.set(asset.id, asset);
        }
        return next;
      }

      if (next.has(asset.id)) {
        next.delete(asset.id);
      } else if (maxCount == null || next.size < maxCount) {
        next.set(asset.id, asset);
      }
      return next;
    });
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const result = await onConfirm(Array.from(selected.values()));
      if (result === false) return;
      onOpenChange(false);
    } catch {
      // Caller surfaces the error; keep this dialog open for retry.
    } finally {
      setConfirming(false);
    }
  };

  const { assets, hasMore, loading, error } = loadState;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-0 p-0">
        <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <DialogHeader className="text-left">
            <DialogTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 dark:text-slate-400">
              {description}
            </DialogDescription>
          </DialogHeader>

          <form
            role="search"
            className="relative mt-4"
            onSubmit={handleSearchSubmit}
          >
            <label htmlFor="media-picker-search" className="sr-only">
              搜索公开作品
            </label>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
              strokeWidth={2.5}
            />
            <Input
              id="media-picker-search"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="按标题、描述搜索公开作品"
              autoComplete="off"
              className={cn(
                "h-10 rounded-lg pl-9",
                searchInput ? "pr-10" : "pr-3"
              )}
            />
            {searchInput ? (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="清空搜索"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                <X className="size-4" strokeWidth={2.5} />
              </button>
            ) : null}
          </form>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {assets.length === 0 && loading ? (
            <div
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
              role="status"
              aria-label="作品加载中"
            >
              {Array.from({ length: 8 }, (_, index) => (
                <div
                  key={index}
                  className="aspect-square animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800"
                />
              ))}
            </div>
          ) : assets.length === 0 && error ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <ImageOff
                size={40}
                className="text-slate-300 dark:text-slate-600"
                aria-hidden="true"
              />
              <p className="text-sm text-slate-500 dark:text-slate-400">{error}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => loadPage(true, searchText)}
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                重试
              </Button>
            </div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <ImageOff
                size={40}
                className="text-slate-300 dark:text-slate-600"
                aria-hidden="true"
              />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {searchText
                  ? `没有找到与「${searchText}」相关的公开作品`
                  : "暂无公开作品可供选择"}
              </p>
            </div>
          ) : (
            <>
              <ul
                className="grid list-none grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
                aria-label="公开作品列表"
              >
                {assets.map((asset) => {
                  const isExcluded = excludedIdSet.has(asset.id);
                  const isSelected = selected.has(asset.id);
                  const disabled =
                    isExcluded || confirming || (!isSelected && selectionFull);
                  const ownerName =
                    asset.owner?.nickname || asset.owner?.username || "";

                  return (
                    <li key={asset.id}>
                      <button
                        type="button"
                        onClick={() => toggleAsset(asset)}
                        disabled={disabled}
                        aria-pressed={isSelected}
                        aria-label={
                          isExcluded
                            ? `作品「${asset.title}」已在列表中`
                            : `${isSelected ? "取消选择" : "选择"}作品「${asset.title}」${ownerName ? `，作者 ${ownerName}` : ""}`
                        }
                        className={cn(
                          "group relative block w-full cursor-pointer overflow-hidden rounded-lg border-2 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900",
                          isSelected
                            ? "border-indigo-500 shadow-md shadow-indigo-500/10"
                            : "border-transparent hover:border-slate-300 dark:hover:border-slate-600",
                          disabled && "cursor-not-allowed opacity-40"
                        )}
                      >
                        <div className="aspect-square bg-slate-100 dark:bg-slate-800">
                          <img
                            src={getMediaUrl(asset)}
                            alt={asset.title}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                          />
                        </div>
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-6">
                          <p className="truncate text-xs font-medium text-white">
                            {asset.title}
                          </p>
                          {ownerName ? (
                            <p className="truncate text-[11px] text-white/70">
                              {ownerName}
                            </p>
                          ) : null}
                        </div>
                        {isExcluded ? (
                          <span className="absolute right-2 top-2 rounded-full bg-slate-900/70 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
                            已选
                          </span>
                        ) : (
                          <span
                            aria-hidden="true"
                            className={cn(
                              "absolute right-2 top-2 flex size-6 items-center justify-center rounded-full border-2 transition-all duration-150",
                              isSelected
                                ? "border-indigo-500 bg-indigo-500 text-white"
                                : "border-white/80 bg-black/20 text-transparent backdrop-blur-sm group-hover:border-white"
                            )}
                          >
                            <Check className="size-3.5" strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div className="flex items-center justify-center pt-5">
                {loading ? (
                  <Loader2
                    className="size-5 animate-spin text-slate-400"
                    role="status"
                    aria-label="加载中"
                  />
                ) : error ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => loadPage(false, searchText)}
                  >
                    <RefreshCw className="size-3.5" aria-hidden="true" />
                    加载失败，点击重试
                  </Button>
                ) : hasMore ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => loadPage(false, searchText)}
                  >
                    加载更多
                  </Button>
                ) : (
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    已加载全部公开作品
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
          <p
            className="text-sm text-slate-500 dark:text-slate-400"
            aria-live="polite"
          >
            {mode === "multiple"
              ? isManaged
                ? maxCount != null
                  ? `已选 ${selected.size} / ${maxCount} 张`
                  : `已选 ${selected.size} 张`
                : maxCount != null
                  ? `本次新增 ${selected.size} 张（还可添加 ${Math.max(0, maxCount - selected.size)} 张）`
                  : `本次新增 ${selected.size} 张`
              : selected.size > 0
                ? "已选 1 张作品"
                : "尚未选择作品"}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={confirming}
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              disabled={confirming || (selected.size === 0 && !isManaged)}
              onClick={handleConfirm}
            >
              {confirming ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {confirmLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
