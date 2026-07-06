import { CloudUpload, ShieldCheck, Globe, type LucideIcon } from "lucide-react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

type Step = {
  no: string;
  title: string;
  desc: string;
  Icon: LucideIcon;
};

const STEPS: Step[] = [
  {
    no: "01",
    title: "上传你的作品",
    desc: "把照片加入图库,自动识别主色、宽高比与格式。",
    Icon: CloudUpload,
  },
  {
    no: "02",
    title: "社区审核",
    desc: "管理员把关内容质量与安全,通过后即可公开。",
    Icon: ShieldCheck,
  },
  {
    no: "03",
    title: "向世界公开",
    desc: "所有人可浏览与下载你的原图,作品被看见、被使用。",
    Icon: Globe,
  },
];

export default function Features() {
  const reduceMotion = useReducedMotion();

  const container: Variants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reduceMotion ? 0 : 0.12,
        delayChildren: reduceMotion ? 0 : 0.05,
      },
    },
  };
  const item: Variants = {
    hidden: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 28 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: reduceMotion ? 0.2 : 0.55, ease: [0.22, 1, 0.36, 1] },
    },
  };

  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
      <motion.div
        className="mb-14 max-w-2xl"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        variants={container}
      >
        <motion.span
          className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
          variants={item}
        >
          创作流程
        </motion.span>
        <motion.h2
          className="mt-4 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
          variants={item}
        >
          从上传到被看见
        </motion.h2>
        <motion.p className="mt-3 text-sm text-muted-foreground" variants={item}>
          三步,你的照片就从本地走向社区。
        </motion.p>
      </motion.div>

      <motion.ol
        className="relative grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-5"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        variants={container}
      >
        {/* Connecting line threading the three steps on desktop */}
        <div
          className="pointer-events-none absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent sm:block"
          aria-hidden="true"
        />
        {STEPS.map(({ no, title, desc, Icon }, index) => (
          <motion.li
            key={no}
            className="group relative rounded-2xl border border-border bg-background p-6 transition-colors hover:border-foreground/20 sm:p-7"
            variants={item}
          >
            <div className="flex items-center justify-between">
              <span
                className="relative z-[1] inline-flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-muted text-foreground transition-transform duration-300 group-hover:-translate-y-0.5"
              >
                <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <span
                className="text-3xl font-bold tabular-nums text-foreground/10 transition-colors group-hover:text-foreground/20"
                aria-hidden="true"
              >
                {no}
              </span>
            </div>
            <h3 className="mt-5 text-base font-semibold text-foreground">
              <span className="text-muted-foreground">
                第 {index + 1} 步 ·{" "}
              </span>
              {title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {desc}
            </p>
          </motion.li>
        ))}
      </motion.ol>
    </section>
  );
}
