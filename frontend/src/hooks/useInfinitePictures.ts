import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, fetchPictureCursorList } from "@/lib/api";
import type { PictureResponse } from "@/lib/types";

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

export function useInfinitePictures(pageSize: number = 30) {
  const [state, setState] = useState<State>(INITIAL);
  const cursorRef = useRef<string | null>(null);

  const loadMore = useCallback(async () => {
    let shouldProceed = false;
    setState((s) => {
      if (s.loading || !s.hasMore) return s;
      shouldProceed = true;
      return { ...s, loading: true, error: null };
    });
    if (!shouldProceed) return;

    try {
      const cursor = cursorRef.current;
      const res = await fetchPictureCursorList({
        pageSize,
        compressPictureType: { compressType: 1 },
        ...(cursor ? { cursor } : {}),
      });
      cursorRef.current = res.nextCursor || null;
      setState((s) => ({
        pictures: [...s.pictures, ...res.list],
        hasMore: res.hasMore && !!res.nextCursor,
        loading: false,
        error: null,
      }));
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, "未知错误");
      setState((s) => ({ ...s, loading: false, error: err }));
    }
  }, [pageSize]);

  const retry = useCallback(() => {
    loadMore();
  }, [loadMore]);

  useEffect(() => {
    loadMore();
  }, [loadMore]);

  return { ...state, loadMore, retry };
}
