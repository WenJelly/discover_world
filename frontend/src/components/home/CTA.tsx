import { motion } from "framer-motion";
import { ArrowRight, Upload } from "lucide-react";

export default function CTA() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 py-24">
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 80% 70%, white 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-3xl font-bold tracking-tight text-white sm:text-5xl"
        >
          把你的作品放进世界
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mx-auto mt-4 max-w-xl text-base text-indigo-100 sm:text-lg"
        >
          上传即进入社区审核,通过后向所有人开放浏览与下载
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10"
        >
          <a
            href="/upload"
            className="group inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-sm font-semibold text-indigo-700 shadow-xl transition-all hover:scale-105 hover:shadow-2xl"
          >
            <Upload size={16} />
            立即上传
            <ArrowRight
              size={16}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </a>
        </motion.div>
      </div>
    </section>
  );
}
