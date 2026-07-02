const FOOTER_LINKS = [
  { label: "关于", href: "/about" },
  { label: "隐私", href: "/privacy" },
  { label: "条款", href: "/terms" },
  { label: "GitHub", href: "https://github.com" },
];

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <a href="/" className="flex items-center" aria-label="WenJelly 首页">
            <img
              src="/logo.svg"
              alt="WenJelly"
              className="h-8 w-auto dark:invert"
            />
          </a>
          <nav className="flex flex-wrap items-center gap-6">
            {FOOTER_LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="text-sm text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                {l.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="mt-8 border-t border-slate-100 pt-6 text-center text-xs text-slate-400 dark:border-slate-900">
          © {new Date().getFullYear()} WenJelly. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
