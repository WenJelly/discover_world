import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Upload, Image } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function CTA() {
  const shouldReduceMotion = useReducedMotion();
  const { user } = useAuth();

  const fadeIn = shouldReduceMotion
    ? { initial: { opacity: 1 }, animate: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
      };

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-zinc-900 to-zinc-950 py-24">
      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <motion.h2
          {...fadeIn}
          whileInView={fadeIn.animate}
          viewport={{ once: true }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.5 }}
          className="text-3xl font-bold tracking-tight text-white sm:text-5xl"
        >
          把你的作品放进世界
        </motion.h2>
        <motion.p
          {...fadeIn}
          whileInView={fadeIn.animate}
          viewport={{ once: true }}
          transition={{
            duration: shouldReduceMotion ? 0 : 0.5,
            delay: shouldReduceMotion ? 0 : 0.12,
          }}
          className="mx-auto mt-4 max-w-xl text-base text-zinc-300 sm:text-lg"
        >
          上传即进入社区审核，通过后向所有人开放浏览与下载
        </motion.p>
        <motion.div
          {...fadeIn}
          whileInView={fadeIn.animate}
          viewport={{ once: true }}
          transition={{
            duration: shouldReduceMotion ? 0 : 0.5,
            delay: shouldReduceMotion ? 0 : 0.24,
          }}
          className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4"
        >
          {user ? (
            <>
              <a
                href="/upload"
                className="group inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-zinc-950 shadow-xl transition-all hover:scale-105 hover:shadow-2xl focus-visible:outline-offset-2"
                aria-label="上传照片"
              >
                <Upload size={18} aria-hidden="true" />
                上传照片
                <ArrowRight
                  size={18}
                  className="transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </a>
              <a
                href="/account"
                className="inline-flex items-center gap-2 rounded-xl border-2 border-white/20 px-8 py-4 text-base font-semibold text-white backdrop-blur-sm transition-all hover:border-white/40 hover:bg-white/10 focus-visible:outline-offset-2"
                aria-label="浏览我的作品"
              >
                <Image size={18} aria-hidden="true" />
                我的作品
              </a>
            </>
          ) : (
            <>
              <a
                href="#gallery"
                className="group inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-zinc-950 shadow-xl transition-all hover:scale-105 hover:shadow-2xl focus-visible:outline-offset-2"
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
                href="/upload"
                className="inline-flex items-center gap-2 rounded-xl border-2 border-white/20 px-8 py-4 text-base font-semibold text-white backdrop-blur-sm transition-all hover:border-white/40 hover:bg-white/10 focus-visible:outline-offset-2"
                aria-label="上传照片"
              >
                <Upload size={18} aria-hidden="true" />
                上传照片
              </a>
            </>
          )}
        </motion.div>
      </div>
    </section>
  );
}
