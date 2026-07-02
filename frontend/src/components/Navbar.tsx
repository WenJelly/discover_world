import { type MouseEvent, useEffect, useState } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { Menu, X, ArrowRight, Sparkles, ChevronDown, Monitor, Search } from "lucide-react";

import { AuthDialog } from "@/components/auth/AuthDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";

const navItems = [
    {
        name: "产品功能",
        href: "#features",
        children: [
            { name: "智能自动化 Pipeline", desc: "一键配置高并发数据流", icon: Sparkles },
            { name: "实时监控看板", desc: "毫秒级吞吐量与性能可视化", icon: Monitor },
        ]
    },
    { name: "公开", href: "/public" },
    { name: "旅游攻略", href: "/#architecture" },
    { name: "心得分享", href: "/#pricing" },
];

function getAvatarFallback(userName?: string, userEmail?: string) {
    const source = (userName || userEmail || "U").trim();
    return source.slice(0, 2).toUpperCase();
}

export default function FadingSiblingsNavbar() {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const [authOpen, setAuthOpen] = useState(false);
    const { user, isAuthenticated, logout } = useAuth();
    const displayName = user?.userName?.trim() || user?.userEmail || "用户";
    const avatarFallback = getAvatarFallback(user?.userName, user?.userEmail);

    const handleInternalNavigation = (
        event: MouseEvent<HTMLAnchorElement>,
        href: string,
        closeMenu = false
    ) => {
        if (closeMenu) {
            setIsOpen(false);
        }

        if (
            !href.startsWith("/") ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey ||
            event.button !== 0
        ) {
            return;
        }

        event.preventDefault();
        const nextUrl = new URL(href, window.location.origin);
        const nextPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
        const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;

        if (nextPath !== currentPath) {
            window.history.pushState({}, "", nextPath);
        }
        window.dispatchEvent(new Event("popstate"));

        if (nextUrl.hash) {
            window.requestAnimationFrame(() => {
                document.querySelector(nextUrl.hash)?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                });
            });
        } else {
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 10);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => { document.body.style.overflow = "unset"; };
    }, [isOpen]);

    return (
        <LayoutGroup>
            <header
                className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
                    isScrolled
                        ? "border-b border-slate-200/60 bg-white/75 backdrop-blur-xl shadow-sm dark:border-slate-800/60 dark:bg-slate-950/75"
                        : "border-b border-transparent bg-transparent"
                }`}
            >
                <div className="w-full px-3 sm:px-5 lg:px-6">
                    <div className="flex h-16 items-center gap-4">
                        <div className="navbar-left-cluster flex min-w-0 flex-1 items-center gap-5">
                            <a
                                href="/"
                                aria-label="WenJelly 首页"
                                className="ml-1 flex shrink-0 items-center sm:ml-0"
                                onClick={(event) => handleInternalNavigation(event, "/")}
                            >
                                <img
                                    src="/logo.svg"
                                    alt="WenJelly"
                                    className="h-8 w-auto max-w-[112px] object-contain transition-transform duration-300 hover:scale-[1.03] dark:invert sm:h-9 sm:max-w-[126px]"
                                />
                            </a>

                            <nav
                                className="navbar-route-list hidden items-center gap-1 relative lg:flex"
                                onMouseLeave={() => {
                                    setHoveredIndex(null);
                                    setActiveDropdown(null);
                                }}
                            >
                                {navItems.map((item, index) => {
                                    // 核心逻辑：是否有任何一个路由正被悬浮
                                    const isAnyItemHovered = hoveredIndex !== null;
                                    // 当前路由是否正是被悬浮的那个
                                    const isCurrentItemHovered = hoveredIndex === index;

                                    return (
                                        <div
                                            key={item.name}
                                            className="relative py-2"
                                            onMouseEnter={() => {
                                                setHoveredIndex(index);
                                                if (item.children) setActiveDropdown(index);
                                                else setActiveDropdown(null);
                                            }}
                                        >
                                            <a
                                                href={item.href}
                                                onClick={(event) => handleInternalNavigation(event, item.href)}
                                                className={`relative inline-flex items-center gap-1 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all duration-300 z-10 ${
                                                    isAnyItemHovered
                                                        ? isCurrentItemHovered
                                                            ? "text-slate-950 scale-105 dark:text-white" // 被选中的路由：高亮加深
                                                            : "text-slate-400/70 dark:text-slate-600 blur-[0.2px]" // 其他路由：淡灰色 + 极微弱模糊
                                                        : "text-slate-600 dark:text-slate-400" // 初始状态
                                                }`}
                                            >
                                                {item.name}
                                                {item.children && (
                                                    <ChevronDown
                                                        size={14}
                                                        className={`transition-transform duration-300 ${
                                                            activeDropdown === index ? "rotate-180 text-indigo-500" : "text-slate-400"
                                                        }`}
                                                    />
                                                )}
                                            </a>

                                            {/* 二级下拉菜单 */}
                                            <AnimatePresence>
                                                {item.children && activeDropdown === index && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                                        exit={{ opacity: 0, y: 6, scale: 0.96 }}
                                                        transition={{ duration: 0.15, ease: "easeOut" }}
                                                        className="absolute left-0 top-full mt-1 w-80 rounded-xl border border-slate-200/80 bg-white p-2 shadow-xl dark:border-slate-800/80 dark:bg-slate-950"
                                                    >
                                                        <div className="grid gap-1">
                                                            {item.children.map((child) => {
                                                                const Icon = child.icon;
                                                                return (
                                                                    <a
                                                                        key={child.name}
                                                                        href="#"
                                                                        className="flex items-start gap-3 rounded-lg p-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900 group/item"
                                                                    >
                                                                        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-400">
                                                                            <Icon size={16} />
                                                                        </div>
                                                                        <div>
                                                                            <div className="text-sm font-medium text-slate-900 dark:text-white transition-colors group-hover/item:text-indigo-600 dark:group-hover/item:text-indigo-400">
                                                                                {child.name}
                                                                            </div>
                                                                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                                                                                {child.desc}
                                                                            </p>
                                                                        </div>
                                                                    </a>
                                                                );
                                                            })}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    );
                                })}
                            </nav>
                        </div>

                        <div className="navbar-actions ml-auto hidden shrink-0 items-center gap-3 pr-1 md:flex">
                            <form className="navbar-search relative w-56 lg:w-64 xl:w-72" role="search" action="/public">
                                <label htmlFor="navbar-search-desktop" className="sr-only">
                                    搜索公开图片、旅游攻略和心得分享
                                </label>
                                <Search
                                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                                    aria-hidden="true"
                                />
                                <Input
                                    id="navbar-search-desktop"
                                    name="q"
                                    type="search"
                                    aria-label="搜索公开图片、旅游攻略和心得分享"
                                    placeholder="搜索图片、攻略、心得"
                                    className="h-9 rounded-full border-slate-200/80 bg-white/85 pl-9 pr-3 shadow-sm backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/70"
                                />
                            </form>

                            <div className="navbar-account-actions flex items-center gap-4">
                                {isAuthenticated && user ? (
                                    <div className="flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/70 p-1 pr-2 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/60">
                                        <a
                                            href="/account"
                                            aria-label="进入个人主页"
                                            className="flex min-w-0 items-center gap-2 rounded-full transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-indigo-500/20"
                                            onClick={(event) => handleInternalNavigation(event, "/account")}
                                        >
                                            <Avatar className="size-8">
                                                {user.userAvatar ? (
                                                    <AvatarImage src={user.userAvatar} alt={displayName} />
                                                ) : null}
                                                <AvatarFallback>{avatarFallback}</AvatarFallback>
                                            </Avatar>
                                            <span className="max-w-28 truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                                                {displayName}
                                            </span>
                                        </a>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 rounded-full px-2 text-xs text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
                                            onClick={logout}
                                        >
                                            退出
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="text-sm font-medium text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
                                            onClick={() => setAuthOpen(true)}
                                        >
                                            登录
                                        </Button>
                                        <Button
                                            type="button"
                                            className="group inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white shadow-sm shadow-indigo-500/10 transition-all hover:-translate-y-0.5 hover:bg-indigo-500 hover:shadow-indigo-500/20 active:scale-[0.98]"
                                            onClick={() => setAuthOpen(true)}
                                        >
                                            开始使用
                                            <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="ml-auto flex md:hidden">
                            <button
                                onClick={() => setIsOpen(!isOpen)}
                                aria-label="Toggle Menu"
                                className="inline-flex items-center justify-center rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900"
                            >
                                {isOpen ? <X size={20} /> : <Menu size={20} />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* 移动端抽屉 */}
                <AnimatePresence>
                    {isOpen && (
                        <>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsOpen(false)}
                                className="fixed inset-0 top-16 -z-10 bg-slate-950/20 backdrop-blur-sm dark:bg-slate-950/40 md:hidden"
                            />

                            <motion.div
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.25, ease: "easeInOut" }}
                                className="absolute inset-x-0 top-16 -z-10 max-h-[calc(100vh-4rem)] overflow-y-auto border-b border-slate-200 bg-white px-6 pt-4 pb-8 shadow-xl dark:border-slate-800 dark:bg-slate-950 md:hidden"
                            >
                                <div className="flex flex-col space-y-1.5">
                                    <form className="navbar-search relative mb-3" role="search" action="/public">
                                        <label htmlFor="navbar-search-mobile" className="sr-only">
                                            搜索公开图片、旅游攻略和心得分享
                                        </label>
                                        <Search
                                            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                                            aria-hidden="true"
                                        />
                                        <Input
                                            id="navbar-search-mobile"
                                            name="q"
                                            type="search"
                                            aria-label="搜索公开图片、旅游攻略和心得分享"
                                            placeholder="搜索图片、攻略、心得"
                                            className="h-10 rounded-xl border-slate-200 bg-slate-50 pl-9 dark:border-slate-800 dark:bg-slate-900"
                                        />
                                    </form>

                                    {navItems.map((item) => (
                                        <div key={item.name} className="flex flex-col">
                                            <a
                                                href={item.href}
                                                onClick={(event) =>
                                                    !item.children && handleInternalNavigation(event, item.href, true)
                                                }
                                                className="flex items-center justify-between rounded-lg py-2.5 px-2 text-base font-medium text-slate-800 dark:text-slate-200"
                                            >
                                                {item.name}
                                            </a>
                                            {item.children && (
                                                <div className="ml-4 border-l border-slate-100 pl-4 dark:border-slate-800 space-y-1">
                                                    {item.children.map((child) => (
                                                        <a
                                                            key={child.name}
                                                            href="#"
                                                            onClick={() => setIsOpen(false)}
                                                            className="block rounded-lg py-2 px-2 text-sm text-slate-500 dark:text-slate-400"
                                                        >
                                                            {child.name}
                                                        </a>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    <div className="pt-6 mt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-3">
                                        {isAuthenticated && user ? (
                                            <>
                                                <a
                                                    href="/account"
                                                    aria-label="进入个人主页"
                                                    className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-indigo-500/20 dark:bg-slate-900 dark:hover:bg-slate-800"
                                                    onClick={(event) =>
                                                        handleInternalNavigation(event, "/account", true)
                                                    }
                                                >
                                                    <Avatar className="size-9">
                                                        {user.userAvatar ? (
                                                            <AvatarImage src={user.userAvatar} alt={displayName} />
                                                        ) : null}
                                                        <AvatarFallback>{avatarFallback}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="min-w-0">
                                                        <div className="truncate text-sm font-medium text-slate-900 dark:text-white">
                                                            {displayName}
                                                        </div>
                                                        <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                                                            {user.userEmail}
                                                        </div>
                                                    </div>
                                                </a>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="h-10 w-full rounded-xl"
                                                    onClick={() => {
                                                        logout();
                                                        setIsOpen(false);
                                                    }}
                                                >
                                                    退出登录
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    className="h-10 w-full rounded-xl text-slate-600 dark:text-slate-400"
                                                    onClick={() => {
                                                        setIsOpen(false);
                                                        setAuthOpen(true);
                                                    }}
                                                >
                                                    登录
                                                </Button>
                                                <Button
                                                    type="button"
                                                    className="h-10 w-full rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-500/10 hover:bg-indigo-500"
                                                    onClick={() => {
                                                        setIsOpen(false);
                                                        setAuthOpen(true);
                                                    }}
                                                >
                                                    开始使用
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </header>
            <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
        </LayoutGroup>
    );
}
