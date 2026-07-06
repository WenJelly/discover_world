import { useEffect, useRef, useState } from "react";
import {
  Images,
  Users,
  Activity,
  GalleryVerticalEnd,
  type LucideIcon,
} from "lucide-react";
import {
  motion,
  useReducedMotion,
  useInView,
  animate,
  type Variants,
} from "framer-motion";
import { fetchOverviewStats } from "@/lib/api";
import { formatCount } from "@/lib/format";
import type { OverviewStatsResponse } from "@/lib/types";

type StatItem = {
  key: string;
  label: string;
  value: number;
  Icon: LucideIcon;
};

// Counts up to `value` when scrolled into view; falls back to the final
// number immediately when reduced-motion is requested.
function CountUp({ value, active }: { value: number; active: boolean }) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(reduceMotion ? value : 0);

  useEffect(() => {
    if (!active) return;
    if (reduceMotion || value === 0) {
      setDisplay(value);
      return;
    }
    const controls = animate(0, value, {
      duration: 1.1,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => setDisplay(Math.round(latest)),
    });
    return () => controls.stop();
  }, [active, value, reduceMotion]);

  return <>{formatCount(display)}</>;
}

export default function Stats() {
  const [stats, setStats] = useState<OverviewStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const reduceMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: "-80px" });

  useEffect(() => {
    let cancelled = false;
    fetchOverviewStats()
      .then((resp) => {
        if (!cancelled) {
          setStats(resp);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const items: StatItem[] = [
    {
      key: "media",
      label: "公开作品",
      value: stats?.publicMediaAssetCount ?? 0,
      Icon: Images,
    },
    {
      key: "creator",
      label: "创作者",
      value: stats?.creatorCount ?? 0,
      Icon: Users,
    },
    {
      key: "post",
      label: "公开动态",
      value: stats?.publicPostCount ?? 0,
      Icon: Activity,
    },
    {
      key: "album",
      label: "公开相册",
      value: stats?.publicAlbumCount ?? 0,
      Icon: GalleryVerticalEnd,
    },
  ];

  const container: Variants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reduceMotion ? 0 : 0.1,
        delayChildren: reduceMotion ? 0 : 0.05,
      },
    },
  };
  const item: Variants = {
    hidden: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: reduceMotion ? 0.2 : 0.5, ease: [0.22, 1, 0.36, 1] },
    },
  };

  return (
    <section ref={sectionRef} className="border-y border-border bg-muted">
      <div className="mx-auto max-w-6xl px-6 py-14 sm:py-16">
        {loading ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {items.map((s) => (
              <div
                key={s.key}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-6"
              >
                <div className="h-10 w-10 animate-pulse rounded-xl bg-muted" />
                <div className="h-8 w-20 animate-pulse rounded bg-muted" />
                <div className="h-4 w-16 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : (
          <motion.dl
            className="grid grid-cols-2 gap-4 lg:grid-cols-4"
            initial="hidden"
            animate={inView ? "show" : "hidden"}
            variants={container}
          >
            {items.map(({ key, label, value, Icon }) => (
              <motion.div
                key={key}
                className="group flex flex-col gap-3 rounded-2xl border border-border bg-background p-6 transition-colors hover:border-foreground/20"
                variants={item}
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted text-foreground transition-transform duration-300 group-hover:-translate-y-0.5">
                  <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <dd className="text-3xl font-bold tabular-nums tracking-tight text-foreground sm:text-4xl">
                  <CountUp value={value} active={inView} />
                </dd>
                <dt className="text-sm text-muted-foreground">{label}</dt>
              </motion.div>
            ))}
          </motion.dl>
        )}
      </div>
    </section>
  );
}
