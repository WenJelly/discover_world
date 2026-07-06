import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
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
  const reduceMotion = useReducedMotion();

  // Staggered reveal: title → subtitle → actions rise and fade in together
  // as one entrance. Disabled to a static show when reduced-motion is set.
  const container: Variants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reduceMotion ? 0 : 0.12,
        delayChildren: reduceMotion ? 0 : 0.08,
      },
    },
  };
  const rise: Variants = {
    hidden: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: reduceMotion ? 0.2 : 0.6, ease: [0.22, 1, 0.36, 1] },
    },
  };

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

      <motion.div
        className="relative z-10 mx-auto max-w-4xl px-6 text-center text-white"
        variants={container}
        initial="hidden"
        animate="show"
      >
        <h1
          id="hero-heading"
          className="text-4xl font-bold tracking-tight text-balance sm:text-6xl md:text-7xl"
        >
          <span className="block overflow-hidden pb-1">
            <motion.span className="block" variants={rise}>
              发现世界的
            </motion.span>
          </span>
          <span className="block overflow-hidden pb-1">
            <motion.span className="block" variants={rise}>
              高质量图库
            </motion.span>
          </span>
        </h1>
        <motion.p
          className="mx-auto mt-6 max-w-2xl text-base text-white/85 text-pretty sm:text-lg"
          variants={rise}
        >
          海量高清原图，免费浏览与下载，让创作更自由
        </motion.p>
        <motion.div
          className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4"
          variants={rise}
        >
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
        </motion.div>
      </motion.div>
    </section>
  );
}
