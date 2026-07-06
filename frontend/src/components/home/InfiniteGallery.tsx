import { ImageOff, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useInfinitePictures } from "@/hooks/useInfinitePictures";
import { fetchHomepageConfig } from "@/lib/api";
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
  const [configuredFeatured, setConfiguredFeatured] = useState<PictureResponse[]>([]);
  const [configLoading, setConfigLoading] = useState(true);
  const galleryPictures = useMemo(
    () => configuredFeatured.length > 0 ? configuredFeatured : pictures,
    [configuredFeatured, pictures]
  );
  const displayPictures = useMemo(
    () => galleryPictures.slice(0, 20),
    [galleryPictures]
  );
  const showingConfiguredFeatured = configuredFeatured.length > 0;
  const galleryLoading = !showingConfiguredFeatured && (configLoading || loading);
  const galleryError = showingConfiguredFeatured ? null : error;
  const trackRef = useRef<HTMLDivElement | null>(null);
  const offsetRef = useRef(0);
  const lastFrameRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetchHomepageConfig({ variantOption: { compressType: 2 } })
      .then((config) => {
        if (!cancelled) setConfiguredFeatured(config.featured);
      })
      .catch(() => {
        if (!cancelled) setConfiguredFeatured([]);
      })
      .finally(() => {
        if (!cancelled) setConfigLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    offsetRef.current = 0;
    lastFrameRef.current = null;
    if (trackRef.current) {
      trackRef.current.style.transform = "translate3d(0, 0, 0)";
    }
  }, [displayPictures]);

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

    // Pause animation when not visible
    if (!isVisible) {
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
  }, [displayPictures.length, isVisible]);

  return (
    <section
      id="gallery"
      className="overflow-hidden py-16"
      role="region"
      aria-label="照片画廊"
    >
      <div className="mx-auto mb-8 max-w-7xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          精选作品流
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          {showingConfiguredFeatured
            ? "由站点管理员精选的公开作品"
            : "来自社区的最新公开作品"}
        </p>
      </div>

      {displayPictures.length === 0 && !galleryLoading && galleryError ? (
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-20 sm:px-6 lg:px-8">
          <ImageOff size={48} className="text-muted-foreground/50" aria-hidden="true" />
          <p className="text-muted-foreground">暂时无法加载作品</p>
          <button
            onClick={() => retry()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:outline-offset-2"
            aria-label="重试加载作品"
          >
            <RefreshCw size={14} aria-hidden="true" />
            重试
          </button>
        </div>
      ) : displayPictures.length === 0 && !galleryLoading ? (
        <div className="mx-auto max-w-7xl px-4 py-20 text-center text-muted-foreground sm:px-6 lg:px-8">
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
            {galleryLoading && (
              <div
                className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-foreground"
                role="status"
                aria-label="加载中"
              />
            )}
          </div>

          {galleryError && displayPictures.length > 0 && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <span className="text-sm text-muted-foreground">加载失败</span>
              <button
                onClick={() => retry()}
                className="inline-flex items-center gap-1 text-sm text-foreground transition-colors hover:underline focus-visible:outline-offset-2"
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
