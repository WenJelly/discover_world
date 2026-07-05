import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { fetchMediaAssetCursorList } from "@/lib/api";
import { getMediaDetailUrl, getMediaUrl } from "@/lib/format";
import {
  HERO_WAVE_ASPECT_CLASS,
  HERO_WAVE_PATH,
  HERO_WAVE_VIEW_BOX,
} from "@/lib/hero-wave";
import type { MediaAssetResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function Hero() {
  const [photo, setPhoto] = useState<MediaAssetResponse | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchMediaAssetCursorList({ pageSize: 1, variantOption: { compressType: 1 } })
      .then((resp) => {
        if (!cancelled) setPhoto(resp.list[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setPhoto(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const bgUrl = photo ? getMediaDetailUrl(photo) || getMediaUrl(photo) : "";

  return (
    <section
      className="relative flex min-h-[70vh] items-center justify-center overflow-hidden bg-zinc-950 md:min-h-[82vh]"
      aria-labelledby="hero-heading"
    >
      {bgUrl ? (
        <img
          src={bgUrl}
          alt=""
          aria-hidden="true"
          loading="eager"
          fetchPriority="high"
          className={cn(
            "absolute inset-0 h-full w-full object-cover object-[center_58%] transition-opacity duration-700 motion-reduce:transition-none",
            loaded ? "opacity-100" : "opacity-0"
          )}
          onLoad={() => setLoaded(true)}
        />
      ) : null}
      {/* Scrim for text contrast over a variable photo — functional, not decorative */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/25 to-black/55"
        aria-hidden="true"
      />

      {/* Wavy bottom edge — page bg laps up into the hero */}
      <div
        className={cn(
          "absolute -bottom-px left-0 right-0 z-[1] w-full",
          HERO_WAVE_ASPECT_CLASS
        )}
        aria-hidden="true"
      >
        <svg
          viewBox={HERO_WAVE_VIEW_BOX}
          preserveAspectRatio="none"
          className="block h-full w-full"
        >
          <path
            style={{ fill: "var(--background)" }}
            d={HERO_WAVE_PATH}
          />
        </svg>
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center text-white">
        <h1
          id="hero-heading"
          className="text-4xl font-bold tracking-tight text-balance sm:text-6xl md:text-7xl"
        >
          发现世界的
          <br />
          高质量图库
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base text-white/85 text-pretty sm:text-lg">
          海量高清原图，免费浏览与下载，让创作更自由
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <a
            href="#gallery"
            className="group inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3 text-sm font-semibold text-slate-950 shadow-lg transition-colors hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            aria-label="开始探索图库"
          >
            开始探索
            <ArrowRight
              size={16}
              className="transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </a>
          <a
            href="#features"
            className="inline-flex items-center rounded-xl border border-white/30 px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            aria-label="了解更多"
          >
            了解更多
          </a>
        </div>
      </div>
    </section>
  );
}
