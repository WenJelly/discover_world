import { ImageOff, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
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
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    offsetRef.current = 0;
    lastFrameRef.current = null;
    if (trackRef.current) {
      trackRef.current.style.transform = "translate3d(0, 0, 0)";
    }
  }, [pictures]);

  // Intersection Observer to pause when not visible
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(track);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || displayPictures.length <= 1) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion) return;

    // Pause animation when hovered or not visible
    if (isHovered || !isVisible) {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      lastFrameRef.current = null;
      return;
    }

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
  }, [displayPictures.length, isHovered, isVisible]);

  return (
    <section
      id="gallery"
      className="overflow-hidden py-16"
      role="region"
      aria-label="照片画廊"
    >
      <div className="mx-auto mb-8 max-w-7xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-white sm:text-4xl">
          精选作品流
        </h2>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          控制首屏加载数量，保留顺滑浏览体验
        </p>
      </div>

      {pictures.length === 0 && !loading && error ? (
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-20 sm:px-6 lg:px-8">
          <ImageOff size={48} className="text-zinc-300" aria-hidden="true" />
          <p className="text-zinc-600">暂时无法加载作品</p>
          <button
            onClick={() => retry()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-950 px-4 py-2 text-sm text-white transition-colors hover:bg-zinc-800 focus-visible:outline-offset-2 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
            aria-label="重试加载作品"
          >
            <RefreshCw size={14} aria-hidden="true" />
            重试
          </button>
        </div>
      ) : pictures.length === 0 && !loading ? (
        <div className="mx-auto max-w-7xl px-4 py-20 text-center text-zinc-600 sm:px-6 lg:px-8">
          暂无作品
        </div>
      ) : (
        <>
          <div
            className="w-full overflow-hidden"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
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
              <div
                className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-950 dark:border-zinc-700 dark:border-t-white"
                role="status"
                aria-label="加载中"
              />
            )}
          </div>

          {error && pictures.length > 0 && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <span className="text-sm text-zinc-600">加载失败</span>
              <button
                onClick={() => retry()}
                className="inline-flex items-center gap-1 text-sm text-zinc-950 transition-colors hover:underline focus-visible:outline-offset-2 dark:text-zinc-400"
                aria-label="重试加载更多作品"
              >
                <RefreshCw size={14} aria-hidden="true" />
                重试
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
