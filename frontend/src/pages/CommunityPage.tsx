import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast as sonner } from "sonner";
import {
  ArrowLeft,
  Bell,
  ImageOff,
  Loader2,
  MessageSquare,
  Newspaper,
  Plus,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { DiscoverPictureCard } from "@/components/discover/DiscoverPictureCard";
import { PostCard } from "@/components/post/PostCard";
import type { PostAuthor } from "@/components/post/PostComposerDialog";
import {
  POST_MAX_IMAGES,
  PostImageAttach,
  type AttachedImage,
} from "@/components/post/PostImageAttach";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { POST_TYPE_FILTER_OPTIONS } from "@/lib/post-type";
import {
  adminLockForumPost,
  adminPinForumPost,
  adminUnlockForumPost,
  adminUnpinForumPost,
  createForumPost,
  fetchPostDetail,
  fetchFollowingMediaCursorList,
  fetchFollowingPostCursorList,
  fetchForumBoardList,
  fetchForumPostCursorList,
  fetchPublicPostCursorList,
  uploadMediaAsset,
} from "@/lib/api";
import { notifyMediaAssetUploaded } from "@/lib/media-events";
import { interactiveSurfaceClassName } from "@/lib/interactive-surface";
import type {
  ForumBoardResponse,
  ForumPostResponse,
  MediaAssetResponse,
  PostTypeFilter,
  ProfilePostResponse,
  PublicPostResponse,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type CommunityTab = "public" | "followingPosts" | "followingMedia" | "forum";
type PublicSort = "latest" | "hot" | "rising";
type ForumModerationAction = "lock" | "unlock" | "pin" | "unpin";

const COMMUNITY_TABS: Array<{
  key: CommunityTab;
  label: string;
  icon: typeof Newspaper;
  authRequired?: boolean;
}> = [
  { key: "public", label: "公开动态", icon: Newspaper },
  { key: "followingPosts", label: "关注动态", icon: Users, authRequired: true },
  { key: "followingMedia", label: "关注作品", icon: ImageOff, authRequired: true },
  { key: "forum", label: "论坛", icon: MessageSquare },
];

const POST_PAGE_SIZE = 20;
const MEDIA_PAGE_SIZE = 24;
const FORUM_PAGE_SIZE = 20;
const PUBLIC_SORT_OPTIONS: Array<{ value: PublicSort; label: string }> = [
  { value: "latest", label: "最新" },
  { value: "hot", label: "热门" },
  { value: "rising", label: "上升" },
];

function getInitialTab(): CommunityTab {
  const tab = new URLSearchParams(window.location.search).get("tab");
  if (
    tab === "followingPosts" ||
    tab === "followingMedia" ||
    tab === "forum"
  ) {
    return tab;
  }
  return "public";
}

function getInitialPostId() {
  return new URLSearchParams(window.location.search).get("postId")?.trim() ?? "";
}

function isAdminRole(role?: string | null) {
  return (role ?? "").trim().toLowerCase() === "admin";
}

function revokeAttachedImage(image: AttachedImage) {
  URL.revokeObjectURL(image.thumbUrl);
}

function authorFromPost(post: PublicPostResponse): PostAuthor {
  const author = post.author;
  const username = author?.nickname || author?.username || "用户";
  const handle = author?.username ? `@${author.username}` : "";
  return {
    username,
    avatarUrl: author?.avatarUrl || author?.userAvatar || "",
    handle,
  };
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/20 px-5 py-10 text-center">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mx-auto mt-2 max-w-[36rem] text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function PostFeed({
  posts,
  loading,
  hasMore,
  onLoadMore,
  onOpenDetail,
}: {
  posts: PublicPostResponse[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onOpenDetail: (post: PublicPostResponse) => void;
}) {
  if (!loading && posts.length === 0) {
    return (
      <EmptyState
        title="还没有动态"
        description="等第一条公开动态出现后，这里会按时间展示。"
      />
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <div key={post.id} className="space-y-2">
          <PostCard post={post} author={authorFromPost(post)} />
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => onOpenDetail(post)}
            >
              查看详情
            </Button>
          </div>
        </div>
      ))}
      {loading ? (
        <div className="flex justify-center py-6 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" aria-label="加载中" />
        </div>
      ) : null}
      {!loading && hasMore ? (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={onLoadMore}>
            加载更多
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ForumComposer({
  boards,
  selectedBoardId,
  isAuthenticated,
  onCreated,
}: {
  boards: ForumBoardResponse[];
  selectedBoardId: string;
  isAuthenticated: boolean;
  onCreated: (post: ForumPostResponse) => void;
}) {
  const [boardId, setBoardId] = useState(selectedBoardId);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<AttachedImage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const imageInputIdRef = useRef(
    `forum-composer-images-${Math.random().toString(36).slice(2)}`
  );

  useEffect(() => {
    setBoardId(selectedBoardId);
  }, [selectedBoardId]);

  const canSubmit =
    isAuthenticated &&
    boardId.trim() !== "" &&
    title.trim() !== "" &&
    (content.trim() !== "" || images.length > 0) &&
    !submitting;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setSubmitting(true);
    try {
      const created = await createForumPost({
        boardId,
        title: title.trim(),
        content: content.trim() || undefined,
        imageIds: await uploadForumImages(images),
      });
      onCreated(created);
      setTitle("");
      setContent("");
      images.forEach(revokeAttachedImage);
      setImages([]);
      sonner.success("讨论已发布", {
        description: "内容已发布到所选论坛分区。",
      });
    } catch (error) {
      sonner.error("发布失败", {
        description: error instanceof Error ? error.message : "请稍后重试。",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const uploadForumImages = async (items: AttachedImage[]) => {
    const imageIds: string[] = [];
    for (const image of items) {
      if (image.id) {
        imageIds.push(image.id);
        continue;
      }
      const asset = await uploadMediaAsset(image.file, {
        visibility: "public",
        assetUsage: "post",
      });
      notifyMediaAssetUploaded(asset);
      imageIds.push(asset.id);
    }
    return imageIds;
  };

  const handleRemoveImage = (clientId: string) => {
    setImages((current) => {
      const removed = current.find((image) => image.clientId === clientId);
      if (removed) {
        revokeAttachedImage(removed);
      }
      return current.filter((image) => image.clientId !== clientId);
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-border bg-card p-4"
      aria-label="发布讨论"
    >
      <div className="flex flex-col gap-3 sm:flex-row">
        <Select
          value={boardId}
          onValueChange={(nextValue) => {
            if (nextValue) {
              setBoardId(nextValue);
            }
          }}
          disabled={!isAuthenticated || submitting || boards.length === 0}
        >
          <SelectTrigger
            className="h-10 w-full rounded-md sm:w-52"
            aria-label="选择论坛分区"
          >
            <SelectValue placeholder="选择分区" />
          </SelectTrigger>
          <SelectContent
            align="start"
            alignItemWithTrigger={false}
            className="z-[70]"
          >
            {boards.map((board) => (
              <SelectItem key={board.id} value={board.id}>
                {board.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          disabled={!isAuthenticated || submitting}
          maxLength={120}
          placeholder={isAuthenticated ? "讨论标题" : "请先登录后发布讨论"}
          className="h-10 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-blue-500/20 disabled:opacity-60"
          aria-label="讨论标题"
        />
      </div>
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        disabled={!isAuthenticated || submitting}
        placeholder="分享路线、器材、目的地经验，或向社区提问。"
        className="mt-3 min-h-28 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-blue-500/20 disabled:opacity-60"
        aria-label="讨论内容"
      />
      <div className="mt-3">
        <PostImageAttach
          images={images}
          onAdd={(image) =>
            setImages((current) =>
              current.length >= POST_MAX_IMAGES ? current : [...current, image]
            )
          }
          onRemove={handleRemoveImage}
          disabled={!isAuthenticated || submitting}
          inputId={imageInputIdRef.current}
          className="rounded-md border border-dashed border-border bg-muted/20 p-3"
        />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          公开论坛内容会展示给所有访客。
        </p>
        <Button type="submit" disabled={!canSubmit}>
          {submitting ? (
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="mr-2 size-4" aria-hidden />
          )}
          发布讨论
        </Button>
      </div>
    </form>
  );
}

export default function CommunityPage() {
  const [activeTab, setActiveTab] = useState<CommunityTab>(getInitialTab);
  const [publicSort, setPublicSort] = useState<PublicSort>("latest");
  const [publicPostType, setPublicPostType] = useState<PostTypeFilter>("all");
  const [publicSearchText, setPublicSearchText] = useState("");
  const [publicPosts, setPublicPosts] = useState<PublicPostResponse[]>([]);
  const [publicCursor, setPublicCursor] = useState("");
  const [publicHasMore, setPublicHasMore] = useState(false);
  const [publicLoading, setPublicLoading] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(getInitialPostId);
  const [selectedPost, setSelectedPost] = useState<ProfilePostResponse | null>(null);
  const [selectedPostAuthor, setSelectedPostAuthor] =
    useState<PostAuthor | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [followingPosts, setFollowingPosts] = useState<PublicPostResponse[]>([]);
  const [followingPostCursor, setFollowingPostCursor] = useState("");
  const [followingPostHasMore, setFollowingPostHasMore] = useState(false);
  const [followingPostLoading, setFollowingPostLoading] = useState(false);
  const [followingMedia, setFollowingMedia] = useState<MediaAssetResponse[]>([]);
  const [followingMediaCursor, setFollowingMediaCursor] = useState("");
  const [followingMediaHasMore, setFollowingMediaHasMore] = useState(false);
  const [followingMediaLoading, setFollowingMediaLoading] = useState(false);
  const [boards, setBoards] = useState<ForumBoardResponse[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState("");
  const [forumPosts, setForumPosts] = useState<ForumPostResponse[]>([]);
  const [forumCursor, setForumCursor] = useState("");
  const [forumHasMore, setForumHasMore] = useState(false);
  const [forumLoading, setForumLoading] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const isAdmin = isAuthenticated && isAdminRole(user?.role || user?.userRole);

  const selectedBoard = useMemo(
    () => boards.find((board) => board.id === selectedBoardId) ?? boards[0],
    [boards, selectedBoardId]
  );

  const navigateTab = (tab: CommunityTab) => {
    setActiveTab(tab);
    setSelectedPostId("");
    setSelectedPost(null);
    setSelectedPostAuthor(null);
    const url = tab === "public" ? "/community" : `/community?tab=${tab}`;
    window.history.pushState({}, "", url);
  };

  const loadPublicPosts = useCallback(
    async (mode: "reset" | "append" = "reset") => {
      setPublicLoading(true);
      try {
        const page = await fetchPublicPostCursorList({
          cursor: mode === "append" ? publicCursor : "",
          pageSize: POST_PAGE_SIZE,
          sort: publicSort,
          searchText: publicSearchText,
          postType: publicPostType === "all" ? undefined : publicPostType,
          variantOption: { compressType: 2 },
        });
        setPublicPosts((current) =>
          mode === "append" ? [...current, ...page.list] : page.list
        );
        setPublicCursor(page.nextCursor);
        setPublicHasMore(page.hasMore);
      } catch {
        return;
      } finally {
        setPublicLoading(false);
      }
    },
    [publicCursor, publicPostType, publicSearchText, publicSort]
  );

  const loadFollowingPosts = useCallback(
    async (mode: "reset" | "append" = "reset") => {
      if (!isAuthenticated) return;
      setFollowingPostLoading(true);
      try {
        const page = await fetchFollowingPostCursorList({
          cursor: mode === "append" ? followingPostCursor : "",
          pageSize: POST_PAGE_SIZE,
          variantOption: { compressType: 2 },
        });
        setFollowingPosts((current) =>
          mode === "append" ? [...current, ...page.list] : page.list
        );
        setFollowingPostCursor(page.nextCursor);
        setFollowingPostHasMore(page.hasMore);
      } catch {
        return;
      } finally {
        setFollowingPostLoading(false);
      }
    },
    [followingPostCursor, isAuthenticated]
  );

  const loadFollowingMedia = useCallback(
    async (mode: "reset" | "append" = "reset") => {
      if (!isAuthenticated) return;
      setFollowingMediaLoading(true);
      try {
        const page = await fetchFollowingMediaCursorList({
          cursor: mode === "append" ? followingMediaCursor : "",
          pageSize: MEDIA_PAGE_SIZE,
          variantOption: { compressType: 2 },
        });
        setFollowingMedia((current) =>
          mode === "append" ? [...current, ...page.list] : page.list
        );
        setFollowingMediaCursor(page.nextCursor);
        setFollowingMediaHasMore(page.hasMore);
      } catch {
        return;
      } finally {
        setFollowingMediaLoading(false);
      }
    },
    [followingMediaCursor, isAuthenticated]
  );

  const loadForumPosts = useCallback(
    async (mode: "reset" | "append" = "reset", boardId = selectedBoardId) => {
      setForumLoading(true);
      try {
        const page = await fetchForumPostCursorList({
          boardId,
          cursor: mode === "append" ? forumCursor : "",
          pageSize: FORUM_PAGE_SIZE,
          variantOption: { compressType: 2 },
        });
        setForumPosts((current) =>
          mode === "append" ? [...current, ...page.list] : page.list
        );
        setForumCursor(page.nextCursor);
        setForumHasMore(page.hasMore);
      } catch {
        return;
      } finally {
        setForumLoading(false);
      }
    },
    [forumCursor, selectedBoardId]
  );

  const loadSelectedPost = useCallback(
    async (postId: string) => {
      if (!postId) return;
      setDetailLoading(true);
      try {
        const detail = await fetchPostDetail({ id: postId });
        setSelectedPost(detail);
      } catch {
        setSelectedPost(null);
      } finally {
        setDetailLoading(false);
      }
    },
    []
  );

  const openPostDetail = (
    post: PublicPostResponse,
    tab: CommunityTab = activeTab
  ) => {
    setSelectedPostId(post.id);
    setSelectedPost(post);
    setSelectedPostAuthor(authorFromPost(post));
    const params = new URLSearchParams();
    if (tab !== "public") {
      params.set("tab", tab);
    }
    params.set("postId", post.id);
    window.history.pushState({}, "", `/community?${params.toString()}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closePostDetail = () => {
    setSelectedPostId("");
    setSelectedPost(null);
    setSelectedPostAuthor(null);
    const url = activeTab === "public" ? "/community" : `/community?tab=${activeTab}`;
    window.history.pushState({}, "", url);
  };

  const handlePublicFilterSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPublicCursor("");
    void loadPublicPosts("reset");
  };

  const handleForumModeration = async (
    item: ForumPostResponse,
    action: ForumModerationAction
  ) => {
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
      setForumPosts((current) =>
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
      sonner.success("论坛治理操作已完成");
    } catch (error) {
      sonner.error("论坛治理失败", {
        description: error instanceof Error ? error.message : "请稍后重试。",
      });
    }
  };

  useEffect(() => {
    void loadPublicPosts("reset");
    // Initial public feed load is intentionally one-shot; append pagination
    // reads the latest cursor from the load-more handler.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedPostId && !selectedPost) {
      void loadSelectedPost(selectedPostId);
    }
  }, [loadSelectedPost, selectedPost, selectedPostId]);

  useEffect(() => {
    const syncRouteState = () => {
      const params = new URLSearchParams(window.location.search);
      const postId = params.get("postId")?.trim() ?? "";
      setSelectedPostId(postId);
      if (!postId) {
        setSelectedPost(null);
        setSelectedPostAuthor(null);
      }
    };
    window.addEventListener("popstate", syncRouteState);
    return () => window.removeEventListener("popstate", syncRouteState);
  }, []);

  useEffect(() => {
    fetchForumBoardList({ pageSize: 50 })
      .then((resp) => {
        setBoards(resp.list ?? []);
        if (!selectedBoardId && resp.list?.[0]?.id) {
          setSelectedBoardId(resp.list[0].id);
        }
      })
      .catch(() => undefined);
  }, [selectedBoardId]);

  useEffect(() => {
    if (activeTab === "followingPosts" && isAuthenticated && followingPosts.length === 0) {
      void loadFollowingPosts("reset");
    }
    if (activeTab === "followingMedia" && isAuthenticated && followingMedia.length === 0) {
      void loadFollowingMedia("reset");
    }
    if (activeTab === "forum" && boards.length > 0 && forumPosts.length === 0) {
      void loadForumPosts("reset", selectedBoardId);
    }
  }, [
    activeTab,
    boards.length,
    followingMedia.length,
    followingPosts.length,
    forumPosts.length,
    isAuthenticated,
    loadFollowingMedia,
    loadFollowingPosts,
    loadForumPosts,
    selectedBoardId,
  ]);

  const handleBoardChange = (boardId: string) => {
    setSelectedBoardId(boardId);
    setForumCursor("");
    setForumPosts([]);
    void loadForumPosts("reset", boardId);
  };

  const loginRequired = !isAuthenticated && activeTab !== "public" && activeTab !== "forum";

  return (
    <section className="min-h-screen bg-background pt-20">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-16 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3 border-b border-border pb-5">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Bell className="size-4" aria-hidden />
            社区
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-normal text-foreground">
                公开动态
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                查看当前公开权限的动态，按发布时间浏览创作者分享。
              </p>
            </div>
          </div>
        </header>

        <nav
          className="flex gap-1 overflow-x-auto border-b border-border"
          aria-label="社区导航"
        >
          {COMMUNITY_TABS.map((tab) => {
            const active = tab.key === activeTab;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                data-slot="interactive-surface"
                type="button"
                onClick={() => navigateTab(tab.key)}
                className={cn(
                  interactiveSurfaceClassName,
                  "inline-flex h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium",
                  active
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
                aria-pressed={active}
              >
                <Icon className="size-4" aria-hidden />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {selectedPostId ? (
          <div className="space-y-4">
            <Button type="button" variant="outline" onClick={closePostDetail}>
              <ArrowLeft className="size-4" aria-hidden />
              返回列表
            </Button>
            {detailLoading && !selectedPost ? (
              <div className="flex justify-center py-10 text-muted-foreground">
                <Loader2 className="size-5 animate-spin" aria-label="详情加载中" />
              </div>
            ) : selectedPost ? (
              <PostCard
                post={selectedPost}
                author={selectedPostAuthor}
                canManage={false}
                onUpdated={setSelectedPost}
              />
            ) : (
              <EmptyState
                title="未找到动态"
                description="这条内容可能已被删除或设置为不可见。"
              />
            )}
          </div>
        ) : loginRequired ? (
          <EmptyState
            title="请先登录"
            description="登录后可以查看你关注的创作者动态和作品。"
          />
        ) : activeTab === "public" ? (
          <div className="space-y-4">
            <form
              onSubmit={handlePublicFilterSubmit}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center"
              aria-label="公开动态筛选"
            >
              <label className="min-w-0 flex-1">
                <span className="sr-only">搜索动态</span>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <input
                    value={publicSearchText}
                    onChange={(event) => setPublicSearchText(event.target.value)}
                    placeholder="搜索公开动态"
                    className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-blue-500/20"
                    aria-label="搜索公开动态"
                  />
                </div>
              </label>
              <Select
                value={publicPostType}
                onValueChange={(nextValue) => {
                  if (nextValue) {
                    setPublicPostType(nextValue as PostTypeFilter);
                  }
                }}
              >
                <SelectTrigger
                  className="h-10 w-full rounded-md sm:w-36"
                  aria-label="动态类型筛选"
                >
                  <SelectValue placeholder="类型" />
                </SelectTrigger>
                <SelectContent
                  align="start"
                  alignItemWithTrigger={false}
                  className="z-[70]"
                >
                  {POST_TYPE_FILTER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={publicSort}
                onValueChange={(nextValue) => {
                  if (nextValue) {
                    setPublicSort(nextValue as PublicSort);
                  }
                }}
              >
                <SelectTrigger
                  className="h-10 w-full rounded-md sm:w-36"
                  aria-label="公开动态排序"
                >
                  <SelectValue placeholder="排序" />
                </SelectTrigger>
                <SelectContent
                  align="start"
                  alignItemWithTrigger={false}
                  className="z-[70]"
                >
                  {PUBLIC_SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" disabled={publicLoading}>
                {publicLoading ? <Loader2 className="size-4 animate-spin" /> : null}
                应用
              </Button>
            </form>
            <PostFeed
              posts={publicPosts}
              loading={publicLoading}
              hasMore={publicHasMore}
              onLoadMore={() => void loadPublicPosts("append")}
              onOpenDetail={(post) => openPostDetail(post, "public")}
            />
          </div>
        ) : activeTab === "followingPosts" ? (
          <PostFeed
            posts={followingPosts}
            loading={followingPostLoading}
            hasMore={followingPostHasMore}
            onLoadMore={() => void loadFollowingPosts("append")}
            onOpenDetail={(post) => openPostDetail(post, "followingPosts")}
          />
        ) : activeTab === "followingMedia" ? (
          <div className="discover-page">
            {followingMedia.length === 0 && !followingMediaLoading ? (
              <EmptyState
                title="还没有关注作品"
                description="关注一些创作者后，他们公开发布的作品会出现在这里。"
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {followingMedia.map((asset) => (
                  <div key={asset.id} className="aspect-[4/3] overflow-hidden rounded-md">
                    <DiscoverPictureCard picture={asset} />
                  </div>
                ))}
              </div>
            )}
            {followingMediaLoading ? (
              <div className="flex justify-center py-6 text-muted-foreground">
                <Loader2 className="size-5 animate-spin" aria-label="加载中" />
              </div>
            ) : null}
            {!followingMediaLoading && followingMediaHasMore ? (
              <div className="flex justify-center pt-5">
                <Button variant="outline" onClick={() => void loadFollowingMedia("append")}>
                  加载更多
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              {boards.map((board) => (
                <button
                  key={board.id}
                  data-slot="interactive-surface"
                  type="button"
                  onClick={() => handleBoardChange(board.id)}
                  className={cn(
                    interactiveSurfaceClassName,
                    "rounded-full border px-3 py-1.5 text-sm",
                    selectedBoard?.id === board.id
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  )}
                >
                  {board.name}
                </button>
              ))}
            </div>

            <ForumComposer
              boards={boards}
              selectedBoardId={selectedBoardId}
              isAuthenticated={isAuthenticated}
              onCreated={(post) => setForumPosts((current) => [post, ...current])}
            />

            {forumPosts.length === 0 && !forumLoading ? (
              <EmptyState
                title="还没有讨论"
                description="选择一个分区，发布第一条讨论。"
              />
            ) : (
              <div className="space-y-4">
                {forumPosts.map((item) => (
                  <article key={item.post.id} className="space-y-2">
                    <div className="rounded-lg border border-border bg-card px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{item.board.name}</span>
                            {item.isBoardPinned ? <span>分区置顶</span> : null}
                            {item.isLocked ? <span>已锁定</span> : null}
                          </div>
                          <h2 className="mt-1 text-base font-semibold text-foreground">
                            {item.title}
                          </h2>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openPostDetail(item.post, "forum")}
                          >
                            查看详情
                          </Button>
                          {isAdmin ? (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  void handleForumModeration(
                                    item,
                                    item.isLocked ? "unlock" : "lock"
                                  )
                                }
                              >
                                <ShieldCheck className="size-4" aria-hidden />
                                {item.isLocked ? "解锁帖子" : "锁定帖子"}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  void handleForumModeration(
                                    item,
                                    item.isBoardPinned ? "unpin" : "pin"
                                  )
                                }
                              >
                                {item.isBoardPinned ? "取消分区置顶" : "分区置顶"}
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <PostCard post={item.post} author={authorFromPost(item.post)} />
                  </article>
                ))}
              </div>
            )}

            {forumLoading ? (
              <div className="flex justify-center py-6 text-muted-foreground">
                <Loader2 className="size-5 animate-spin" aria-label="加载中" />
              </div>
            ) : null}
            {!forumLoading && forumHasMore ? (
              <div className="flex justify-center pt-2">
                <Button variant="outline" onClick={() => void loadForumPosts("append")}>
                  加载更多
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
