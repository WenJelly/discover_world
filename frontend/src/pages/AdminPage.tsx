import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { toast as sonner } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Crosshair,
  EyeOff,
  ImagePlus,
  LayoutGrid,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Replace,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import { MediaPickerDialog } from "@/components/admin/MediaPickerDialog";
import { AdminReportsPanel } from "@/components/admin/AdminReportsPanel";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { Button } from "@/components/ui/button";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import {
  adminHidePost,
  adminLockForumPost,
  adminPinForumPost,
  adminRestorePost,
  adminUnlockForumPost,
  adminUnpinForumPost,
  ApiError,
  fetchAdminMediaAssetList,
  fetchForumPostCursorList,
  fetchHomepageConfig,
  fetchPublicPostCursorList,
  reviewMediaAsset,
  updateHomepageFeatured,
  updateHomepageHero,
} from "@/lib/api";
import { getMediaDetailUrl, getMediaUrl } from "@/lib/format";
import {
  buildAdminTabHref,
  parseAdminTab,
  type AdminTab,
} from "@/lib/admin-navigation";
import type {
  ForumPostResponse,
  HomepageConfigResponse,
  MediaAssetResponse,
  PublicPostResponse,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export const MAX_FEATURED_COUNT = 20;

const DEFAULT_FOCAL = { x: 50, y: 50 };

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function isAdminRole(role?: string | null) {
  return (role ?? "").trim().toLowerCase() === "admin";
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
}

/** Local editable state for the hero section. */
type HeroDraft = {
  asset: MediaAssetResponse | null;
  focalX: number;
  focalY: number;
};

const ADMIN_SECTION_COPY: Record<
  AdminTab,
  { title: string; description: string }
> = {
  homepage: {
    title: "首页内容管理",
    description: "配置 Hero 大图与精选作品流。",
  },
  "media-review": {
    title: "媒体审核",
    description: "处理待审核作品并记录审核结论。",
  },
  reports: {
    title: "举报工单",
    description: "查看用户举报并完成处理与内容治理。",
  },
  moderation: {
    title: "内容治理",
    description: "管理动态、评论和论坛帖的公开状态。",
  },
};

function navigateTo(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new Event("popstate"));
  window.scrollTo({ top: 0 });
}

