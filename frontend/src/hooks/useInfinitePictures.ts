import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, fetchPictureCursorList } from "@/lib/api";
import {
  MEDIA_ASSET_UPLOADED_EVENT,
  shouldDisplayUploadedMediaAsset,
  type MediaAssetUploadedEventDetail,
} from "@/lib/media-events";
import type { PictureResponse } from "@/lib/types";

export type UseInfinitePicturesOptions = {
  pageSize?: number;
  category?: string;
  searchText?: string;
  tags?: string[];
};

type State = {
  pictures: PictureResponse[];
  hasMore: boolean;
  loading: boolean;
  error: ApiError | null;
};

const INITIAL: State = {
  pictures: [],
  hasMore: true,
  loading: false,
  error: null,
};

function normalizeTags(tags?: string[]) {
  return tags
    ?.map((tag) => tag.trim())
    .filter((tag): tag is string => tag.length > 0);
}

export function useInfinitePictures(
  options: number | UseInfinitePicturesOptions = {}
) {
  const normalizedOptions =
    typeof options === "number" ? { pageSize: options } : options;
  const pageSize = normalizedOptions.pageSize ?? 30;
  const category = normalizedOptions.category?.trim() || undefined;
  const searchText = normalizedOptions.searchText?.trim() || undefined;
  const tagsKey = normalizeTags(normalizedOptions.tags)?.join("|") ?? "";
  const [state, setState] = useState<State>(INITIAL);
  const cursorRef = useRef<string | null>(null);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const requestVersionRef = useRef(0);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) {
      return;
    }

    const requestVersion = requestVersionRef.current;
    loadingRef.current = true;
    setState((s) => {
      if (s.loading || !s.hasMore) return s;
      return { ...s, loading: true, error: null };
    });

    try {
      const cursor = cursorRef.current;
      const res = await fetchPictureCursorList({
        pageSize,
        category,
        searchText,
        ...(tagsKey ? { tags: tagsKey.split("|") } : {}),
        compressPictureType: { compressType: 2 },
        ...(cursor ? { cursor } : {}),
      });
      const nextHasMore = res.hasMore && !!res.nextCursor;

      if (requestVersion !== requestVersionRef.current) {
        return;
      }

      cursorRef.current = res.nextCursor || null;
      loadingRef.current = false;
      hasMoreRef.current = nextHasMore;
      setState((s) => ({
        pictures: [...s.pictures, ...res.list],
        hasMore: nextHasMore,
        loading: false,
        error: null,
      }));
    } catch (e) {
      if (requestVersion !== requestVersionRef.current) {
        return;
      }

      const err = e instanceof ApiError ? e : new ApiError(0, "未知错误");
      loadingRef.current = false;
      setState((s) => ({ ...s, loading: false, error: err }));
    }
  }, [category, pageSize, searchText, tagsKey]);

  const retry = useCallback(() => {
    loadMore();
  }, [loadMore]);

  useEffect(() => {
    requestVersionRef.current += 1;
    cursorRef.current = null;
    loadingRef.current = false;
    hasMoreRef.current = true;
    setState(INITIAL);
  }, [category, pageSize, searchText, tagsKey]);

  useEffect(() => {
    loadMore();
  }, [loadMore]);

  useEffect(() => {
    const handleUploaded = (event: Event) => {
      const asset = (event as CustomEvent<MediaAssetUploadedEventDetail>).detail?.asset;
      if (!asset || !shouldDisplayUploadedMediaAsset(asset)) {
        return;
      }

      setState((current) => {
        if (current.pictures.some((picture) => picture.id === asset.id)) {
          return current;
        }

        return {
          ...current,
          pictures: [asset, ...current.pictures],
        };
      });
    };

    window.addEventListener(MEDIA_ASSET_UPLOADED_EVENT, handleUploaded);
    return () => window.removeEventListener(MEDIA_ASSET_UPLOADED_EVENT, handleUploaded);
  }, []);

  return { ...state, loadMore, retry };
}
