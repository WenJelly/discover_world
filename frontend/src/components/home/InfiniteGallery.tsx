import { useEffect } from "react";
import { ImageOff, RefreshCw } from "lucide-react";
import { useInfinitePictures } from "@/hooks/useInfinitePictures";
import { useInView } from "@/hooks/useInView";
import { PictureCard } from "./PictureCard";

export default function InfiniteGallery() {
  const { pictures, hasMore, loading, error, loadMore, retry } =
    useInfinitePictures(30);
  const [sentinelRef, inView] = useInView<HTMLDivElement>({
    rootMargin: "400px",
    once: false,
  });

  useEffect(() => {
    if (inView && hasMore && !loading) {
      loadMore();
    }
  }, [inView, hasMore, loading, loadMore]);

  return (
    <section
      id="gallery"
      className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8"
    >
      <div className="mb-10 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          实时作品流
        </h2>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          来自社区的最新高质量图片,持续滚动加载
        </p>
      </div>

      {pictures.length === 0 && !loading && error ? (
        <div className="flex flex-col items-center gap-4 py-20">
          <ImageOff size={48} className="text-slate-300" />
          <p className="text-slate-500">暂时无法加载作品</p>
          <button
            onClick={() => retry()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            <RefreshCw size={14} />
            重试
          </button>
        </div>
      ) : pictures.length === 0 && !loading ? (
        <div className="py-20 text-center text-slate-500">暂无作品</div>
      ) : (
        <>
          <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
            {pictures.map((p) => (
              <div key={p.id} className="mb-4 break-inside-avoid">
                <PictureCard picture={p} />
              </div>
            ))}
          </div>

          <div
            ref={sentinelRef}
            className="flex h-20 items-center justify-center"
          >
            {loading && (
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900 dark:border-slate-700 dark:border-t-white" />
            )}
            {!loading && hasMore && (
              <button
                onClick={() => loadMore()}
                className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                加载更多
              </button>
            )}
            {!loading && !hasMore && pictures.length > 0 && (
              <span className="text-sm text-slate-400">已浏览全部</span>
            )}
          </div>

          {error && pictures.length > 0 && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <span className="text-sm text-slate-500">加载失败</span>
              <button
                onClick={() => retry()}
                className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline dark:text-indigo-400"
              >
                <RefreshCw size={14} />
                重试
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
