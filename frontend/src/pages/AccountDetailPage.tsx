import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowUp,
  BadgeCheck,
  BookOpen,
  CalendarDays,
  Camera,
  Heart,
  ImageIcon,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";

import {
  ApiError,
  deleteMediaAsset,
  fetchMediaAssetCursorList,
  fetchProfileAlbumList,
  fetchProfileFeaturedMediaList,
  fetchProfilePostCursorList,
  fetchUserProfile,
} from "@/lib/api";
import {
  toAccountProfile,
  toImageItem,
} from "@/lib/account-profile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { ImagePreviewModal } from "@/components/ImagePreviewModal";
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
  ProfileAlbumResponse,
  ProfilePostResponse,
  UserProfile,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type AccountTab = "posts" | "pictures" | "featured" | "albums";

const TAB_ITEMS: Array<{ id: AccountTab; label: string; icon: typeof Camera }> = [
  { id: "posts", label: "动态", icon: MessageCircle },
  { id: "pictures", label: "作品", icon: Camera },
  { id: "featured", label: "精选", icon: Sparkles },
  { id: "albums", label: "相册", icon: BookOpen },
];

const POST_PAGE_SIZE = 10;
const PICTURES_PAGE_SIZE = 20;
const FEATURED_PAGE_SIZE = 12;
const ALBUM_PAGE_SIZE = 12;

function getImageUrl(image: ImageItem) {
  return image.url;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function readAccountTargetUserId() {
  return new URLSearchParams(window.location.search).get("userId")?.trim() ?? "";
}

function EmptyState({ title, description }: { title: string; description: string }) {
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

export default function AccountDetailPage() {
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<AccountTab>("posts");
  const [targetUserId, setTargetUserId] = useState(() => readAccountTargetUserId());
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Preview state
  const [previewImage, setPreviewImage] = useState<ImageItem | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number>(-1);

  // New post dialog state
  const [showNewPostDialog, setShowNewPostDialog] = useState(false);

  // Pictures state
  const [pictures, setPictures] = useState<ImageItem[]>([]);
  const [picturesLoading, setPicturesLoading] = useState(false);
  const [picturesLoadingMore, setPicturesLoadingMore] = useState(false);
  const [picturesError, setPicturesError] = useState<string | null>(null);
  const [picturesHasMore, setPicturesHasMore] = useState(false);
  const picturesCursorRef = useRef("");

  // Featured state
  const [featuredImages, setFeaturedImages] = useState<ImageItem[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(false);
  const [featuredError, setFeaturedError] = useState<string | null>(null);

  // Posts state
  const [posts, setPosts] = useState<ProfilePostResponse[]>([]);
  const [postLoading, setPostLoading] = useState(false);
  const [postLoadingMore, setPostLoadingMore] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [postHasMore, setPostHasMore] = useState(false);
  const postCursorRef = useRef("");

  // Albums state
  const [albums, setAlbums] = useState<ProfileAlbumResponse[]>([]);
  const [albumLoading, setAlbumLoading] = useState(false);
  const [albumError, setAlbumError] = useState<string | null>(null);

  const ownerId = targetUserId || user?.id;
  const isOwnProfile = Boolean(user?.id && ownerId === user.id);

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
          auditStatus: undefined, // Load all statuses for owner
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
      setFeaturedImages([]);
      setFeaturedError(null);
      return;
    }

    setFeaturedLoading(true);
    setFeaturedError(null);
    try {
      const resp = await fetchProfileFeaturedMediaList({
        userId: ownerId,
        pageSize: FEATURED_PAGE_SIZE,
        variantOption: { compressType: 2 },
      });
      setFeaturedImages(resp.list.map(toImageItem));
    } catch (error) {
      setFeaturedError(errorMessage(error, "精选图片加载失败"));
      setFeaturedImages([]);
    } finally {
      setFeaturedLoading(false);
    }
  }, [isAuthenticated, ownerId]);

  const loadPosts = useCallback(
    async (reset = false) => {
      if (!isAuthenticated || !ownerId) {
        setPosts([]);
        setPostError(null);
        setPostHasMore(false);
        postCursorRef.current = "";
        return;
      }

      if (reset) {
        postCursorRef.current = "";
        setPostLoading(true);
      } else {
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
        if (reset) {
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
      { label: "精选", value: featuredImages.length },
      { label: "相册", value: albums.length },
    ];
  }, [profile, featuredImages.length, albums.length]);

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
    setFeaturedImages((prev) => prev.filter((img) => img.id !== imageId));
    handleClosePreview();
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!window.confirm("确定要删除这张图片吗？此操作无法撤销。")) {
      return;
    }

    try {
      await deleteMediaAsset(imageId);
      removeDeletedImageFromState(imageId);
      console.log("图片删除成功");
    } catch (error) {
      if (
        error instanceof ApiError &&
        isForceDeleteMediaConflict(error.code, error.message)
      ) {
        if (!window.confirm(error.message)) {
          return;
        }
        try {
          await deleteMediaAsset(imageId, { force: true });
          removeDeletedImageFromState(imageId);
          console.log("图片删除成功");
        } catch (forceError) {
          console.error("删除失败:", forceError);
          alert(`删除失败: ${forceError instanceof ApiError ? forceError.message : "未知错误"}`);
        }
        return;
      }
      console.error("删除失败:", error);
      alert(`删除失败: ${error instanceof ApiError ? error.message : "未知错误"}`);
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

  const handlePostPublished = (post: ProfilePostResponse) => {
    setPosts((prev) => [post, ...prev]);
  };

  const handlePostDeleted = (id: string) => {
    setPosts((prev) => prev.filter((post) => post.id !== id));
  };

  const handlePostUpdated = (post: ProfilePostResponse) => {
    setPosts((prev) => prev.map((item) => (item.id === post.id ? post : item)));
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
      {/* Hero Section */}
      <div className="border-b border-border">
        {/* Cover — calm, structural neutral contour. No brand gradient. */}
        <div className="profile-cover h-40 sm:h-48" aria-hidden="true" />

        {/* Profile Info */}
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="relative">
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
                      <div key={stat.label}>
                        <span className="font-semibold text-foreground">
                          {formatCount(stat.value)}
                        </span>{" "}
                        <span className="text-muted-foreground">{stat.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
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
              <div className="mb-6">
                <Button
                  type="button"
                  size="lg"
                  className="w-full"
                  onClick={handleNewPost}
                >
                  <Plus />
                  发表新动态
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
          picturesLoading ? (
            <LoadingBlock />
          ) : picturesError && pictures.length === 0 ? (
            <EmptyState title="作品加载失败" description={picturesError} />
          ) : pictures.length === 0 ? (
            <EmptyState title="暂无作品" description="上传的作品会展示在这里" />
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
          )
        ) : activeTab === "featured" ? (
          featuredLoading ? (
            <LoadingBlock />
          ) : featuredError ? (
            <EmptyState title="精选图片加载失败" description={featuredError} />
          ) : featuredImages.length === 0 ? (
            <EmptyState title="暂无精选图片" description="设置精选后会展示在这里" />
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
          )
        ) : (
          albumLoading ? (
            <LoadingBlock />
          ) : albumError ? (
            <EmptyState title="相册加载失败" description={albumError} />
          ) : albums.length === 0 ? (
            <EmptyState title="暂无相册" description="创建的相册会展示在这里" />
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
          )
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
                onClick={() => handleDeleteImage(previewImage.id)}
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
