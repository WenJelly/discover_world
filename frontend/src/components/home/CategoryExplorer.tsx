import { motion } from "framer-motion";

const CATEGORIES = [
  { name: "风景", color: "#10b981" },
  { name: "人像", color: "#f59e0b" },
  { name: "街拍", color: "#3b82f6" },
  { name: "建筑", color: "#8b5cf6" },
  { name: "动物", color: "#ec4899" },
  { name: "美食", color: "#ef4444" },
  { name: "抽象", color: "#6366f1" },
];

const TAGS = [
  "日落", "海边", "黑白", "胶片", "城市", "自然", "光影",
  "极简", "色彩", "人像", "旅行", "四季", "夜景", "长曝光",
  "微距", "广角", "纪实", "情绪", "几何", "纹理",
];

export default function CategoryExplorer() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="mb-12 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          按分类与标签探索
        </h2>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          找到你感兴趣的题材
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <h3 className="mb-4 text-sm font-medium text-slate-500 dark:text-slate-400">
            分类
          </h3>
          <div className="flex flex-wrap gap-3">
            {CATEGORIES.map((c, i) => (
              <motion.a
                key={c.name}
                href={`#gallery?category=${encodeURIComponent(c.name)}`}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
                whileHover={{ scale: 1.05 }}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: c.color }}
                />
                {c.name}
              </motion.a>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-medium text-slate-500 dark:text-slate-400">
            热门标签
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {TAGS.map((t, i) => {
              const size = 0.85 + ((i * 13) % 7) * 0.08;
              return (
                <motion.a
                  key={t}
                  href={`#gallery?tags=${encodeURIComponent(t)}`}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: i * 0.02 }}
                  whileHover={{ scale: 1.1 }}
                  className="text-slate-600 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
                  style={{ fontSize: `${size}rem` }}
                >
                  #{t}
                </motion.a>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
