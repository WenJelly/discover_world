import { useEffect, useRef, useState } from "react";
import { motion, useInView, animate } from "framer-motion";

const STATS = [
  { label: "作品总数", value: 12580, suffix: "", decimals: 0 },
  { label: "创作者数量", value: 328, suffix: "", decimals: 0 },
  { label: "总浏览量", value: 1.2, suffix: "M", decimals: 1 },
  { label: "审核通过率", value: 98, suffix: "%", decimals: 0 },
];

function CountUp({
  value,
  decimals = 0,
  suffix = "",
  start,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  start: boolean;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!start) return;
    const controls = animate(0, value, {
      duration: 1.5,
      ease: "easeOut",
      onUpdate: (v: number) => setDisplay(v),
    });
    return () => controls.stop();
  }, [start, value]);

  return (
    <span>
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
}

export default function Stats() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });

  return (
    <section ref={ref} className="bg-slate-950 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="text-center"
            >
              <div className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-4xl font-bold text-transparent sm:text-5xl">
                <CountUp
                  value={s.value}
                  decimals={s.decimals}
                  suffix={s.suffix}
                  start={inView}
                />
              </div>
              <div className="mt-2 text-sm text-slate-400">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
