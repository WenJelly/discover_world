import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export default function Hero() {
  const shouldReduceMotion = useReducedMotion();

  const fadeIn = shouldReduceMotion
    ? { initial: { opacity: 1 }, animate: { opacity: 1 } }
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
      };

  return (
    <section
      className="relative flex min-h-[60vh] items-center justify-center overflow-hidden bg-white md:min-h-[76vh]"
      aria-labelledby="hero-heading"
    >
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(24, 24, 27, 0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(24, 24, 27, 0.06) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
        <motion.h1
          id="hero-heading"
          {...fadeIn}
          transition={{ duration: shouldReduceMotion ? 0 : 0.6, ease: "easeOut" }}
          className="text-5xl font-black tracking-tighter text-zinc-950 sm:text-7xl md:text-8xl lg:text-9xl"
        >
          <span className="italic">发现</span>世界的
          <br />
          高质量图库
        </motion.h1>
        <motion.p
          {...fadeIn}
          transition={{
            duration: shouldReduceMotion ? 0 : 0.6,
            delay: shouldReduceMotion ? 0 : 0.15,
            ease: "easeOut",
          }}
          className="mx-auto mt-8 max-w-2xl text-lg text-zinc-600 sm:text-xl"
        >
          海量高清原图，免费浏览与下载，让创作更自由
        </motion.p>
        <motion.div
          {...fadeIn}
          transition={{
            duration: shouldReduceMotion ? 0 : 0.6,
            delay: shouldReduceMotion ? 0 : 0.3,
            ease: "easeOut",
          }}
          className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <a
            href="#gallery"
            className="group inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-zinc-950/10 transition-all hover:bg-zinc-800 hover:shadow-xl focus-visible:outline-offset-2"
            aria-label="开始探索图库"
          >
            开始探索
            <ArrowRight
              size={18}
              className="transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </a>
          <a
            href="#features"
            className="inline-flex items-center rounded-xl border-2 border-zinc-950 px-8 py-4 text-base font-semibold text-zinc-950 transition-all hover:bg-zinc-50 focus-visible:outline-offset-2"
            aria-label="了解更多功能"
          >
            了解更多
          </a>
        </motion.div>
      </div>
    </section>
  );
}