export default function AdminPage() {
  const { user, isAuthenticated } = useAuth();
  const isAdmin =
    isAuthenticated && isAdminRole(user?.role || user?.userRole);

  const [config, setConfig] = useState<HomepageConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [heroDraft, setHeroDraft] = useState<HeroDraft>({
    asset: null,
    focalX: DEFAULT_FOCAL.x,
    focalY: DEFAULT_FOCAL.y,
  });
  const [featuredDraft, setFeaturedDraft] = useState<MediaAssetResponse[]>([]);
  const [savingHero, setSavingHero] = useState(false);
  const [savingFeatured, setSavingFeatured] = useState(false);
  const [heroPickerOpen, setHeroPickerOpen] = useState(false);
  const [featuredPickerOpen, setFeaturedPickerOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>(() =>
    parseAdminTab(new URLSearchParams(window.location.search).get("tab"))
  );
  const [pendingMedia, setPendingMedia] = useState<MediaAssetResponse[]>([]);
  const [mediaReviewLoading, setMediaReviewLoading] = useState(false);
  const [mediaReviewMessage, setMediaReviewMessage] = useState("");
  const [reviewingMediaId, setReviewingMediaId] = useState("");
  const [moderationPosts, setModerationPosts] = useState<PublicPostResponse[]>([]);
  const [moderationForumPosts, setModerationForumPosts] = useState<ForumPostResponse[]>([]);
  const [moderationLoading, setModerationLoading] = useState(false);
  const [moderatingId, setModeratingId] = useState("");

  const heroPreviewRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const syncTabFromLocation = () => {
      setActiveTab(
        parseAdminTab(new URLSearchParams(window.location.search).get("tab"))
      );
    };
    window.addEventListener("popstate", syncTabFromLocation);
    return () => window.removeEventListener("popstate", syncTabFromLocation);
  }, []);

  const handleTabChange = useCallback((tab: AdminTab) => {
    const href = buildAdminTabHref(tab);
    window.history.pushState({}, "", href);
    setActiveTab(tab);
    window.scrollTo({ top: 0 });
  }, []);

  const applyConfig = useCallback((next: HomepageConfigResponse) => {
    setConfig(next);
    setHeroDraft({
      asset: next.hero.media,
      focalX: next.hero.focalX,
      focalY: next.hero.focalY,
    });
    setFeaturedDraft(next.featured);
  }, []);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const next = await fetchHomepageConfig({
        variantOption: { compressType: 2 },
      });
      applyConfig(next);
    } catch (error) {
      setLoadError(getErrorMessage(error, "首页配置加载失败，请稍后重试"));
    } finally {
      setLoading(false);
    }
  }, [applyConfig]);

  const loadPendingMedia = useCallback(async () => {
    setMediaReviewLoading(true);
    try {
      const page = await fetchAdminMediaAssetList({
        auditStatus: "pending",
        pageNum: 1,
        pageSize: 24,
        variantOption: { compressType: 2 },
      });
      setPendingMedia(page.list ?? []);
    } catch {
      return;
    } finally {
      setMediaReviewLoading(false);
    }
  }, []);

  const loadModerationContent = useCallback(async () => {
    setModerationLoading(true);
    try {
      const [posts, forums] = await Promise.all([
        fetchPublicPostCursorList({
          pageSize: 20,
          sort: "latest",
          variantOption: { compressType: 2 },
        }),
        fetchForumPostCursorList({
          pageSize: 20,
          variantOption: { compressType: 2 },
        }),
      ]);
      setModerationPosts(posts.list ?? []);
      setModerationForumPosts(forums.list ?? []);
    } catch {
      return;
    } finally {
      setModerationLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    loadConfig();
  }, [isAdmin, loadConfig]);

  useEffect(() => {
    if (!isAdmin || activeTab !== "media-review") return;
    void loadPendingMedia();
  }, [activeTab, isAdmin, loadPendingMedia]);

  useEffect(() => {
    if (!isAdmin || activeTab !== "moderation") return;
    void loadModerationContent();
  }, [activeTab, isAdmin, loadModerationContent]);

  const heroDirty = useMemo(() => {
    if (!config) return false;
    const savedId = config.hero.assetId;
    const draftId = heroDraft.asset?.id ?? "";
    if (savedId !== draftId) return true;
    if (!draftId) return false;
    return (
      Math.round(heroDraft.focalX) !== Math.round(config.hero.focalX) ||
      Math.round(heroDraft.focalY) !== Math.round(config.hero.focalY)
    );
  }, [config, heroDraft]);

  const featuredDirty = useMemo(() => {
    if (!config) return false;
    const saved = config.featured.map((a) => a.id);
    const draft = featuredDraft.map((a) => a.id);
    return (
      saved.length !== draft.length ||
      saved.some((id, index) => id !== draft[index])
    );
  }, [config, featuredDraft]);

  const setFocalFromPointer = useCallback((event: ReactPointerEvent) => {
    const rect = heroPreviewRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    setHeroDraft((prev) => ({
      ...prev,
      focalX: clampPercent(((event.clientX - rect.left) / rect.width) * 100),
      focalY: clampPercent(((event.clientY - rect.top) / rect.height) * 100),
    }));
  }, []);

  const handlePreviewPointerDown = (event: ReactPointerEvent) => {
    if (!heroDraft.asset) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    setFocalFromPointer(event);
  };

  const handlePreviewPointerMove = (event: ReactPointerEvent) => {
    if (!dragging) return;
    setFocalFromPointer(event);
  };

  const stopDragging = () => setDragging(false);

  const handleSaveHero = async () => {
    setSavingHero(true);
    try {
      const next = await updateHomepageHero({
        assetId: heroDraft.asset?.id ?? "",
        focalX: heroDraft.focalX,
        focalY: heroDraft.focalY,
      });
      applyConfig(next);
      sonner.success("Hero 配置已保存", {
        description: heroDraft.asset ? "首页主视觉已更新。" : "首页主视觉已清空。",
      });
    } catch (error) {
      sonner.error("Hero 配置保存失败", {
        description: getErrorMessage(error, "请稍后重试。"),
      });
    } finally {
      setSavingHero(false);
    }
  };

  const handleSaveFeatured = async () => {
    setSavingFeatured(true);
    try {
      const next = await updateHomepageFeatured({
        mediaAssetIds: featuredDraft.map((a) => a.id),
      });
      applyConfig(next);
      sonner.success("精选作品流已保存", {
        description: `首页精选已更新，共 ${next.featured.length} 张作品。`,
      });
    } catch (error) {
      sonner.error("精选作品流保存失败", {
        description: getErrorMessage(error, "请稍后重试。"),
      });
    } finally {
      setSavingFeatured(false);
    }
  };

  const handleReviewMedia = async (
    asset: MediaAssetResponse,
    auditStatus: "approved" | "rejected"
  ) => {
    setReviewingMediaId(asset.id);
    try {
      await reviewMediaAsset({
        id: asset.id,
        auditStatus,
        reviewMessage: mediaReviewMessage.trim() || undefined,
      });
      setPendingMedia((current) => current.filter((item) => item.id !== asset.id));
      setMediaReviewMessage("");
      sonner.success(auditStatus === "approved" ? "作品已通过" : "作品已拒绝");
    } catch (error) {
      sonner.error("审核操作失败", {
        description: getErrorMessage(error, "请稍后重试。"),
      });
    } finally {
      setReviewingMediaId("");
    }
  };

  const handleModeratePost = async (
    post: PublicPostResponse,
    action: "hide" | "restore"
  ) => {
    setModeratingId(post.id);
    try {
      if (action === "hide") {
        await adminHidePost({ id: post.id });
        setModerationPosts((current) =>
          current.map((item) =>
            item.id === post.id ? { ...item, status: "hidden" } : item
          )
        );
      } else {
        await adminRestorePost({ id: post.id });
        setModerationPosts((current) =>
          current.map((item) =>
            item.id === post.id ? { ...item, status: "active" } : item
          )
        );
      }
      sonner.success(action === "hide" ? "动态已隐藏" : "动态已恢复");
    } catch (error) {
      sonner.error("动态治理失败", {
        description: getErrorMessage(error, "请稍后重试。"),
      });
    } finally {
      setModeratingId("");
    }
  };

  const handleModerateForumPost = async (
    item: ForumPostResponse,
    action: "lock" | "unlock" | "pin" | "unpin"
  ) => {
    setModeratingId(item.post.id);
    try {
      if (action === "lock") {
        await adminLockForumPost({ id: item.post.id });
      } else if (action === "unlock") {
        await adminUnlockForumPost({ id: item.post.id });
      } else if (action === "pin") {
        await adminPinForumPost({ id: item.post.id });
      } else {
        await adminUnpinForumPost({ id: item.post.id });
      }
      setModerationForumPosts((current) =>
        current.map((entry) =>
          entry.post.id === item.post.id
            ? {
                ...entry,
                isLocked:
                  action === "lock"
                    ? true
                    : action === "unlock"
                      ? false
                      : entry.isLocked,
                isBoardPinned:
                  action === "pin"
                    ? true
                    : action === "unpin"
                      ? false
                      : entry.isBoardPinned,
              }
            : entry
        )
      );
      sonner.success("帖子治理操作已完成");
    } catch (error) {
      sonner.error("帖子治理失败", {
        description: getErrorMessage(error, "请稍后重试。"),
      });
    } finally {
      setModeratingId("");
    }
  };

  const moveFeatured = (index: number, direction: -1 | 1) => {
    setFeaturedDraft((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const removeFeatured = (id: string) => {
    setFeaturedDraft((prev) => prev.filter((a) => a.id !== id));
  };

  const featuredIds = useMemo(
    () => featuredDraft.map((a) => a.id),
    [featuredDraft]
  );

  // ---- Access guard: the console is admin-only. ----
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 pt-16 dark:bg-slate-950">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
            <ShieldAlert className="size-7" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            无权访问
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            该页面仅站点管理员可见。如果你认为这是一个错误，请联系管理员。
          </p>
          <Button
            type="button"
            className="mt-6"
            onClick={() => navigateTo("/")}
          >
            返回首页
          </Button>
        </div>
      </div>
    );
  }

  const heroImageUrl = heroDraft.asset
    ? getMediaDetailUrl(heroDraft.asset) || getMediaUrl(heroDraft.asset)
    : "";
  const sectionCopy = ADMIN_SECTION_COPY[activeTab];

  return (
    <SidebarProvider className="min-h-[calc(100svh-var(--navbar-height,4rem))] pt-[var(--navbar-height,4rem)]">
      <AdminSidebar activeTab={activeTab} onTabChange={handleTabChange} />
      <SidebarInset className="min-w-0 bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
        <header className="sticky top-[var(--navbar-height,4rem)] z-20 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:px-6">
          <SidebarTrigger aria-label="切换后台侧边栏" />
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-foreground">
              {sectionCopy.title}
            </h1>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">
              {sectionCopy.description}
            </p>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
          {activeTab === "homepage" ? (
          loading ? (
          <div
            className="flex flex-col gap-8"
            role="status"
            aria-label="首页配置加载中"
          >
            <div className="h-96 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/70" />
            <div className="h-72 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/70" />
          </div>
          ) : loadError ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white py-20 text-center dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {loadError}
            </p>
            <Button type="button" variant="outline" onClick={loadConfig}>
              <RefreshCw className="size-4" aria-hidden="true" />
              重新加载
            </Button>
          </div>
        ) : (
          <>
            {/* ---- Hero section ---- */}
            <section
              aria-labelledby="admin-hero-heading"
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                    <ImagePlus className="size-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h2
                      id="admin-hero-heading"
                      className="text-base font-semibold text-slate-900 dark:text-slate-100"
                    >
                      首页 Hero 图
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      从公开作品中选择一张作为首页大图，可拖动焦点调整展示位置
                    </p>
                  </div>
                </div>
                {heroDirty ? (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                    有未保存的修改
                  </span>
                ) : null}
              </div>

              <div className="space-y-5 px-6 py-6">
                {heroDraft.asset ? (
                  <>
                    {/* Focal-point preview: click/drag places the crosshair. */}
                    <div
                      ref={heroPreviewRef}
                      onPointerDown={handlePreviewPointerDown}
                      onPointerMove={handlePreviewPointerMove}
                      onPointerUp={stopDragging}
                      onPointerCancel={stopDragging}
                      className={cn(
                        "relative aspect-video touch-none overflow-hidden rounded-xl bg-slate-950 select-none",
                        dragging ? "cursor-grabbing" : "cursor-crosshair"
                      )}
                    >
                      <img
                        src={heroImageUrl}
                        alt={`Hero 预览：${heroDraft.asset.title}`}
                        draggable={false}
                        className="h-full w-full object-cover"
                        style={{
                          objectPosition: `${heroDraft.focalX}% ${heroDraft.focalY}%`,
                        }}
                      />
                      {/* Same scrim the real homepage hero uses, so the
                          preview is honest about final contrast. */}
                      <div
                        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-black/25 to-black/55"
                        aria-hidden="true"
                      />
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
                        style={{
                          left: `${heroDraft.focalX}%`,
                          top: `${heroDraft.focalY}%`,
                        }}
                      >
                        <span
                          className={cn(
                            "flex size-9 items-center justify-center rounded-full border-2 border-white bg-indigo-500/70 text-white shadow-lg backdrop-blur-sm transition-transform duration-150 motion-reduce:transition-none",
                            dragging && "scale-110"
                          )}
                        >
                          <Crosshair className="size-4" strokeWidth={2.5} />
                        </span>
                      </div>
                      <p className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-md bg-black/50 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
                        {heroDraft.asset.title}
                      </p>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      在预览图上点击或拖动设置焦点，也可以使用下方滑杆精确调整。焦点代表裁切时优先保留的位置。
                    </p>

                    {/* Slider fallback: keyboard/precision control. */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <div className="flex items-center justify-between">
                          <label
                            htmlFor="hero-focal-x"
                            className="text-sm font-medium text-slate-700 dark:text-slate-200"
                          >
                            水平焦点
                          </label>
                          <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                            {Math.round(heroDraft.focalX)}%
                          </span>
                        </div>
                        <input
                          id="hero-focal-x"
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={Math.round(heroDraft.focalX)}
                          onChange={(event) =>
                            setHeroDraft((prev) => ({
                              ...prev,
                              focalX: Number(event.target.value),
                            }))
                          }
                          className="mt-2 w-full accent-indigo-600"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <label
                            htmlFor="hero-focal-y"
                            className="text-sm font-medium text-slate-700 dark:text-slate-200"
                          >
                            垂直焦点
                          </label>
                          <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                            {Math.round(heroDraft.focalY)}%
                          </span>
                        </div>
                        <input
                          id="hero-focal-y"
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={Math.round(heroDraft.focalY)}
                          onChange={(event) =>
                            setHeroDraft((prev) => ({
                              ...prev,
                              focalY: Number(event.target.value),
                            }))
                          }
                          className="mt-2 w-full accent-indigo-600"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setHeroPickerOpen(true)}
                      >
                        <Replace className="size-4" aria-hidden="true" />
                        更换图片
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={
                          heroDraft.focalX === DEFAULT_FOCAL.x &&
                          heroDraft.focalY === DEFAULT_FOCAL.y
                        }
                        onClick={() =>
                          setHeroDraft((prev) => ({
                            ...prev,
                            focalX: DEFAULT_FOCAL.x,
                            focalY: DEFAULT_FOCAL.y,
                          }))
                        }
                      >
                        <Crosshair className="size-4" aria-hidden="true" />
                        焦点居中
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() =>
                          setHeroDraft({
                            asset: null,
                            focalX: DEFAULT_FOCAL.x,
                            focalY: DEFAULT_FOCAL.y,
                          })
                        }
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                        清除 Hero 图
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 py-14 text-center dark:border-slate-700 dark:bg-slate-800/40">
                    <div className="flex size-12 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm dark:bg-slate-800 dark:text-slate-500">
                      <ImagePlus className="size-6" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {config?.hero.assetId
                          ? "Hero 图将在保存后清除"
                          : "尚未设置 Hero 图"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        未设置时首页将自动展示最新公开作品
                      </p>
                    </div>
                    <Button type="button" onClick={() => setHeroPickerOpen(true)}>
                      <Plus className="size-4" aria-hidden="true" />
                      从公开作品中选择
                    </Button>
                  </div>
                )}

                <div className="flex justify-end border-t border-slate-100 pt-4 dark:border-slate-800">
                  <Button
                    type="button"
                    disabled={!heroDirty || savingHero}
                    onClick={handleSaveHero}
                  >
                    {savingHero ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : null}
                    保存 Hero 配置
                  </Button>
                </div>
              </div>
            </section>

            {/* ---- Featured stream section ---- */}
            <section
              aria-labelledby="admin-featured-heading"
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                    <LayoutGrid className="size-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h2
                      id="admin-featured-heading"
                      className="text-base font-semibold text-slate-900 dark:text-slate-100"
                    >
                      首页精选作品流
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      精选作品将展示在首页滚动图片流中，按下方顺序排列
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {featuredDirty ? (
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                      有未保存的修改
                    </span>
                  ) : null}
                  <span
                    className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    aria-live="polite"
                  >
                    {featuredDraft.length} / {MAX_FEATURED_COUNT}
                  </span>
                </div>
              </div>

              <div className="space-y-5 px-6 py-6">
                {featuredDraft.length === 0 ? (
                  <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 py-14 text-center dark:border-slate-700 dark:bg-slate-800/40">
                    <div className="flex size-12 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm dark:bg-slate-800 dark:text-slate-500">
                      <Sparkles className="size-6" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {config && config.featured.length > 0
                          ? "精选列表将在保存后清空"
                          : "尚未设置精选作品"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        未设置时首页将自动展示最新公开作品
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => setFeaturedPickerOpen(true)}
                    >
                      <Plus className="size-4" aria-hidden="true" />
                      从公开作品中选择
                    </Button>
                  </div>
                ) : (
                  <ol
                    className="grid list-none grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
                    aria-label="精选作品列表（按展示顺序）"
                  >
                    {featuredDraft.map((asset, index) => (
                      <li
                        key={asset.id}
                        className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
                      >
                        <div className="aspect-square">
                          <img
                            src={getMediaUrl(asset)}
                            alt={asset.title}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <span className="absolute left-2 top-2 flex size-6 items-center justify-center rounded-full bg-black/60 text-xs font-semibold tabular-nums text-white backdrop-blur-sm">
                          {index + 1}
                        </span>
                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/75 to-transparent px-2 pb-2 pt-8">
                          <p className="min-w-0 truncate text-xs font-medium text-white">
                            {asset.title}
                          </p>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => moveFeatured(index, -1)}
                              aria-label={`将「${asset.title}」前移`}
                              className="flex size-7 cursor-pointer items-center justify-center rounded-md bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <ArrowLeft className="size-3.5" strokeWidth={2.5} />
                            </button>
                            <button
                              type="button"
                              disabled={index === featuredDraft.length - 1}
                              onClick={() => moveFeatured(index, 1)}
                              aria-label={`将「${asset.title}」后移`}
                              className="flex size-7 cursor-pointer items-center justify-center rounded-md bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <ArrowRight className="size-3.5" strokeWidth={2.5} />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeFeatured(asset.id)}
                              aria-label={`将「${asset.title}」移出精选`}
                              className="flex size-7 cursor-pointer items-center justify-center rounded-md bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-red-500/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                            >
                              <X className="size-3.5" strokeWidth={2.5} />
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={featuredDraft.length >= MAX_FEATURED_COUNT}
                    onClick={() => setFeaturedPickerOpen(true)}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    添加作品
                  </Button>
                  <Button
                    type="button"
                    disabled={!featuredDirty || savingFeatured}
                    onClick={handleSaveFeatured}
                  >
                    {savingFeatured ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : null}
                    保存精选列表
                  </Button>
                </div>
              </div>
            </section>
          </>
          )
        ) : activeTab === "media-review" ? (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <ShieldAlert className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    媒体审核
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    查看待审核作品，并通过或拒绝公开展示。
                  </p>
                </div>
              </div>
              <Button type="button" variant="outline" onClick={() => void loadPendingMedia()}>
                <RefreshCw className="size-4" aria-hidden="true" />
                刷新
              </Button>
            </div>
            <div className="space-y-4 px-6 py-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                审核备注
                <textarea
                  value={mediaReviewMessage}
                  onChange={(event) => setMediaReviewMessage(event.target.value)}
                  placeholder="拒绝时建议填写原因，通过可留空"
                  rows={3}
                  className="mt-2 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              {mediaReviewLoading ? (
                <div className="flex justify-center py-12 text-slate-500">
                  <Loader2 className="size-5 animate-spin" aria-label="媒体审核加载中" />
                </div>
              ) : pendingMedia.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  暂无待审核作品
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {pendingMedia.map((asset) => (
                    <article key={asset.id} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
                      <div className="aspect-[4/3] bg-slate-200 dark:bg-slate-800">
                        <img
                          src={getMediaUrl(asset)}
                          alt={asset.title}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="space-y-3 p-4">
                        <div>
                          <h3 className="line-clamp-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {asset.title}
                          </h3>
                          <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                            {asset.owner?.nickname || asset.owner?.username || "未知用户"}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={reviewingMediaId === asset.id}
                            onClick={() => void handleReviewMedia(asset, "approved")}
                          >
                            {reviewingMediaId === asset.id ? <Loader2 className="size-4 animate-spin" /> : null}
                            通过
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={reviewingMediaId === asset.id}
                            onClick={() => void handleReviewMedia(asset, "rejected")}
                          >
                            拒绝
                          </Button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        ) : activeTab === "reports" ? (
          <AdminReportsPanel />
        ) : (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <MessageSquare className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    内容治理
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    隐藏或恢复动态，锁定/解锁论坛帖，并管理分区置顶。
                  </p>
                </div>
              </div>
              <Button type="button" variant="outline" onClick={() => void loadModerationContent()}>
                <RefreshCw className="size-4" aria-hidden="true" />
                刷新
              </Button>
            </div>
            <div className="grid gap-6 px-6 py-6 lg:grid-cols-2">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  动态
                </h3>
                {moderationLoading ? (
                  <div className="py-8 text-center text-sm text-slate-500">加载中...</div>
                ) : moderationPosts.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 py-8 text-center text-sm text-slate-500 dark:border-slate-700">
                    暂无可治理动态
                  </div>
                ) : (
                  moderationPosts.map((post) => (
                    <article key={post.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                      <p className="line-clamp-2 text-sm text-slate-800 dark:text-slate-200">
                        {post.content || "无文字动态"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {post.author?.nickname || post.author?.username || "未知用户"} · {post.status}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={moderatingId === post.id}
                          onClick={() => void handleModeratePost(post, "hide")}
                        >
                          <EyeOff className="size-4" aria-hidden="true" />
                          隐藏动态
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={moderatingId === post.id}
                          onClick={() => void handleModeratePost(post, "restore")}
                        >
                          <RotateCcw className="size-4" aria-hidden="true" />
                          恢复动态
                        </Button>
                      </div>
                    </article>
                  ))
                )}
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  论坛帖子
                </h3>
                {moderationForumPosts.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 py-8 text-center text-sm text-slate-500 dark:border-slate-700">
                    暂无论坛帖子
                  </div>
                ) : (
                  moderationForumPosts.map((item) => (
                    <article key={item.post.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {item.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.board.name} · {item.isLocked ? "已锁定" : "未锁定"} · {item.isBoardPinned ? "分区置顶" : "未置顶"}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={moderatingId === item.post.id}
                          onClick={() => void handleModerateForumPost(item, item.isLocked ? "unlock" : "lock")}
                        >
                          {item.isLocked ? "解锁帖子" : "锁定帖子"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={moderatingId === item.post.id}
                          onClick={() => void handleModerateForumPost(item, item.isBoardPinned ? "unpin" : "pin")}
                        >
                          {item.isBoardPinned ? "取消分区置顶" : "分区置顶"}
                        </Button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          </section>
        )}
        </div>

        {/* Hero picker: single-select over public works. */}
        <MediaPickerDialog
          open={heroPickerOpen}
          onOpenChange={setHeroPickerOpen}
          mode="single"
          title="选择 Hero 图"
          description="从已公开的作品中选择一张作为首页 Hero 大图"
          confirmLabel="使用这张图"
          onConfirm={(assets) => {
            const asset = assets[0];
            if (!asset) return;
            setHeroDraft({
              asset,
              focalX: DEFAULT_FOCAL.x,
              focalY: DEFAULT_FOCAL.y,
            });
          }}
        />

        {/* Featured picker: append-only multi-select. */}
        <MediaPickerDialog
          open={featuredPickerOpen}
          onOpenChange={setFeaturedPickerOpen}
          mode="multiple"
          title="添加精选作品"
          description="从已公开的作品中选取加入首页精选图片流"
          excludedIds={featuredIds}
          maxCount={Math.max(0, MAX_FEATURED_COUNT - featuredDraft.length)}
          confirmLabel="加入精选"
          onConfirm={(assets) => {
            setFeaturedDraft((prev) => {
              const seen = new Set(prev.map((a) => a.id));
              const additions = assets.filter((a) => !seen.has(a.id));
              return [...prev, ...additions].slice(0, MAX_FEATURED_COUNT);
            });
          }}
        />
      </SidebarInset>
    </SidebarProvider>
  );
}
