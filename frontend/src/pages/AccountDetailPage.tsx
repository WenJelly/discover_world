import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast as sonner } from "sonner";
import {
  ArrowUp,
  BadgeCheck,
  BookOpen,
  CalendarDays,
  Camera,
  Check,
  Heart,
  ImageIcon,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";

import {
  ApiError,
  deleteMediaAsset,
  fetchMediaAssetCursorList,
  fetchProfileAlbumList,
  fetchProfileFeaturedMediaList,
  fetchProfilePostCursorList,
  fetchFollowerList,
  fetchFollowingList,
  fetchUserProfile,
  followUser,
  unfollowUser,
  updateProfileFeaturedMedia,
} from "@/lib/api";
import {
  toAccountProfile,
  toImageItem,
} from "@/lib/account-profile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { ImagePreviewModal } from "@/components/ImagePreviewModal";
import { MediaPickerDialog } from "@/components/admin/MediaPickerDialog";
import { UploadDialog } from "@/components/upload/UploadDialog";
import { PostTimeline } from "@/components/post/PostTimeline";
import {
  PostComposerDialog,
  type PostAuthor,
} from "@/components/post/PostComposerDialog";
import {
  formatCount,
  formatDate,
  getAvatarFallback,
  getMediaUrl,
} from "@/lib/format";
import { isForceDeleteMediaConflict } from "@/lib/api-error";
import type {
  ImageItem,
  AccountSummary,
  MediaAssetResponse,
  ProfileAlbumResponse,
  ProfilePostResponse,
  UserProfile,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type AccountTab = "posts" | "pictures" | "featured" | "albums";
type FollowListKind = "followers" | "following";
type DeleteConfirmation = {
  imageId: string;
  mode: "standard" | "force";
  message?: string;
};

const TAB_ITEMS: Array<{ id: AccountTab; label: string; icon: typeof Camera }> = [
  { id: "posts", label: "动态", icon: MessageCircle },
  { id: "pictures", label: "作品", icon: Camera },
  { id: "featured", label: "精选", icon: Sparkles },
  { id: "albums", label: "相册", icon: BookOpen },
];

const POST_PAGE_SIZE = 10;
const PICTURES_PAGE_SIZE = 20;
const MAX_FEATURED_COUNT = 20;
const ALBUM_PAGE_SIZE = 12;

type LoadPostsOptions = {
  silent?: boolean;
};

function getImageUrl(image: ImageItem) {
  return image.url;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function readAccountTargetUserId() {
  return new URLSearchParams(window.location.search).get("userId")?.trim() ?? "";
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-border bg-card p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <ImageIcon className="size-6" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-foreground">
        {title}
      </h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

function LoadingBlock() {
  return (
    <div className="flex min-h-64 items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function FollowListDialog({
  open,
  onOpenChange,
  targetUserId,
  kind,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId: string;
  kind: FollowListKind;
}) {
  const [users, setUsers] = useState<AccountSummary[]>([]);
  const [cursor, setCursor] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const title = kind === "followers" ? "粉丝列表" : "关注列表";

  const load = useCallback(
    async (mode: "reset" | "append" = "reset") => {
      if (!targetUserId) return;
      setLoading(true);
      try {
        const page =
          kind === "followers"
            ? await fetchFollowerList({
                targetUserId,
                cursor: mode === "append" ? cursor : "",
                pageSize: 20,
              })
            : await fetchFollowingList({
                targetUserId,
                cursor: mode === "append" ? cursor : "",
                pageSize: 20,
              });
        setUsers((current) =>
          mode === "append" ? [...current, ...page.list] : page.list
        );
        setCursor(page.nextCursor);
        setHasMore(page.hasMore);
      } finally {
        setLoading(false);
      }
    },
    [cursor, kind, targetUserId]
  );

  useEffect(() => {
    if (!open) return;
    setCursor("");
    void load("reset");
    // Reset load should run only when the dialog target changes.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, open, targetUserId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            查看这个账户的{kind === "followers" ? "粉丝" : "关注"}用户。
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[24rem] space-y-2 overflow-y-auto">
          {loading && users.length === 0 ? (
            <div className="flex justify-center py-8 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" aria-label="加载中" />
            </div>
          ) : users.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
              暂无用户
            </p>
          ) : (
            users.map((item) => (
              <button
                key={item.id}
                type="button"
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-blue-500/20"
                onClick={() => {
                  window.history.pushState({}, "", `/account?userId=${item.id}`);
                  window.dispatchEvent(new Event("popstate"));
                  onOpenChange(false);
                }}
              >
                <Avatar className="size-9">
                  {item.avatarUrl ? (
                    <AvatarImage src={item.avatarUrl} alt={item.nickname || item.username} />
                  ) : null}
                  <AvatarFallback>
                    {getAvatarFallback(item.nickname || item.username || "用户")}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {item.nickname || item.username || "用户"}
                  </span>
                  {item.username ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      @{item.username}
                    </span>
                  ) : null}
                </span>
              </button>
            ))
          )}
        </div>
        {hasMore ? (
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => void load("append")}
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : null}
              加载更多
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AlbumManagerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>相册管理</DialogTitle>
          <DialogDescription>
            后端相册管理接口尚未开放，当前只能读取相册列表。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 sm:grid-cols-2">
          {["创建相册", "编辑相册", "删除相册", "添加作品"].map((label) => (
            <Button key={label} type="button" variant="outline" disabled>
              {label}
            </Button>
          ))}
        </div>
        <p className="rounded-lg bg-muted px-3 py-2 text-sm leading-6 text-muted-foreground">
          需要后端补充创建相册、编辑相册、删除相册、维护相册作品的接口后，这里即可接入真实保存。
        </p>
      </DialogContent>
    </Dialog>
  );
}

export default function AccountDetailPage() {
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<AccountTab>("posts");
  const [targetUserId, setTargetUserId] = useState(() => readAccountTargetUserId());
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [followPending, setFollowPending] = useState(false);

  // Preview state
  const [previewImage, setPreviewImage] = useState<ImageItem | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number>(-1);
  const [deleteConfirmation, setDeleteConfirmation] =
    useState<DeleteConfirmation | null>(null);
  const [deletingImage, setDeletingImage] = useState(false);

  // New post dialog state
  const [showNewPostDialog, setShowNewPostDialog] = useState(false);

  // Pictures state
  const [pictures, setPictures] = useState<ImageItem[]>([]);
  const [picturesLoading, setPicturesLoading] = useState(false);
  const [picturesLoadingMore, setPicturesLoadingMore] = useState(false);
  const [picturesError, setPicturesError] = useState<string | null>(null);
  const [picturesHasMore, setPicturesHasMore] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const picturesCursorRef = useRef("");

  // Featured state
  const [featuredAssets, setFeaturedAssets] = useState<MediaAssetResponse[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(false);
  const [featuredError, setFeaturedError] = useState<string | null>(null);
  const [showFeaturedPicker, setShowFeaturedPicker] = useState(false);

  // Posts state
  const [posts, setPosts] = useState<ProfilePostResponse[]>([]);
  const [postLoading, setPostLoading] = useState(false);
  const [postLoadingMore, setPostLoadingMore] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [postHasMore, setPostHasMore] = useState(false);
  const postCursorRef = useRef("");
  const pendingPublishedPostIdRef = useRef<string | null>(null);

  // Albums state
  const [albums, setAlbums] = useState<ProfileAlbumResponse[]>([]);
  const [albumLoading, setAlbumLoading] = useState(false);
  const [albumError, setAlbumError] = useState<string | null>(null);
  const [followListKind, setFollowListKind] =
    useState<FollowListKind | null>(null);
  const [albumManagerOpen, setAlbumManagerOpen] = useState(false);

  const ownerId = targetUserId || user?.id;
  const isOwnProfile = Boolean(user?.id && ownerId === user.id);
  const featuredImages = useMemo(
    () => featuredAssets.map(toImageItem),
    [featuredAssets]
  );

  const scrollPostIntoView = useCallback((postId: string) => {
    window.requestAnimationFrame(() => {
      const target = Array.from(
        document.querySelectorAll<HTMLElement>("[data-post-id]")
      ).find((element) => element.dataset.postId === postId);

      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, []);

  useEffect(() => {
    const syncTargetUserId = () => {
      setTargetUserId(readAccountTargetUserId());
    };

    window.addEventListener("popstate", syncTargetUserId);
    return () => window.removeEventListener("popstate", syncTargetUserId);
  }, []);

  const loadProfile = useCallback(async () => {
    if (!isAuthenticated || !ownerId) {
      setProfile(null);
      setProfileError(null);
      return;
    }

    setProfileLoading(true);
    setProfileError(null);
    try {
      const detail = await fetchUserProfile({ id: ownerId });
      setProfile(toAccountProfile(detail));
    } catch (error) {
      setProfileError(errorMessage(error, "个人信息加载失败"));
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, [isAuthenticated, ownerId]);

  const loadPictures = useCallback(
    async (reset = false) => {
      if (!isAuthenticated || !ownerId) {
        setPictures([]);
        setPicturesError(null);
        setPicturesHasMore(false);
        picturesCursorRef.current = "";
        return;
      }

      if (reset) {
        picturesCursorRef.current = "";
        setPicturesLoading(true);
      } else {
        setPicturesLoadingMore(true);
      }
      setPicturesError(null);

      try {
        const resp = await fetchMediaAssetCursorList({
          ownerUserId: ownerId,
          cursor: reset ? undefined : picturesCursorRef.current || undefined,
          pageSize: PICTURES_PAGE_SIZE,
          variantOption: { compressType: 2 },
        });
        picturesCursorRef.current = resp.nextCursor || "";
        setPicturesHasMore(resp.hasMore && Boolean(resp.nextCursor));
        setPictures((current) =>
          reset ? resp.list.map(toImageItem) : [...current, ...resp.list.map(toImageItem)]
        );
      } catch (error) {
        setPicturesError(errorMessage(error, "作品加载失败"));
        if (reset) {
          setPictures([]);
          setPicturesHasMore(false);
        }
      } finally {
        setPicturesLoading(false);
        setPicturesLoadingMore(false);
      }
    },
    [isAuthenticated, ownerId]
  );

  const loadFeatured = useCallback(async () => {
    if (!isAuthenticated || !ownerId) {
      setFeaturedAssets([]);
      setFeaturedError(null);
      return;
    }

    setFeaturedLoading(true);
    setFeaturedError(null);
    try {
      const resp = await fetchProfileFeaturedMediaList({
        userId: ownerId,
        pageSize: MAX_FEATURED_COUNT,
        variantOption: { compressType: 2 },
      });
      setFeaturedAssets(resp.list);
    } catch (error) {
      setFeaturedError(errorMessage(error, "精选图片加载失败"));
      setFeaturedAssets([]);
    } finally {
      setFeaturedLoading(false);
    }
  }, [isAuthenticated, ownerId]);

  const loadPosts = useCallback(
    async (reset = false, options: LoadPostsOptions = {}) => {
      if (!isAuthenticated || !ownerId) {
        setPosts([]);
        setPostError(null);
        setPostHasMore(false);
        postCursorRef.current = "";
        return;
      }

      if (reset) {
        postCursorRef.current = "";
      }
      if (reset && !options.silent) {
        setPostLoading(true);
      } else if (!reset) {
        setPostLoadingMore(true);
      }
      setPostError(null);

      try {
        const resp = await fetchProfilePostCursorList({
          userId: ownerId,
          cursor: reset ? undefined : postCursorRef.current || undefined,
          pageSize: POST_PAGE_SIZE,
        });
        postCursorRef.current = resp.nextCursor;
        setPostHasMore(resp.hasMore && Boolean(resp.nextCursor));
        setPosts((current) => (reset ? resp.list : [...current, ...resp.list]));
      } catch (error) {
        setPostError(errorMessage(error, "动态加载失败"));
        if (reset && !options.silent) {
          setPosts([]);
          setPostHasMore(false);
        }
      } finally {
        setPostLoading(false);
        setPostLoadingMore(false);
      }
    },
    [isAuthenticated, ownerId]
  );

  const loadAlbums = useCallback(async () => {
    if (!isAuthenticated || !ownerId) {
      setAlbums([]);
      setAlbumError(null);
      return;
    }

    setAlbumLoading(true);
    setAlbumError(null);
    try {
      const resp = await fetchProfileAlbumList({
        userId: ownerId,
        pageNum: 1,
        pageSize: ALBUM_PAGE_SIZE,
      });
      setAlbums(resp.list);
    } catch (error) {
      setAlbumError(errorMessage(error, "相册加载失败"));
      setAlbums([]);
    } finally {
      setAlbumLoading(false);
    }
  }, [isAuthenticated, ownerId]);

  useEffect(() => {
    void loadProfile();
    void loadPictures(true);
    void loadFeatured();
    void loadPosts(true);
    void loadAlbums();
  }, [loadAlbums, loadFeatured, loadPictures, loadPosts, loadProfile]);

  useEffect(() => {
    const postId = pendingPublishedPostIdRef.current;
    if (!postId || !posts.some((post) => post.id === postId)) {
      return;
    }

    pendingPublishedPostIdRef.current = null;
    scrollPostIntoView(postId);
  }, [posts, scrollPostIntoView]);

  // Reload profile when user changes (e.g., avatar upload)
  useEffect(() => {
    if (isAuthenticated && isOwnProfile && ownerId) {
      void loadProfile();
    }
  }, [user?.userAvatar, isAuthenticated, isOwnProfile, ownerId, loadProfile]);

  const stats = useMemo(() => {
    if (!profile) return [];
    return [
      { label: "作品", value: profile.imageCount },
      { label: "粉丝", value: profile.followers },
      { label: "关注", value: profile.following },
    ];
  }, [profile]);

  const handleToggleProfileFollow = useCallback(async () => {
    if (!profile || isOwnProfile || followPending) return;

    const previous = profile;
    const nextFollowing = !profile.isFollowing;
    setFollowPending(true);
    setProfile((current) =>
      current
        ? {
            ...current,
            isFollowing: nextFollowing,
            followers: Math.max(0, current.followers + (nextFollowing ? 1 : -1)),
          }
        : current
    );

    try {
      const status = nextFollowing
        ? await followUser({ targetUserId: profile.id })
        : await unfollowUser({ targetUserId: profile.id });
      setProfile((current) =>
        current
          ? {
              ...current,
              isFollowing: status.isFollowing,
              followers: status.followerCount,
              following: status.followingCount,
            }
          : current
      );
    } catch (error) {
      setProfile(previous);
      sonner.error(nextFollowing ? "关注失败" : "取消关注失败", {
        description: errorMessage(error, "请稍后重试。"),
      });
    } finally {
      setFollowPending(false);
    }
  }, [followPending, isOwnProfile, profile]);

  const openFollowList = (kind: FollowListKind) => {
    setFollowListKind(kind);
  };

  const handleImageClick = (image: ImageItem, index: number) => {
    setPreviewImage(image);
    setPreviewIndex(index);
  };

  const handleClosePreview = () => {
    setPreviewImage(null);
    setPreviewIndex(-1);
  };

  const handlePreviousImage = () => {
    if (previewIndex <= 0) return;
    const newIndex = previewIndex - 1;
    const currentList = activeTab === "pictures" ? pictures : featuredImages;
    setPreviewIndex(newIndex);
    setPreviewImage(currentList[newIndex]);
  };

  const handleNextImage = () => {
    const currentList = activeTab === "pictures" ? pictures : featuredImages;
    if (previewIndex >= currentList.length - 1) return;
    const newIndex = previewIndex + 1;
    setPreviewIndex(newIndex);
    setPreviewImage(currentList[newIndex]);
  };

  const removeDeletedImageFromState = (imageId: string) => {
    setPictures((prev) => prev.filter((img) => img.id !== imageId));
    setFeaturedAssets((prev) => prev.filter((asset) => asset.id !== imageId));
    handleClosePreview();
  };

  const requestDeleteImage = (imageId: string) => {
    setDeleteConfirmation({ imageId, mode: "standard" });
  };

  const closeDeleteConfirmation = () => {
    if (!deletingImage) {
      setDeleteConfirmation(null);
    }
  };

  const handleDeleteImage = async () => {
    const confirmation = deleteConfirmation;
    if (!confirmation) {
      return;
    }

    setDeletingImage(true);
    try {
      await deleteMediaAsset(
        confirmation.imageId,
        confirmation.mode === "force" ? { force: true } : undefined
      );
      removeDeletedImageFromState(confirmation.imageId);
      setDeleteConfirmation(null);
      sonner.success("图片已删除");
    } catch (error) {
      if (
        confirmation.mode === "standard" &&
        error instanceof ApiError &&
        isForceDeleteMediaConflict(error.code, error.message)
      ) {
        setDeleteConfirmation({
          imageId: confirmation.imageId,
          mode: "force",
          message: error.message,
        });
        return;
      }
      sonner.error("删除失败", {
        description: errorMessage(error, "请稍后重试。"),
      });
    } finally {
      setDeletingImage(false);
    }
  };

  const handleEditImage = async (imageId: string) => {
    // TODO: Implement edit functionality
    console.log("Edit image:", imageId);
    handleClosePreview();
  };

  const handleNewPost = () => {
    setShowNewPostDialog(true);
  };

  const handleFeaturedConfirm = async (assets: MediaAssetResponse[]) => {
    try {
      await updateProfileFeaturedMedia({
        mediaAssetIds: assets.map((asset) => asset.id),
      });
      await loadFeatured();
      sonner.success("精选已更新", {
        description: `个人主页已展示 ${assets.length} 张精选作品。`,
      });
    } catch (error) {
      sonner.error("精选保存失败", {
        description: errorMessage(error, "请稍后重试。"),
      });
      return false;
    }
  };

  const handleProfileUploadComplete = () => {
    void loadPictures(true);
    void loadProfile();
  };

  const handlePostPublished = (post: ProfilePostResponse) => {
    pendingPublishedPostIdRef.current = post.id;
    setActiveTab("posts");
    void loadPosts(true, { silent: true });
  };

  const handlePostDeleted = (id: string) => {
    setPosts((prev) => prev.filter((post) => post.id !== id));
  };

  const handlePostUpdated = (post: ProfilePostResponse) => {
    setPosts((prev) => prev.map((item) => (item.id === post.id ? post : item)));
  };

  const handlePostPinChanged = (post: ProfilePostResponse) => {
    setPosts((prev) => prev.map((item) => (item.id === post.id ? post : item)));
    void loadPosts(true, { silent: true });
  };

  const postAuthor: PostAuthor | null = profile
    ? {
        username: profile.username,
        avatarUrl: profile.avatarUrl,
        handle: profile.handle,
      }
    : null;

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center bg-background px-4">
        <div className="text-center">
          <UserRound className="mx-auto size-12 text-muted-foreground/60" />
          <h1 className="mt-4 text-xl font-semibold text-foreground">
            需要登录
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            登录后可以查看个人主页
          </p>
        </div>
      </div>
    );
  }

  if (profileLoading && !profile) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center bg-background">
        <LoadingBlock />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center bg-background px-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-foreground">
            加载失败
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {profileError ?? "请稍后重试"}
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() => void loadProfile()}
          >
            <RefreshCw className="size-4" />
            重试
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Profile Header */}
      <div className="border-b border-border">
        {/* Profile Info */}
        <div className="mx-auto flex min-h-[24rem] max-w-3xl items-end px-4 sm:min-h-[26rem] sm:px-6">
          <div className="relative w-full">
            {/* Avatar */}
            <div className="absolute -top-12 sm:-top-14">
              <Avatar className="size-24 border-4 border-background shadow-sm ring-1 ring-border sm:size-28">
                {profile.avatarUrl ? (
                  <AvatarImage src={profile.avatarUrl} alt={profile.username} />
                ) : null}
                <AvatarFallback className="text-xl font-bold text-foreground sm:text-2xl">
                  {getAvatarFallback(profile.username)}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* Profile Details */}
            <div className="pb-3 pt-14 sm:pt-16">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <h1 className="flex min-w-0 items-center gap-1.5 text-xl font-bold text-foreground">
                    {profile.username}
                    {profile.role === "admin" ? (
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-yellow-500">
                        <BadgeCheck
                          aria-label="管理员认证"
                          role="img"
                          className="size-[18px] fill-yellow-500/20"
                          strokeWidth={2.4}
                        />
                        <span>管理员</span>
                      </span>
                    ) : null}
                  </h1>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {profile.handle}
                  </p>
                  {profile.bio ? (
                    <p className="mt-3 text-[15px] leading-relaxed text-foreground/80">
                      {profile.bio}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    {profile.location ? (
                      <span className="inline-flex items-center gap-1">
                        <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {profile.location}
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="size-4" />
                      {formatDate(profile.joinedAt)} 加入
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-5 text-sm">
                    {stats.map((stat) => (
                      <button
                        key={stat.label}
                        type="button"
                        disabled={stat.label === "作品"}
                        onClick={() =>
                          stat.label === "粉丝"
                            ? openFollowList("followers")
                            : stat.label === "关注"
                              ? openFollowList("following")
                              : undefined
                        }
                        className="rounded-md text-left transition-colors enabled:hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-blue-500/20 disabled:cursor-default"
                      >
                        <span className="font-semibold text-foreground">
                          {formatCount(stat.value)}
                        </span>{" "}
                        <span className="text-muted-foreground">{stat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {!isOwnProfile ? (
                  <Button
                    type="button"
                    variant={profile.isFollowing ? "outline" : "default"}
                    className="w-24 shrink-0"
                    disabled={followPending}
                    onClick={() => void handleToggleProfileFollow()}
                  >
                    {followPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    {profile.isFollowing && !followPending ? (
                      <Check className="size-4" aria-hidden="true" />
                    ) : null}
                    {profile.isFollowing ? "已关注" : "关注"}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="flex gap-8 border-b border-border">
            {TAB_ITEMS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "group relative flex items-center gap-2 px-1 py-3 text-[15px] font-medium transition-colors",
                    activeTab === tab.id
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="size-[18px]" strokeWidth={2} />
                  {tab.label}
                  {activeTab === tab.id ? (
                    <div className="absolute bottom-0 left-0 right-0 h-[3px] rounded-full bg-foreground" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
        {activeTab === "posts" ? (
          <>
            {isOwnProfile ? (
              <div
                className="mb-6 flex justify-end pr-3 sm:pr-4"
                data-testid="profile-post-composer-entry"
              >
                <Button
                  type="button"
                  size="lg"
                  className="rounded-full px-5"
                  aria-label="打开发布动态面板"
                  onClick={handleNewPost}
                >
                  有什么新鲜事?
                </Button>
              </div>
            ) : null}

            {postLoading ? (
              <LoadingBlock />
            ) : postError && posts.length === 0 ? (
              <EmptyState title="动态加载失败" description={postError} />
            ) : posts.length === 0 ? (
              <EmptyState title="暂无动态" description="发布的动态会展示在这里" />
            ) : (
              <div className="space-y-4">
                <PostTimeline
                  posts={posts}
                  author={postAuthor}
                  canManage={isOwnProfile}
                  onDeleted={handlePostDeleted}
                  onUpdated={handlePostUpdated}
                  onPinChanged={handlePostPinChanged}
                />
              {postError ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  {postError}
                </div>
              ) : null}
              {postHasMore ? (
                <div className="flex justify-center pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={postLoadingMore}
                    onClick={() => void loadPosts(false)}
                  >
                    {postLoadingMore ? <Loader2 className="size-4 animate-spin" /> : null}
                    加载更多
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </>
        ) : activeTab === "pictures" ? (
          <div className="space-y-4">
            {isOwnProfile && !picturesLoading && pictures.length > 0 ? (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowUploadDialog(true)}
                >
                  <Upload className="size-4" />
                  上传作品
                </Button>
              </div>
            ) : null}
            {picturesLoading ? (
              <LoadingBlock />
            ) : picturesError && pictures.length === 0 ? (
              <EmptyState title="作品加载失败" description={picturesError} />
            ) : pictures.length === 0 ? (
              <EmptyState
                title="暂无作品"
                description="上传的作品会展示在这里"
                action={
                  isOwnProfile ? (
                    <Button
                      type="button"
                      onClick={() => setShowUploadDialog(true)}
                    >
                      <Upload className="size-4" />
                      上传作品
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {pictures.map((image, index) => (
                  <article
                    key={image.id}
                    className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg bg-muted"
                    onClick={() => handleImageClick(image, index)}
                  >
                    <img
                      src={getImageUrl(image)}
                      alt={image.title}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                    <div className="absolute inset-x-0 bottom-0 translate-y-2 p-3 text-white opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
                      <div className="text-sm font-medium line-clamp-1">{image.title}</div>
                      <div className="mt-1 flex items-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-1">
                          <Heart className="size-3" />
                          {formatCount(image.likes)}
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              {picturesError ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  {picturesError}
                </div>
              ) : null}
              {picturesHasMore ? (
                <div className="flex justify-center pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={picturesLoadingMore}
                    onClick={() => void loadPictures(false)}
                  >
                    {picturesLoadingMore ? <Loader2 className="size-4 animate-spin" /> : null}
                    加载更多
                  </Button>
                </div>
              ) : null}
            </div>
            )}
          </div>
        ) : activeTab === "featured" ? (
          <div className="space-y-4">
            {isOwnProfile && !featuredLoading && featuredImages.length > 0 ? (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFeaturedPicker(true)}
                >
                  <Settings2 className="size-4" />
                  管理精选
                </Button>
              </div>
            ) : null}
            {featuredLoading ? (
            <LoadingBlock />
          ) : featuredError ? (
            <EmptyState title="精选图片加载失败" description={featuredError} />
          ) : featuredImages.length === 0 ? (
            <EmptyState
              title="暂无精选图片"
              description={
                isOwnProfile
                  ? "从你的作品中挑选精选，展示在这里"
                  : "设置精选后会展示在这里"
              }
              action={
                isOwnProfile ? (
                  <Button
                    type="button"
                    onClick={() => setShowFeaturedPicker(true)}
                  >
                    <Sparkles className="size-4" />
                    去挑选作品
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {featuredImages.map((image, index) => (
                <article
                  key={image.id}
                  className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg bg-muted"
                  onClick={() => handleImageClick(image, index)}
                >
                  <img
                    src={getImageUrl(image)}
                    alt={image.title}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  <div className="absolute inset-x-0 bottom-0 translate-y-2 p-3 text-white opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
                    <div className="text-sm font-medium line-clamp-1">{image.title}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs">
                      <span className="inline-flex items-center gap-1">
                        <Heart className="size-3" />
                        {formatCount(image.likes)}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          </div>
        ) : (
          <div className="space-y-4">
            {isOwnProfile ? (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAlbumManagerOpen(true)}
                >
                  <Plus className="size-4" />
                  管理相册
                </Button>
              </div>
            ) : null}
            {albumLoading ? (
              <LoadingBlock />
            ) : albumError ? (
              <EmptyState title="相册加载失败" description={albumError} />
            ) : albums.length === 0 ? (
              <EmptyState
                title="暂无相册"
                description="创建的相册会展示在这里"
                action={
                  isOwnProfile ? (
                    <Button type="button" onClick={() => setAlbumManagerOpen(true)}>
                      <Plus className="size-4" />
                      创建相册
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {albums.map((album) => {
                  const coverUrl = getMediaUrl(album.cover);
                  return (
                    <article
                      key={album.id}
                      className="overflow-hidden rounded-lg border border-border bg-card"
                    >
                      <div className="aspect-video bg-muted">
                        {coverUrl ? (
                          <img
                            src={coverUrl}
                            alt={album.name}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-muted-foreground">
                            <BookOpen className="size-8" />
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <h3 className="font-semibold text-foreground line-clamp-1">
                          {album.name}
                        </h3>
                        {album.description ? (
                          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                            {album.description}
                          </p>
                        ) : null}
                        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
                          <span>{formatCount(album.itemCount)} 张</span>
                          <span>{formatDate(album.updatedAt)}</span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Scroll to top */}
      <div className="mx-auto max-w-3xl px-4 pb-12 sm:px-6">
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            <ArrowUp className="size-4" />
            返回顶部
          </Button>
        </div>
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <ImagePreviewModal
          image={previewImage}
          isOpen={!!previewImage}
          onClose={handleClosePreview}
          onPrevious={previewIndex > 0 ? handlePreviousImage : undefined}
          onNext={
            previewIndex <
            (activeTab === "pictures" ? pictures : featuredImages).length - 1
              ? handleNextImage
              : undefined
          }
          showUserInfo={false}
          actions={
            isOwnProfile ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleEditImage(previewImage.id)}
                className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                aria-label="编辑图片"
              >
                <Pencil size={18} aria-hidden="true" />
                编辑
              </button>
              <button
                type="button"
                onClick={() => requestDeleteImage(previewImage.id)}
                className="inline-flex items-center gap-2 rounded-lg border border-red-500/50 px-4 py-2.5 text-sm font-medium text-red-400 backdrop-blur-sm transition-colors hover:bg-red-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
                aria-label="删除图片"
              >
                <Trash2 size={18} aria-hidden="true" />
                删除
              </button>
            </div>
            ) : null
          }
        />
      )}

      <Dialog
        open={Boolean(deleteConfirmation)}
        onOpenChange={(open) => {
          if (!open) {
            closeDeleteConfirmation();
          }
        }}
      >
        <DialogContent
          className="max-w-md rounded-xl border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
          showCloseButton={!deletingImage}
        >
          <DialogHeader>
            <DialogTitle>删除图片</DialogTitle>
            <DialogDescription>
              {deleteConfirmation?.mode === "force"
                ? deleteConfirmation.message
                : "此操作无法撤销。删除后，这张图片会从你的作品和精选中移除。"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={deletingImage}
              onClick={closeDeleteConfirmation}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deletingImage}
              onClick={() => void handleDeleteImage()}
            >
              {deletingImage ? <Loader2 className="size-4 animate-spin" /> : null}
              {deleteConfirmation?.mode === "force" ? "继续删除" : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isOwnProfile ? (
        <>
          <MediaPickerDialog
            open={showFeaturedPicker}
            onOpenChange={setShowFeaturedPicker}
            mode="multiple"
            title="管理精选"
            description="从你已发布的公开作品中挑选精选，最多 20 张；取消勾选即可移除。"
            ownerUserId={user?.id}
            initialSelected={featuredAssets}
            maxCount={MAX_FEATURED_COUNT}
            confirmLabel="保存精选"
            onConfirm={handleFeaturedConfirm}
          />
          <UploadDialog
            open={showUploadDialog}
            onOpenChange={setShowUploadDialog}
            onUploaded={handleProfileUploadComplete}
          />
          <AlbumManagerDialog
            open={albumManagerOpen}
            onOpenChange={setAlbumManagerOpen}
          />
        </>
      ) : null}

      {followListKind ? (
        <FollowListDialog
          open={Boolean(followListKind)}
          onOpenChange={(open) => {
            if (!open) {
              setFollowListKind(null);
            }
          }}
          targetUserId={ownerId ?? ""}
          kind={followListKind}
        />
      ) : null}

      {/* New Post Dialog */}
      <PostComposerDialog
        open={showNewPostDialog}
        onOpenChange={setShowNewPostDialog}
        onPublished={handlePostPublished}
        author={postAuthor}
      />
    </div>
  );
}
