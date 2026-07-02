import { motion } from "framer-motion";
import {
  Layers,
  FileImage,
  Maximize,
  Tags,
  ShieldCheck,
  BarChart3,
} from "lucide-react";

const FEATURES = [
  {
    icon: Layers,
    title: "智能游标分页",
    desc: "大数据量下丝滑无限滚动,避免 offset 扫描性能瓶颈",
  },
  {
    icon: FileImage,
    title: "多格式支持",
    desc: "JPG / PNG / WebP,自动提取主色与宽高比",
  },
  {
    icon: Maximize,
    title: "高清原图与按需缩略",
    desc: "原图保留,compressPictureType 按场景生成缩略图",
  },
  {
    icon: Tags,
    title: "标签分类检索",
    desc: "分类精确匹配,标签模糊匹配,searchText 跨字段搜索",
  },
  {
    icon: ShieldCheck,
    title: "审核机制",
    desc: "用户上传进入待审核,管理员把关,社区质量保障",
  },
  {
    icon: BarChart3,
    title: "浏览统计",
    desc: "viewCount 自动累加,likeCount 数据实时返回",
  },
];

export default function Features() {
  return (
    <section
      id="features"
      className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8"
    >
      <div className="mb-12 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          为图库而生的基础能力
        </h2>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          从上传到浏览,每一层都为图片体验优化
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => {
          const Icon = f.icon;
          return (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.06 }}
              className="group rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 transition-transform group-hover:scale-110 dark:bg-indigo-950 dark:text-indigo-400">
                <Icon size={20} />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {f.title}
              </h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {f.desc}
              </p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
