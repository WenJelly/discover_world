import { useEffect, useRef, useState } from "react";
import { motion, useInView, animate, useReducedMotion } from "framer-motion";
import { fetchOverviewStats } from "@/lib/api";
import type { OverviewStatsResponse } from "@/lib/types";

function CountUp({
  value,
  decimals = 0,
  suffix = "",
  start,
  shouldReduceMotion,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  start: boolean;
  shouldReduceMotion: boolean;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!start) return;

    // If reduced motion, show final value immediately
    if (shouldReduceMotion) {
      setDisplay(value);
      return;
    }

    const controls = animate(0, value, {
      duration: 1.5,
      ease: "easeOut",
      onUpdate: (v: number) => setDisplay(v),
    });
    return () => controls.stop();
  }, [start, value, shouldReduceMotion]);

  return (
    <span>
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
}

function buildStats(stats: OverviewStatsResponse | null) {
  return [
    {
      label: "公开作品",
      value: stats?.publicMediaAssetCount ?? 0,
      suffix: "",
      decimals: 0,
    },
    {
      label: "创作者",
      value: stats?.creatorCount ?? 0,
      suffix: "",
      decimals: 0,
    },
    {
      label: "公开动态",
      value: stats?.publicPostCount ?? 0,
      suffix: "",
      decimals: 0,
    },
    {
      label: "公开相册",
      value: stats?.publicAlbumCount ?? 0,
      suffix: "",
      decimals: 0,
    },
  ];
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="text-center">
          <div className="mx-auto h-12 w-24 animate-pulse rounded-lg bg-zinc-800" />
          <div className="mx-auto mt-2 h-4 w-16 animate-pulse rounded bg-zinc-800" />
        </div>
      ))}
    </div>
  );
}

export default function Stats() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const shouldReduceMotion = useReducedMotion();
  const [stats, setStats] = useState<OverviewStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetchOverviewStats()
      .then((resp) => {
        if (!cancelled) {
          setStats(resp);
          setError(false);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setStats(null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const statItems = buildStats(stats);

  const retry = () => {
    setLoading(true);
    setError(false);
    fetchOverviewStats()
      .then((resp) => {
        setStats(resp);
        setError(false);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setStats(null);
        setLoading(false);
      });
  };

  return (
    <section ref={ref} className="bg-zinc-950 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {loading ? (
          <StatsSkeleton />
        ) : error ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-lg text-zinc-400">统计数据暂时不可用</p>
            <button
              onClick={retry}
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-700 focus-visible:outline-offset-2"
              aria-label="重试加载统计数据"
            >
              重试
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
            {statItems.map((s, i) => (
              <motion.div
                key={s.label}
                initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
                whileInView={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{
                  duration: shouldReduceMotion ? 0 : 0.4,
                  delay: shouldReduceMotion ? 0 : i * 0.08,
                }}
                className="text-center"
              >
                <div className="bg-gradient-to-r from-zinc-100 to-zinc-300 bg-clip-text text-4xl font-bold text-transparent sm:text-5xl">
                  <CountUp
                    value={s.value}
                    decimals={s.decimals}
                    suffix={s.suffix}
                    start={inView}
                    shouldReduceMotion={shouldReduceMotion || false}
                  />
                </div>
                <div className="mt-2 text-sm text-zinc-400">{s.label}</div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
