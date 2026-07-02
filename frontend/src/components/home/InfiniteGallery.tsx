import { ImageOff, RefreshCw } from "lucide-react";
import { useEffect, useRef, type CSSProperties } from "react";
import { useInfinitePictures } from "@/hooks/useInfinitePictures";
import type { PictureResponse } from "@/lib/types";
import { PictureCard } from "./PictureCard";

const MARQUEE_SPEED_PX_PER_SECOND = 36;
const PHOTO_GAP_PX = 16;

function getPhotoRatio(picture: PictureResponse) {
  if (picture.picWidth > 0 && picture.picHeight > 0) {
    return Math.max(0.65, Math.min(picture.picWidth / picture.picHeight, 2.4));
  }

  return 4 / 3;
}

export default function InfiniteGallery() {
  const { pictures, loading, error, retry } = useInfinitePictures(20);
  const displayPictures = pictures.slice(0, 20);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const offsetRef = useRef(0);
  const lastFrameRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    offsetRef.current = 0;
    lastFrameRef.current = null;
    if (trackRef.current) {
      trackRef.current.style.transform = "translate3d(0, 0, 0)";
    }
  }, [pictures]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || displayPictures.length <= 1) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion) return;

    const getFirstItemDistance = () => {
      const firstItem = track.firstElementChild;
      if (!(firstItem instanceof HTMLElement)) return 0;

      const styles = window.getComputedStyle(track);
      const gap = Number.parseFloat(styles.columnGap || styles.gap);
      return (
        firstItem.getBoundingClientRect().width +
        (Number.isNaN(gap) ? PHOTO_GAP_PX : gap)
      );
    };

    const recycleOffscreenItems = (offset: number) => {
      let nextOffset = offset;
      let recycleCount = 0;
      let firstItemDistance = getFirstItemDistance();

      while (
        firstItemDistance > 0 &&
        nextOffset >= firstItemDistance &&
        recycleCount < displayPictures.length
      ) {
        nextOffset -= firstItemDistance;
        const firstItem = track.firstElementChild;
        if (firstItem) {
          track.appendChild(firstItem);
        }
        recycleCount += 1;
        firstItemDistance = getFirstItemDistance();
      }

      return nextOffset;
    };

    const moveTrack = (offset: number) => {
      track.style.transform = `translate3d(${-offset}px, 0, 0)`;
    };

    const animate = (now: number) => {
      if (lastFrameRef.current === null) {
        lastFrameRef.current = now;
      }

      const elapsedSeconds = Math.min(
        (now - lastFrameRef.current) / 1000,
        0.08
      );
      lastFrameRef.current = now;

      const nextOffset = recycleOffscreenItems(
        offsetRef.current + elapsedSeconds * MARQUEE_SPEED_PX_PER_SECOND
      );
      offsetRef.current = nextOffset;
      moveTrack(nextOffset);
      frameRef.current = window.requestAnimationFrame(animate);
    };

    frameRef.current = window.requestAnimationFrame(animate);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [displayPictures.length]);

  return (
    <section id="gallery" className="overflow-hidden py-16">
      <div className="mx-auto mb-8 max-w-7xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          精选作品流
        </h2>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          控制首屏加载数量,保留顺滑浏览体验
        </p>
      </div>

      {pictures.length === 0 && !loading && error ? (
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-20 sm:px-6 lg:px-8">
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
        <div className="mx-auto max-w-7xl px-4 py-20 text-center text-slate-500 sm:px-6 lg:px-8">
          暂无作品
        </div>
      ) : (
        <>
          <div className="w-full overflow-hidden">
            <div
              ref={trackRef}
              className="flex w-max gap-4 will-change-transform [--photo-height:220px] lg:[--photo-height:300px]"
            >
              {displayPictures.map((p) => (
                <div
                  key={p.id}
                  className="h-[var(--photo-height)] shrink-0"
                  style={
                    {
                      "--photo-ratio": getPhotoRatio(p),
                      width:
                        "calc(var(--photo-ratio) * var(--photo-height))",
                    } as CSSProperties
                  }
                >
                  <PictureCard picture={p} />
                </div>
              ))}
            </div>
          </div>

          <div className="flex h-14 items-center justify-center">
            {loading && (
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900 dark:border-slate-700 dark:border-t-white" />
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
