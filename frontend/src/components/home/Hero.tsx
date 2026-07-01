import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { fetchPictureList } from "@/lib/api";
import type { PictureResponse } from "@/lib/types";
import { useInView } from "@/hooks/useInView";
import HeroPhotoRing from "./HeroPhotoRing";

const FALLBACK_PHOTOS = Array.from({ length: 16 }, (_, i) =>
  `https://picsum.photos/seed/wenjelly-${i + 1}/800/1000`
);

export default function Hero() {
  const [photos, setPhotos] = useState<string[]>(FALLBACK_PHOTOS);
  const [containerRef, inView] = useInView<HTMLDivElement>({ once: false });

  useEffect(() => {
    let cancelled = false;
    fetchPictureList({ pageSize: 24, compressPictureType: { compressType: 1 } })
      .then((res) => {
        if (cancelled) return;
        const urls = res.list
          .map((p: PictureResponse) => p.thumbnailUrl)
          .filter((u): u is string => !!u);
        if (urls.length >= 8) setPhotos(urls);
      })
      .catch(() => {
        // keep fallback
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative flex h-screen items-center justify-center overflow-hidden bg-slate-950"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.15),transparent_60%)]" />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="absolute inset-0" aria-hidden="true">
        {inView && <HeroPhotoRing photos={photos} />}
      </div>

      <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="bg-gradient-to-r from-white via-indigo-100 to-indigo-300 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-6xl"
        >
          发现世界的高质量图库
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="mx-auto mt-6 max-w-xl text-base text-slate-300 sm:text-lg"
        >
          海量高清原图,免费浏览与下载,让创作更自由
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
          className="mt-10 flex items-center justify-center gap-4"
        >
          <a
            href="#gallery"
            className="group inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-500"
          >
            开始探索
            <ArrowRight
              size={16}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </a>
          <a
            href="#features"
            className="inline-flex items-center rounded-xl border border-white/20 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
          >
            了解更多
          </a>
        </motion.div>
      </div>
    </section>
  );
}
