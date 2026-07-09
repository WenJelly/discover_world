import {
    type ChangeEvent,
    type FormEvent,
    type MouseEvent,
    useEffect,
    useRef,
    useState,
    useCallback,
} from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import {
    ArrowRight,
    Camera,
    ChevronDown,
    Loader2,
    LogOut,
    Menu,
    Search,
    Settings,
    ShieldCheck,
    UserRound,
    X,
} from "lucide-react";

import { AuthDialog } from "@/components/auth/AuthDialog";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import {
    ApiError,
    uploadAccountAvatar,
    updateUserProfile,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const navItems = [
    { name: "首页", href: "/" },
    { name: "发现", href: "/discover" },
    { name: "公开动态", href: "/community" },
];

type NavbarProps = {
    fixed?: boolean;
};

function getAvatarFallback(userName?: string, userEmail?: string) {
    const source = (userName || userEmail || "U").trim();
    return source.slice(0, 2).toUpperCase();
}

function getUploadErrorMessage(error: unknown) {
    if (error instanceof ApiError) {
        return error.message;
    }
    if (error instanceof Error) {
        return error.message;
    }
    return "图片上传失败,请稍后重试";
}

export default function FadingSiblingsNavbar({ fixed = true }: NavbarProps) {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [authOpen, setAuthOpen] = useState(false);
    const [accountMenuOpen, setAccountMenuOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchFocused, setSearchFocused] = useState(false);
    const [savingSettings, setSavingSettings] = useState(false);
    const [settingsForm, setSettingsForm] = useState({
        username: "",
        nickname: "",
        bio: "",
    });
    const accountMenuRef = useRef<HTMLDivElement>(null);
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const desktopSearchInputRef = useRef<HTMLInputElement>(null);
    const mobileSearchInputRef = useRef<HTMLInputElement>(null);
    const { user, isAuthenticated, logout, refreshUser, applyAccountDetail } = useAuth();
    const { toast } = useToast();
    const displayName = user?.userName?.trim() || user?.userEmail || "用户";
    const avatarFallback = getAvatarFallback(user?.userName, user?.userEmail);
    // Admin console entry is only rendered for the admin role; the /admin
    // page itself re-checks the role before rendering anything.
    const isAdmin =
        isAuthenticated &&
        (user?.role || user?.userRole || "").trim().toLowerCase() === "admin";
    const navbarPositionClass = fixed ? "fixed top-0 left-0 right-0" : "relative";

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

    const handleAccountNavigation = (event: MouseEvent<HTMLAnchorElement>, closeMenu = false) => {
        setAccountMenuOpen(false);
        handleInternalNavigation(event, "/account", closeMenu);
    };

    const handleLogout = () => {
        logout();
        setAccountMenuOpen(false);
        setIsOpen(false);
    };

    const getSearchInput = useCallback((target: HTMLFormElement | HTMLButtonElement) => {
        const form = target instanceof HTMLFormElement ? target : target.form;
        const input = form?.elements.namedItem("q");
        return input instanceof HTMLInputElement ? input : null;
    }, []);

    const focusSearchInput = useCallback((target: HTMLFormElement | HTMLButtonElement) => {
        getSearchInput(target)?.focus();
    }, [getSearchInput]);

    const blurSearchInput = useCallback((target: HTMLFormElement | HTMLButtonElement) => {
        getSearchInput(target)?.blur();
    }, [getSearchInput]);

    const handleSearchSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const query = String(formData.get("q") ?? "").trim();

        setSearchQuery(query);

        if (!query) {
            focusSearchInput(event.currentTarget);
            return;
        }

        const searchUrl = `/search?q=${encodeURIComponent(query)}`;
        window.history.pushState({}, "", searchUrl);
        window.dispatchEvent(new Event("popstate"));
        setIsOpen(false);
        blurSearchInput(event.currentTarget);
    }, [blurSearchInput, focusSearchInput]);

    const handleSearchChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(event.target.value);
    }, []);

    const clearSearch = useCallback((event: MouseEvent<HTMLButtonElement>) => {
        setSearchQuery("");
        focusSearchInput(event.currentTarget);
    }, [focusSearchInput]);

    const openSettings = () => {
        setAccountMenuOpen(false);
        setIsOpen(false);
        setSettingsForm({
            username: user?.username || "",
            nickname: user?.nickname || user?.userName || "",
            bio: user?.userProfile || "",
        });
        setSettingsOpen(true);
    };

    const handleAccountAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";

        if (!file) {
            return;
        }

        if (!file.type.startsWith("image/")) {
            toast({
                title: "请选择图片文件",
                description: "头像必须是图片格式。",
                variant: "destructive",
            });
            return;
        }

        setUploading(true);
        try {
            const detail = await uploadAccountAvatar(file);
            applyAccountDetail(detail);

            toast({
                title: "头像更新成功",
                description: "头像已更新。",
                variant: "success",
            });
        } catch (error) {
            toast({
                title: "头像上传失败",
                description: getUploadErrorMessage(error),
                variant: "destructive",
            });
        } finally {
            setUploading(false);
        }
    };

    const handleSaveSettings = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!user?.id) return;

        setSavingSettings(true);
        try {
            await updateUserProfile({
                id: user.id,
                username: settingsForm.username,
                nickname: settingsForm.nickname,
                bio: settingsForm.bio,
            });
            await refreshUser();
            setSettingsOpen(false);
            toast({
                title: "资料已保存",
                description: "个人信息已更新。",
                variant: "success",
            });
        } catch (error) {
            toast({
                title: "保存失败",
                description: getUploadErrorMessage(error),
                variant: "destructive",
            });
        } finally {
            setSavingSettings(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => { document.body.style.overflow = "unset"; };
    }, [isOpen]);

    useEffect(() => {
        if (!accountMenuOpen) {
            return;
        }

        const handlePointerDown = (event: PointerEvent) => {
            if (!accountMenuRef.current?.contains(event.target as Node)) {
                setAccountMenuOpen(false);
            }
        };

        document.addEventListener("pointerdown", handlePointerDown);
        return () => {
            document.removeEventListener("pointerdown", handlePointerDown);
        };
    }, [accountMenuOpen]);

    useEffect(() => {
        if (!isAuthenticated) {
            setAccountMenuOpen(false);
        }
    }, [isAuthenticated]);

    return (
        <LayoutGroup>
            <header
                className={`${navbarPositionClass} z-50 border-b border-slate-200/60 bg-white`}
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
                                    className="h-8 w-auto max-w-[112px] object-contain transition-transform duration-300 hover:scale-[1.03] sm:h-9 sm:max-w-[126px]"
                                />
                            </a>

                            <nav
                                className="navbar-route-list hidden items-center gap-1 relative lg:flex"
                                onMouseLeave={() => {
                                    setHoveredIndex(null);
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
                                            </a>
                                        </div>
                                    );
                                })}
                            </nav>
                        </div>

                        <div className="navbar-actions ml-auto hidden shrink-0 items-center gap-3 pr-1 md:flex">
                            <form
                                className="navbar-search relative group"
                                role="search"
                                onSubmit={handleSearchSubmit}
                            >
                                <label htmlFor="navbar-search-desktop" className="sr-only">
                                    搜索全站内容
                                </label>
                                <div className={`relative transition-all duration-300 ${
                                    searchFocused ? 'w-80 lg:w-96' : 'w-64 lg:w-72 xl:w-80'
                                }`}>
                                    <div className="pointer-events-none absolute left-3.5 top-1/2 flex -translate-y-1/2 items-center gap-2">
                                        <Search
                                            className="size-[16px] text-slate-400 transition-colors duration-200 group-hover:text-slate-500 dark:text-slate-500 dark:group-hover:text-slate-400"
                                            aria-hidden="true"
                                            strokeWidth={2.5}
                                        />
                                        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
                                    </div>
                                    <Input
                                        ref={desktopSearchInputRef}
                                        id="navbar-search-desktop"
                                        name="q"
                                        type="search"
                                        value={searchQuery}
                                        onChange={handleSearchChange}
                                        onFocus={() => setSearchFocused(true)}
                                        onBlur={() => setSearchFocused(false)}
                                        aria-label="搜索全站内容"
                                        placeholder="搜索图片、动态、用户"
                                        autoComplete="off"
                                        className={`h-[42px] rounded-lg border border-slate-200/80 bg-slate-100 pl-[52px] pr-4 text-[15px] font-normal text-slate-900 placeholder:text-slate-400 shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md focus:border-indigo-400 focus:bg-white focus:shadow-md focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-slate-600 dark:focus:border-indigo-500/60 dark:focus:ring-indigo-500/20 ${
                                            searchQuery ? 'pr-10' : ''
                                        }`}
                                    />
                                    {searchQuery && (
                                        <button
                                            type="button"
                                            onClick={clearSearch}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                                            aria-label="清空搜索"
                                        >
                                            <X className="size-4" strokeWidth={2.5} />
                                        </button>
                                    )}
                                </div>
                            </form>

                            <div className="navbar-account-actions flex items-center gap-4">
                                {isAuthenticated ? <NotificationBell /> : null}
                                {isAuthenticated && user ? (
                                    <div ref={accountMenuRef} className="relative">
                                        <button
                                            type="button"
                                            aria-haspopup="menu"
                                            aria-expanded={accountMenuOpen}
                                            aria-label={`打开 ${displayName} 的账户菜单`}
                                            className="group flex items-center gap-2.5 transition-opacity hover:opacity-80"
                                            onClick={() => setAccountMenuOpen((open) => !open)}
                                        >
                                            <div className="relative">
                                                <Avatar className="size-9 ring-2 ring-transparent transition-all duration-200 group-hover:ring-indigo-500/20">
                                                    {user.userAvatar ? (
                                                        <AvatarImage src={user.userAvatar} alt={displayName} />
                                                    ) : null}
                                                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-[14px] font-semibold text-white">
                                                        {avatarFallback}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white bg-green-500 dark:border-slate-950" />
                                            </div>
                                            <div className="hidden min-w-0 text-left lg:block">
                                                <div className="text-[13px] font-medium leading-tight text-slate-900 dark:text-slate-100">
                                                    {displayName}
                                                </div>
                                            </div>
                                            <ChevronDown
                                                className={`size-4 text-slate-400 transition-transform duration-200 dark:text-slate-500 ${
                                                    accountMenuOpen ? "rotate-180" : ""
                                                }`}
                                                aria-hidden="true"
                                                strokeWidth={2}
                                            />
                                        </button>

                                        <AnimatePresence>
                                            {accountMenuOpen && (
                                                <motion.div
                                                    role="menu"
                                                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                    exit={{ opacity: 0, y: 6, scale: 0.96 }}
                                                    transition={{ duration: 0.15, ease: "easeOut" }}
                                                    className="absolute right-0 top-full mt-2 w-64 overflow-hidden rounded-xl border border-slate-200/60 bg-white p-2 shadow-xl shadow-slate-900/10 dark:border-slate-800/50 dark:bg-slate-900 dark:shadow-black/20"
                                                >
                                                    <a
                                                        role="menuitem"
                                                        href="/account"
                                                        aria-label="进入个人主页"
                                                        className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[15px] font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/20 dark:text-slate-200 dark:hover:bg-slate-800/50 dark:hover:text-white"
                                                        onClick={(event) => handleAccountNavigation(event)}
                                                    >
                                                        <UserRound className="size-[17px] text-slate-400 dark:text-slate-500" strokeWidth={2} />
                                                        个人主页
                                                    </a>
                                                    <button
                                                        role="menuitem"
                                                        type="button"
                                                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[15px] font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800/50 dark:hover:text-white"
                                                        disabled={uploading}
                                                        onClick={openSettings}
                                                    >
                                                        <Settings className="size-[17px] text-slate-400 dark:text-slate-500" strokeWidth={2} />
                                                        个人设置
                                                    </button>
                                                    {isAdmin ? (
                                                        <a
                                                            role="menuitem"
                                                            href="/admin"
                                                            aria-label="进入后台管理"
                                                            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[15px] font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/20 dark:text-slate-200 dark:hover:bg-slate-800/50 dark:hover:text-white"
                                                            onClick={(event) => {
                                                                setAccountMenuOpen(false);
                                                                handleInternalNavigation(event, "/admin");
                                                            }}
                                                        >
                                                            <ShieldCheck className="size-[17px] text-slate-400 dark:text-slate-500" strokeWidth={2} />
                                                            后台管理
                                                        </a>
                                                    ) : null}
                                                    <div className="my-1.5 border-t border-slate-100 dark:border-slate-800/50" />
                                                    <button
                                                        role="menuitem"
                                                        type="button"
                                                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[15px] font-medium text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/20 dark:text-red-400 dark:hover:bg-red-500/10"
                                                        onClick={handleLogout}
                                                    >
                                                        <LogOut className="size-[17px]" strokeWidth={2} />
                                                        退出登录
                                                    </button>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                ) : (
                                    <>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-[42px] px-5 text-[15px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                                            onClick={() => setAuthOpen(true)}
                                        >
                                            登录
                                        </Button>
                                        <Button
                                            type="button"
                                            className="group inline-flex h-[42px] items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-5 text-[15px] font-medium text-white shadow-sm shadow-indigo-500/10 transition-all duration-200 hover:-translate-y-0.5 hover:bg-indigo-500 hover:shadow-md hover:shadow-indigo-500/20 active:scale-[0.98]"
                                            onClick={() => setAuthOpen(true)}
                                        >
                                            开始使用
                                            <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-0.5" />
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
                                    <form
                                        className="navbar-search relative mb-3 group"
                                        role="search"
                                        onSubmit={handleSearchSubmit}
                                    >
                                        <label htmlFor="navbar-search-mobile" className="sr-only">
                                            搜索全站内容
                                        </label>
                                        <div className="pointer-events-none absolute left-3.5 top-1/2 flex -translate-y-1/2 items-center gap-2">
                                            <Search
                                                className="size-[16px] text-slate-400 transition-colors duration-200 group-hover:text-slate-500 dark:text-slate-500 dark:group-hover:text-slate-400"
                                                aria-hidden="true"
                                                strokeWidth={2.5}
                                            />
                                            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
                                        </div>
                                        <Input
                                            ref={mobileSearchInputRef}
                                            id="navbar-search-mobile"
                                            name="q"
                                            type="search"
                                            value={searchQuery}
                                            onChange={handleSearchChange}
                                            aria-label="搜索全站内容"
                                            placeholder="搜索图片、动态、用户"
                                            autoComplete="off"
                                            className={`h-11 rounded-lg border border-slate-200 bg-slate-100 pl-[52px] text-[15px] font-normal placeholder:text-slate-400 transition-all focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:placeholder:text-slate-500 ${
                                                searchQuery ? 'pr-10' : 'pr-3'
                                            }`}
                                        />
                                        {searchQuery && (
                                            <button
                                                type="button"
                                                onClick={clearSearch}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                                                aria-label="清空搜索"
                                            >
                                                <X className="size-4" strokeWidth={2.5} />
                                            </button>
                                        )}
                                    </form>

                                    {navItems.map((item) => (
                                        <div key={item.name} className="flex flex-col">
                                            <a
                                                href={item.href}
                                                onClick={(event) =>
                                                    handleInternalNavigation(event, item.href, true)
                                                }
                                                className="flex items-center justify-between rounded-lg py-2.5 px-2 text-base font-medium text-slate-800 dark:text-slate-200"
                                            >
                                                {item.name}
                                            </a>
                                        </div>
                                    ))}

                                    <div className="pt-6 mt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-3">
                                        {isAuthenticated && user ? (
                                            <>
                                                <a
                                                    href="/account"
                                                    aria-label="进入个人主页"
                                                    className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/20 dark:bg-slate-900/70 dark:hover:bg-slate-800"
                                                    onClick={(event) =>
                                                        handleInternalNavigation(event, "/account", true)
                                                    }
                                                >
                                                    <Avatar className="size-11 ring-2 ring-white/50 dark:ring-slate-800/50">
                                                        {user.userAvatar ? (
                                                            <AvatarImage src={user.userAvatar} alt={displayName} />
                                                        ) : null}
                                                        <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-[15px] font-medium text-white dark:from-indigo-600 dark:to-indigo-700">
                                                            {avatarFallback}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="min-w-0">
                                                        <div className="truncate text-[15px] font-semibold text-slate-900 dark:text-white">
                                                            {displayName}
                                                        </div>
                                                        <div className="truncate text-[13px] text-slate-500 dark:text-slate-400">
                                                            {user.userEmail}
                                                        </div>
                                                    </div>
                                                </a>
                                                {isAdmin ? (
                                                    <a
                                                        href="/admin"
                                                        aria-label="进入后台管理"
                                                        className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background text-sm font-medium text-slate-700 transition-colors hover:bg-muted dark:text-slate-200"
                                                        onClick={(event) =>
                                                            handleInternalNavigation(event, "/admin", true)
                                                        }
                                                    >
                                                        <ShieldCheck className="size-4" strokeWidth={2} />
                                                        后台管理
                                                    </a>
                                                ) : null}
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="h-10 w-full rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                                                    onClick={handleLogout}
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
            {isAuthenticated && user ? (
                <>
                    <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        tabIndex={-1}
                        onChange={handleAccountAvatarUpload}
                    />
                </>
            ) : null}
            <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />

            {/* Settings Dialog */}
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                <DialogContent className="max-w-lg rounded-xl border-slate-200 bg-white p-0 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                    <form onSubmit={handleSaveSettings}>
                        <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
                            <DialogHeader className="text-left">
                                <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                                    <Settings className="size-6" />
                                </div>
                                <DialogTitle className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                                    个人设置
                                </DialogTitle>
                                <DialogDescription className="text-sm text-slate-500 dark:text-slate-400">
                                    更新你的个人资料信息
                                </DialogDescription>
                            </DialogHeader>
                        </div>

                        <div className="space-y-5 px-6 py-6">
                            {/* Avatar Upload */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                                    头像
                                </label>
                                <div className="mt-3 flex items-center gap-4">
                                    <Avatar className="size-16 ring-2 ring-slate-200 dark:ring-slate-700">
                                        {user?.userAvatar ? (
                                            <AvatarImage src={user.userAvatar} alt={displayName} />
                                        ) : null}
                                        <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-lg font-semibold text-white">
                                            {avatarFallback}
                                        </AvatarFallback>
                                    </Avatar>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={uploading}
                                        onClick={() => avatarInputRef.current?.click()}
                                        className="gap-2"
                                    >
                                        {uploading ? (
                                            <Loader2 className="size-4 animate-spin" />
                                        ) : (
                                            <Camera className="size-4" />
                                        )}
                                        上传头像
                                    </Button>
                                </div>
                                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                    推荐使用 JPG、PNG 格式，文件大小不超过 5MB
                                </p>
                            </div>

                            {/* Username */}
                            <div>
                                <label htmlFor="settings-username" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                                    用户名
                                </label>
                                <Input
                                    id="settings-username"
                                    value={settingsForm.username}
                                    onChange={(e) =>
                                        setSettingsForm((prev) => ({ ...prev, username: e.target.value }))
                                    }
                                    className="mt-2 h-10 rounded-lg"
                                    placeholder="输入用户名"
                                />
                            </div>

                            {/* Nickname */}
                            <div>
                                <label htmlFor="settings-nickname" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                                    昵称
                                </label>
                                <Input
                                    id="settings-nickname"
                                    value={settingsForm.nickname}
                                    onChange={(e) =>
                                        setSettingsForm((prev) => ({ ...prev, nickname: e.target.value }))
                                    }
                                    className="mt-2 h-10 rounded-lg"
                                    placeholder="输入昵称"
                                />
                            </div>

                            {/* Bio */}
                            <div>
                                <label htmlFor="settings-bio" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                                    个人简介
                                </label>
                                <textarea
                                    id="settings-bio"
                                    value={settingsForm.bio}
                                    onChange={(e) =>
                                        setSettingsForm((prev) => ({ ...prev, bio: e.target.value }))
                                    }
                                    rows={4}
                                    className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-500"
                                    placeholder="介绍一下自己..."
                                />
                                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                    {settingsForm.bio.length} / 160 字符
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
                            <Button
                                type="button"
                                variant="outline"
                                disabled={savingSettings}
                                onClick={() => setSettingsOpen(false)}
                            >
                                取消
                            </Button>
                            <Button
                                type="submit"
                                disabled={savingSettings}
                                className="gap-2"
                            >
                                {savingSettings ? (
                                    <Loader2 className="size-4 animate-spin" />
                                ) : (
                                    <Settings className="size-4" />
                                )}
                                保存
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </LayoutGroup>
    );
}
