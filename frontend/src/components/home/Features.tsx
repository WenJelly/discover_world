const STEPS = [
  {
    no: "01",
    title: "上传你的作品",
    desc: "把照片加入图库，自动识别主色、宽高比与格式。",
  },
  {
    no: "02",
    title: "社区审核",
    desc: "管理员把关内容质量与安全，通过后即可公开。",
  },
  {
    no: "03",
    title: "向世界公开",
    desc: "所有人可浏览与下载你的原图，作品被看见、被使用。",
  },
];

export default function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
      <div className="mb-12 max-w-2xl">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          从上传到被看见
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          三步，你的照片就从本地走向社区。
        </p>
      </div>
      <ol className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3">
        {STEPS.map((s) => (
          <li key={s.no} className="bg-background p-6 sm:p-8">
            <div className="text-xs font-semibold tabular-nums text-muted-foreground">
              {s.no}
            </div>
            <h3 className="mt-3 text-base font-semibold text-foreground">
              {s.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {s.desc}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
