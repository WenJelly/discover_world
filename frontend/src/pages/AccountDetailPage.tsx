import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowUp,
  BookOpen,
  CalendarDays,
  Camera,
  Heart,
  ImageIcon,
  ImageOff,
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
import type {
  ImageItem,
  MediaAssetResponse,
  ProfileAlbumResponse,
  ProfilePostResponse,
  UserProfile,
} from "@/lib/types";

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

function formatCount(value: number) {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}万`;
  }
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatDate(value: string) {
  if (!value) return "未知时间";
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function getAvatarFallback(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || "U";
}

function getMediaUrl(media?: MediaAssetResponse | null) {
  if (!media) return "";
  return (
    media.thumbnailUrl ||
    media.urls?.thumbnail ||
    media.urls?.preview ||
    media.urls?.detail ||
    media.urls?.original ||
    media.url ||
    ""
  );
}

function getImageUrl(image: ImageItem) {
  return image.url;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
      <div className="flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
        <ImageIcon className="size-6" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h3>
      <p className="mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </div>
  );
}

function LoadingBlock() {
  return (
    <div className="flex min-h-64 items-center justify-center">
      <Loader2 className="size-6 animate-spin text-slate-400" />
    </div>
  );
}

export default function AccountDetailPage() {
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<AccountTab>("posts");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Preview state
  const [previewImage, setPreviewImage] = useState<ImageItem | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number>(-1);

  // New post dialog state
  const [showNewPostDialog, setShowNewPostDialog] = useState(false);
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostSubmitting, setNewPostSubmitting] = useState(false);

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

  const ownerId = user?.id;

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

  const stats = useMemo(() => {
    if (!profile) return [];
    return [
      { label: "作品", value: pictures.length },
      { label: "精选", value: featuredImages.length },
      { label: "相册", value: albums.length },
    ];
  }, [profile, pictures.length, featuredImages.length, albums.length]);

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

  const handleDeleteImage = async (imageId: string) => {
    if (!window.confirm("确定要删除这张图片吗？此操作无法撤销。")) {
      return;
    }

    try {
      await deleteMediaAsset(imageId);

      // Remove from pictures list
      setPictures((prev) => prev.filter((img) => img.id !== imageId));

      // Remove from featured list if exists
      setFeaturedImages((prev) => prev.filter((img) => img.id !== imageId));

      handleClosePreview();

      // Show success message (you can add a toast here)
      console.log("图片删除成功");
    } catch (error) {
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

  const handleCloseNewPostDialog = () => {
    setShowNewPostDialog(false);
    setNewPostContent("");
  };

  const handleSubmitNewPost = async () => {
    if (!newPostContent.trim()) {
      alert("请输入动态内容");
      return;
    }

    setNewPostSubmitting(true);
    try {
      // TODO: Call API to create new post
      console.log("Creating new post:", newPostContent);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Close dialog and reload posts
      handleCloseNewPostDialog();
      await loadPosts(true);

      // Show success message
      console.log("动态发布成功");
    } catch (error) {
      console.error("发布失败:", error);
      alert(`发布失败: ${error instanceof ApiError ? error.message : "未知错误"}`);
    } finally {
      setNewPostSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center bg-white px-4 dark:bg-slate-950">
        <div className="text-center">
          <UserRound className="mx-auto size-12 text-slate-300 dark:text-slate-700" />
          <h1 className="mt-4 text-xl font-semibold text-slate-900 dark:text-slate-100">
            需要登录
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            登录后可以查看个人主页
          </p>
        </div>
      </div>
    );
  }

  if (profileLoading && !profile) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center bg-white dark:bg-slate-950">
        <LoadingBlock />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center bg-white px-4 dark:bg-slate-950">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            加载失败
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
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
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Hero Section */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        {/* Cover (optional placeholder for future) */}
        <div className="h-40 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 sm:h-48" />

        {/* Profile Info */}
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="relative">
            {/* Avatar */}
            <div className="absolute -top-12 sm:-top-14">
              <Avatar className="size-24 border-4 border-white ring-2 ring-slate-200 dark:border-slate-950 dark:ring-slate-800 sm:size-28">
                {profile.avatarUrl ? (
                  <AvatarImage src={profile.avatarUrl} alt={profile.username} />
                ) : null}
                <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-xl font-bold text-white sm:text-2xl">
                  {getAvatarFallback(profile.username)}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* Profile Details */}
            <div className="pb-3 pt-14 sm:pt-16">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    {profile.username}
                  </h1>
                  <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                    {profile.handle}
                  </p>
                  {profile.bio ? (
                    <p className="mt-3 text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
                      {profile.bio}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
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
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {formatCount(stat.value)}
                        </span>{" "}
                        <span className="text-slate-500 dark:text-slate-400">{stat.label}</span>
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
          <div className="flex gap-8 border-b border-slate-200 dark:border-slate-800">
            {TAB_ITEMS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`group relative flex items-center gap-2 px-1 py-3 text-[15px] font-medium transition-colors ${
                    activeTab === tab.id
                      ? "text-slate-900 dark:text-slate-100"
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                  }`}
                >
                  <Icon className="size-[18px]" strokeWidth={2} />
                  {tab.label}
                  {activeTab === tab.id ? (
                    <div className="absolute bottom-0 left-0 right-0 h-1 rounded-full bg-indigo-600" />
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
            {/* New Post Button */}
            <div className="mb-6">
              <button
                type="button"
                onClick={handleNewPost}
                className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 p-[1px] transition-all hover:shadow-lg hover:shadow-indigo-500/25"
              >
                <div className="flex items-center justify-center gap-2 rounded-[11px] bg-white px-6 py-4 transition-colors group-hover:bg-gradient-to-r group-hover:from-indigo-50 group-hover:to-purple-50 dark:bg-slate-900 dark:group-hover:from-indigo-950/30 dark:group-hover:to-purple-950/30">
                  <Plus
                    size={20}
                    className="text-indigo-600 transition-transform group-hover:rotate-90 dark:text-indigo-400"
                    aria-hidden="true"
                  />
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    发表新动态
                  </span>
                </div>
              </button>
            </div>

            {postLoading ? (
              <LoadingBlock />
            ) : postError && posts.length === 0 ? (
              <EmptyState title="动态加载失败" description={postError} />
            ) : posts.length === 0 ? (
              <EmptyState title="暂无动态" description="发布的动态会展示在这里" />
            ) : (
              <div className="space-y-4">
              {posts.map((post) => (
                <article
                  key={post.id}
                  className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="size-10">
                      {profile.avatarUrl ? (
                        <AvatarImage src={profile.avatarUrl} alt={profile.username} />
                      ) : null}
                      <AvatarFallback>{getAvatarFallback(profile.username)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {profile.username}
                        </span>
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                          {profile.handle}
                        </span>
                        <span className="text-sm text-slate-500 dark:text-slate-400">·</span>
                        <time className="text-sm text-slate-500 dark:text-slate-400">
                          {formatDate(post.createdAt)}
                        </time>
                      </div>
                      {post.content ? (
                        <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
                          {post.content}
                        </p>
                      ) : null}
                      {post.images.length > 0 ? (
                        <div className={`mt-3 grid gap-2 ${
                          post.images.length === 1 ? "grid-cols-1" :
                          post.images.length === 2 ? "grid-cols-2" :
                          "grid-cols-2"
                        }`}>
                          {post.images.slice(0, 4).map((image) => {
                            const src = getMediaUrl(image);
                            return (
                              <div
                                key={image.id}
                                className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
                              >
                                {src ? (
                                  <img
                                    src={src}
                                    alt={image.title}
                                    loading="lazy"
                                    decoding="async"
                                    className="h-64 w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-64 items-center justify-center text-slate-400">
                                    <ImageOff className="size-8" />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                      <div className="mt-3 flex items-center gap-6 text-slate-500 dark:text-slate-400">
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 text-sm transition-colors hover:text-indigo-600"
                        >
                          <Heart className="size-[18px]" />
                          <span>{formatCount(post.stats.reactionCount)}</span>
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 text-sm transition-colors hover:text-indigo-600"
                        >
                          <MessageCircle className="size-[18px]" />
                          <span>{formatCount(post.stats.commentCount)}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
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
                    className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-900"
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
                  className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-900"
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
                    className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="aspect-video bg-slate-100 dark:bg-slate-800">
                      {coverUrl ? (
                        <img
                          src={coverUrl}
                          alt={album.name}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-slate-400">
                          <BookOpen className="size-8" />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">
                        {album.name}
                      </h3>
                      {album.description ? (
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
                          {album.description}
                        </p>
                      ) : null}
                      <div className="mt-3 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
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
          }
        />
      )}

      {/* New Post Dialog */}
      {showNewPostDialog && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-post-title"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            onClick={handleCloseNewPostDialog}
            aria-hidden="true"
          />

          {/* Dialog Content */}
          <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
            {/* Header */}
            <div className="relative overflow-hidden rounded-t-2xl bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-8">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNjAgMTAgTSAxMCAwIEwgMTAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30" />
              <div className="relative flex items-center justify-between">
                <h2
                  id="new-post-title"
                  className="text-2xl font-bold text-white"
                >
                  发表新动态
                </h2>
                <button
                  type="button"
                  onClick={handleCloseNewPostDialog}
                  className="rounded-lg p-2 text-white/80 transition-all hover:bg-white/20 hover:text-white"
                  aria-label="关闭"
                >
                  <svg
                    className="size-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6">
              <div className="flex gap-4">
                <Avatar className="size-12 ring-2 ring-indigo-100 dark:ring-indigo-900">
                  {profile?.avatarUrl ? (
                    <AvatarImage src={profile.avatarUrl} alt={profile.username} />
                  ) : null}
                  <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                    {profile ? getAvatarFallback(profile.username) : "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-4">
                  <textarea
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    placeholder="分享你的想法..."
                    maxLength={500}
                    rows={6}
                    className="w-full resize-none rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 placeholder-slate-400 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-indigo-500 dark:focus:bg-slate-900"
                    autoFocus
                    disabled={newPostSubmitting}
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      <span className={newPostContent.length > 450 ? "font-semibold text-amber-600 dark:text-amber-400" : ""}>
                        {newPostContent.length}
                      </span>
                      {" / 500"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 rounded-b-2xl border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/50">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseNewPostDialog}
                disabled={newPostSubmitting}
                className="border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
              >
                取消
              </Button>
              <button
                type="button"
                onClick={handleSubmitNewPost}
                disabled={newPostSubmitting || !newPostContent.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:shadow-xl hover:shadow-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              >
                {newPostSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    发布中...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} aria-hidden="true" />
                    发布动态
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
