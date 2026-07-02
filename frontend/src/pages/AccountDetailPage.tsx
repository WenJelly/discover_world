import {
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowUp,
  Award,
  BadgeCheck,
  Bookmark,
  CalendarDays,
  Camera,
  Crown,
  Eye,
  Flame,
  Globe2,
  Heart,
  ImageIcon,
  ImageOff,
  Link as LinkIcon,
  Loader2,
  Lock,
  MapPin,
  MessageCircle,
  Search,
  Send,
  Settings,
  Share2,
  Shield,
  Sparkles,
  Star,
  Trash2,
  Upload,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import {
  ApiError,
  fetchUserImages,
  fetchUserProfile,
  updateUserProfile,
} from "@/lib/api";
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
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type {
  AchievementItem,
  BadgeItem,
  DetailUserResponse,
  ImageItem,
  PictureResponse,
  SocialLink,
  TimelinePost,
  UserProfile,
} from "@/lib/types";

type AccountTab =
  | "featured"
  | "images"
  | "timeline"
  | "achievements"
  | "collections"
  | "about";

type SortMode = "latest" | "hot" | "favorites";
type Visibility = TimelinePost["visibility"];
type ViewMode = "owner" | "visitor";

type CollectionItem = {
  id: string;
  name: string;
  coverUrl: string;
  imageCount: number;
  updatedAt: string;
  isPublic: boolean;
};

type CreatePostPayload = {
  content: string;
  images: string[];
  tags: string[];
  visibility: Visibility;
  linkedImageIds: string[];
};

type SettingsPayload = {
  username: string;
  bio: string;
  avatarUrl: string;
  coverUrl: string;
  location: string;
  title: string;
  socialLinks: SocialLink[];
};

const DEFAULT_COVER =
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1800&q=86";

const PHOTO_URLS = [
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1100&q=82",
  "https://images.unsplash.com/photo-1495567720989-cebdbdd97913?auto=format&fit=crop&w=900&q=82",
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=82",
  "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=900&q=82",
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=900&q=82",
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=700&q=82",
  "https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=900&q=82",
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=900&q=82",
  "https://images.unsplash.com/photo-1482192505345-5655af888cc4?auto=format&fit=crop&w=900&q=82",
  "https://images.unsplash.com/photo-1470770903676-69b98201ea1c?auto=format&fit=crop&w=900&q=82",
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1000&q=82",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=82",
];

const MOCK_BADGES: BadgeItem[] = [
  {
    id: "badge-light",
    name: "光影采集者",
    description: "连续发布 30 张通过审核的作品",
    icon: "✦",
    rarity: "legendary",
    achievedAt: "2026-03-18",
  },
  {
    id: "badge-editor",
    name: "编辑精选",
    description: "作品被公开图库推荐",
    icon: "◆",
    rarity: "epic",
    achievedAt: "2026-04-02",
  },
  {
    id: "badge-archive",
    name: "城市档案",
    description: "完成一组城市主题影像",
    icon: "◇",
    rarity: "rare",
    achievedAt: "2026-05-11",
  },
  {
    id: "badge-daily",
    name: "日常记录",
    description: "完成 7 天连续动态",
    icon: "●",
    rarity: "common",
    achievedAt: "2026-06-08",
  },
];

const MOCK_ACHIEVEMENTS: AchievementItem[] = [
  {
    id: "a-portfolio",
    title: "代表作品集",
    description: "创建 3 个公开收藏夹",
    progress: 2,
    target: 3,
    completed: false,
  },
  {
    id: "a-reach",
    title: "社区声量",
    description: "作品获得 10,000 次浏览",
    progress: 12840,
    target: 10000,
    completed: true,
  },
  {
    id: "a-craft",
    title: "稳定创作",
    description: "本月发布 12 张作品",
    progress: 9,
    target: 12,
    completed: false,
  },
];

const MOCK_PROFILE: UserProfile = {
  id: "100001",
  username: "WenJelly",
  handle: "@wenjelly.archive",
  avatarUrl:
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=82",
  coverUrl: DEFAULT_COVER,
  bio: "以日常光线、街角几何和安静人物为线索，整理一座城市的私人影像档案。",
  title: "城市光影策展人",
  level: 32,
  location: "上海",
  joinedAt: "2025-08-12",
  followers: 24890,
  following: 316,
  likes: 182400,
  imageCount: 128,
  achievementCount: 18,
  badges: MOCK_BADGES,
  styleTags: ["街拍", "胶片感", "极简", "黑白", "城市切片"],
  socialLinks: [{ type: "Portfolio", url: "https://wenjelly.example" }],
};

const MOCK_IMAGES: ImageItem[] = PHOTO_URLS.map((url, index) => {
  const categories = ["街拍", "风景", "人像", "建筑"];
  const tags = [
    ["晨光", "城市", "胶片"],
    ["山野", "雾气", "静物"],
    ["夜色", "霓虹", "构成"],
    ["留白", "黑白", "线条"],
  ][index % 4];

  return {
    id: `mock-image-${index + 1}`,
    url,
    title: [
      "雨后街角",
      "低云远山",
      "玻璃幕墙的午后",
      "夜行轨迹",
      "蓝色时刻",
      "旧巷光斑",
      "海风档案",
      "林间路径",
      "室内静光",
      "远行记忆",
      "山谷边界",
      "清晨露台",
    ][index],
    description: "收录于个人影像档案的精选片段。",
    category: categories[index % categories.length],
    tags,
    likes: 420 + index * 137,
    favorites: 88 + index * 24,
    views: 2400 + index * 680,
    createdAt: `2026-${String((index % 6) + 1).padStart(2, "0")}-${String(
      10 + index
    ).padStart(2, "0")}`,
    isFeatured: index < 8,
  };
});

const MOCK_TIMELINE: TimelinePost[] = [
  {
    id: "post-pinned",
    content:
      "把最近三个月拍摄的城市清晨整理成了一个新的公开收藏夹。每张图都来自通勤路上十分钟以内的停留，光线是最稳定的线索。",
    images: PHOTO_URLS.slice(0, 3),
    tags: ["置顶", "城市", "清晨"],
    createdAt: "2026-06-30 08:20:00",
    likes: 862,
    comments: 48,
    shares: 19,
    isLiked: false,
    isPinned: true,
    visibility: "public",
  },
  {
    id: "post-1",
    content:
      "今天的拍摄只保留了两种颜色：薄雾里的青灰和路灯刚亮时的一点橙。越克制，越容易看见结构。",
    images: PHOTO_URLS.slice(3, 5),
    tags: ["色彩", "夜拍"],
    createdAt: "2026-06-21 19:12:00",
    likes: 341,
    comments: 22,
    shares: 8,
    isLiked: true,
    visibility: "followers",
  },
  {
    id: "post-2",
    content: "给新作品选封面时，第一张不一定最完整，但需要最有入口感。",
    images: PHOTO_URLS.slice(6, 7),
    tags: ["精选", "策展"],
    createdAt: "2026-05-29 11:40:00",
    likes: 219,
    comments: 11,
    shares: 4,
    isLiked: false,
    visibility: "public",
  },
  {
    id: "post-3",
    content:
      "整理旧片时发现，很多当时以为失败的照片，在一年后反而成了最准确的记录。",
    images: PHOTO_URLS.slice(7, 11),
    tags: ["旧片", "档案"],
    createdAt: "2026-05-12 22:18:00",
    likes: 488,
    comments: 33,
    shares: 12,
    isLiked: false,
    visibility: "public",
  },
];

const MOCK_COLLECTIONS: CollectionItem[] = [
  {
    id: "c-city",
    name: "城市清晨",
    coverUrl: PHOTO_URLS[0],
    imageCount: 42,
    updatedAt: "2026-06-30",
    isPublic: true,
  },
  {
    id: "c-film",
    name: "胶片色温",
    coverUrl: PHOTO_URLS[4],
    imageCount: 28,
    updatedAt: "2026-06-12",
    isPublic: true,
  },
  {
    id: "c-private",
    name: "未发布草稿",
    coverUrl: PHOTO_URLS[8],
    imageCount: 16,
    updatedAt: "2026-05-24",
    isPublic: false,
  },
];

const TAB_ITEMS: Array<{ id: AccountTab; label: string }> = [
  { id: "featured", label: "精选" },
  { id: "images", label: "图片" },
  { id: "timeline", label: "动态" },
  { id: "achievements", label: "成就" },
  { id: "collections", label: "收藏夹" },
  { id: "about", label: "关于" },
];

const IMAGE_PAGE_SIZE = 9;
const TIMELINE_PAGE_SIZE = 3;

function sleep(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function formatCount(value: number) {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}万`;
  }

  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatDate(value: string) {
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function getMonthKey(value: string) {
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return "近期";
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function getAvatarFallback(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || "用户";
}

function getImageUrl(image: ImageItem) {
  return image.url || DEFAULT_COVER;
}

function getSortedImages(images: ImageItem[], sort: SortMode) {
  const next = [...images];
  if (sort === "hot") return next.sort((a, b) => b.likes - a.likes);
  if (sort === "favorites") {
    return next.sort((a, b) => b.favorites - a.favorites);
  }

  return next.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

function getFilteredMockImages(
  keyword: string,
  category: string,
  tag: string,
  sort: SortMode
) {
  const normalizedKeyword = keyword.trim().toLowerCase();
  const filtered = MOCK_IMAGES.filter((image) => {
    const matchesKeyword =
      normalizedKeyword.length === 0 ||
      image.title.toLowerCase().includes(normalizedKeyword) ||
      image.description?.toLowerCase().includes(normalizedKeyword);
    const matchesCategory = category === "all" || image.category === category;
    const matchesTag = tag === "all" || image.tags.includes(tag);

    return matchesKeyword && matchesCategory && matchesTag;
  });

  return getSortedImages(filtered, sort);
}

function toImageItem(picture: PictureResponse, index: number): ImageItem {
  return {
    id: picture.id,
    url: picture.thumbnailUrl || picture.url,
    title: picture.name || "未命名作品",
    description: picture.introduction,
    category: picture.category || "未分类",
    tags: picture.tags ?? [],
    likes: picture.likeCount ?? 0,
    favorites: Math.max(12, Math.round((picture.likeCount ?? 0) * 0.36) + index),
    views: picture.viewCount ?? 0,
    createdAt: picture.createTime || picture.updateTime,
    isFeatured: index < 8,
  };
}

function toProfile(detail: DetailUserResponse): UserProfile {
  const username =
    detail.userName?.trim() ||
    detail.userEmail?.split("@")[0] ||
    "WenJelly Creator";
  const approvedCount = detail.approvedPictureCount ?? detail.pictureCount ?? 0;

  return {
    ...MOCK_PROFILE,
    id: detail.id,
    username,
    handle: detail.userEmail ? `@${detail.userEmail.split("@")[0]}` : `@${detail.id}`,
    avatarUrl: detail.userAvatar || MOCK_PROFILE.avatarUrl,
    bio: detail.userProfile || MOCK_PROFILE.bio,
    joinedAt: detail.createTime || MOCK_PROFILE.joinedAt,
    imageCount: approvedCount,
    followers: MOCK_PROFILE.followers + approvedCount * 5,
    likes: MOCK_PROFILE.likes + approvedCount * 72,
  };
}

async function createTimelinePost(payload: CreatePostPayload) {
  await sleep(520);

  return {
    id: `post-${Date.now()}`,
    content: payload.content,
    images: payload.images,
    tags: payload.tags,
    createdAt: new Date().toISOString(),
    likes: 0,
    comments: 0,
    shares: 0,
    isLiked: false,
    isPinned: false,
    visibility: payload.visibility,
  } satisfies TimelinePost;
}

async function fetchTimelinePosts({
  cursor,
  pageSize,
}: {
  cursor?: string;
  pageSize: number;
}) {
  await sleep(420);
  const start = cursor ? Number(cursor) : 0;
  const list = MOCK_TIMELINE.slice(start, start + pageSize);
  const next = start + list.length;

  return {
    list,
    hasMore: next < MOCK_TIMELINE.length,
    nextCursor: next < MOCK_TIMELINE.length ? String(next) : "",
  };
}

async function followUser(userId: string) {
  await sleep(260);
  return { userId };
}

async function unfollowUser(userId: string) {
  await sleep(260);
  return { userId };
}

async function likePost(postId: string) {
  await sleep(160);
  return { postId };
}

function RarityBadge({ badge }: { badge: BadgeItem }) {
  const rarityClass = {
    common: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
    rare: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-200",
    epic: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-500/25 dark:bg-fuchsia-500/10 dark:text-fuchsia-200",
    legendary: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200",
  }[badge.rarity];

  return (
    <span
      title={`${badge.description} · ${formatDate(badge.achievedAt)}`}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${rarityClass}`}
    >
      <span aria-hidden="true">{badge.icon}</span>
      {badge.name}
    </span>
  );
}

function ProfileStats({ profile }: { profile: UserProfile }) {
  const stats = [
    { label: "作品", value: profile.imageCount, icon: Camera },
    { label: "粉丝", value: profile.followers, icon: Users },
    { label: "关注", value: profile.following, icon: BadgeCheck },
    { label: "获赞", value: profile.likes, icon: Heart },
    { label: "成就", value: profile.achievementCount, icon: Award },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="rounded-[8px] border border-white/40 bg-white/68 p-3 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/42"
          >
            <div className="flex items-center gap-1.5 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
              <Icon className="size-3.5" />
              {stat.label}
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
              {formatCount(stat.value)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProfileHero({
  profile,
  isOwner,
  viewMode,
  following,
  followerCount,
  loading,
  onToggleFollow,
  onOpenSettings,
  onViewModeChange,
}: {
  profile: UserProfile;
  isOwner: boolean;
  viewMode: ViewMode;
  following: boolean;
  followerCount: number;
  loading: boolean;
  onToggleFollow: () => void;
  onOpenSettings: () => void;
  onViewModeChange: (mode: ViewMode) => void;
}) {
  const displayProfile = { ...profile, followers: followerCount };

  return (
    <section className="relative isolate min-h-[620px] overflow-hidden pt-16">
      <img
        src={profile.coverUrl}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(248,250,252,0.32),rgba(248,250,252,0.94)_68%,rgba(248,250,252,1))] dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.24),rgba(15,23,42,0.90)_68%,rgba(15,23,42,1))]" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-[radial-gradient(circle_at_22%_12%,rgba(14,165,233,0.24),transparent_36%),radial-gradient(circle_at_82%_22%,rgba(245,158,11,0.18),transparent_28%)]" />

      <div className="relative mx-auto flex min-h-[620px] max-w-7xl items-end px-4 pb-10 sm:px-6 lg:px-8">
        <div className="w-full">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-full border border-white/50 bg-white/64 p-1 text-xs shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/50">
              {(["owner", "visitor"] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onViewModeChange(mode)}
                  className={`rounded-full px-3 py-1.5 transition ${
                    viewMode === mode
                      ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                      : "text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
                  }`}
                >
                  {mode === "owner" ? "本人视角" : "访客视角"}
                </button>
              ))}
            </div>
            {loading ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 text-xs text-slate-500 backdrop-blur-xl dark:bg-slate-950/60 dark:text-slate-300">
                <Loader2 className="size-3.5 animate-spin" />
                同步账户数据
              </span>
            ) : null}
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-[8px] border border-white/52 bg-white/72 p-4 shadow-[0_24px_90px_rgba(15,23,42,0.14)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/58 sm:p-6">
              <div className="flex flex-col gap-5 md:flex-row md:items-end">
                <Avatar className="size-28 border-4 border-white shadow-xl dark:border-slate-900 sm:size-32">
                  <AvatarImage src={profile.avatarUrl} alt={profile.username} />
                  <AvatarFallback>{getAvatarFallback(profile.username)}</AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                      <Crown className="size-3.5" />
                      {profile.title}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-200">
                      Lv.{profile.level}
                    </span>
                    {profile.badges.slice(0, 2).map((badge) => (
                      <RarityBadge key={badge.id} badge={badge} />
                    ))}
                  </div>
                  <h1 className="text-4xl font-semibold text-slate-950 dark:text-white sm:text-5xl">
                    {profile.username}
                  </h1>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                    <span>{profile.handle}</span>
                    {profile.location ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-4" />
                        {profile.location}
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="size-4" />
                      {formatDate(profile.joinedAt)} 加入
                    </span>
                  </div>
                  <p className="mt-4 max-w-2xl text-base leading-7 text-slate-700 dark:text-slate-200">
                    {profile.bio}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {profile.styleTags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2 md:w-36">
                  {isOwner ? (
                    <Button
                      type="button"
                      className="h-10 rounded-[8px]"
                      onClick={onOpenSettings}
                    >
                      <Settings className="size-4" />
                      设置
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      className="h-10 rounded-[8px]"
                      onClick={onToggleFollow}
                    >
                      {following ? (
                        <UserMinus className="size-4" />
                      ) : (
                        <UserPlus className="size-4" />
                      )}
                      {following ? "已关注" : "关注"}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-[8px]"
                  >
                    <Share2 className="size-4" />
                    分享主页
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-[8px] border border-white/52 bg-white/72 p-4 shadow-[0_24px_90px_rgba(15,23,42,0.10)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/58">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    创作状态
                  </div>
                  <div className="text-lg font-semibold text-slate-950 dark:text-white">
                    活跃档案馆
                  </div>
                </div>
                <Sparkles className="size-5 text-amber-500" />
              </div>
              <ProfileStats profile={displayProfile} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProfileTabs({
  activeTab,
  onChange,
}: {
  activeTab: AccountTab;
  onChange: (tab: AccountTab) => void;
}) {
  return (
    <div className="sticky top-16 z-30 border-y border-slate-200/70 bg-white/82 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/82">
      <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-2 sm:px-6 lg:px-8">
        {TAB_ITEMS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => onChange(tab.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
              activeTab === tab.id
                ? "bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function CreatorInsightPanel({
  profile,
  images,
}: {
  profile: UserProfile;
  images: ImageItem[];
}) {
  const topCategory =
    images.reduce<Record<string, number>>((acc, image) => {
      acc[image.category] = (acc[image.category] ?? 0) + 1;
      return acc;
    }, {});
  const category = Object.entries(topCategory).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "街拍";

  return (
    <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-950 dark:text-white">创作洞察</h2>
        <Flame className="size-4 text-rose-500" />
      </div>
      <div className="mt-5 grid gap-3">
        {[
          ["本月图片", "9"],
          ["本月动态", "6"],
          ["总浏览量", formatCount(483200)],
          ["热门分类", category],
          ["活跃时段", "20:00"],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between text-sm">
            <span className="text-slate-500 dark:text-slate-400">{label}</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {value}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-[8px] bg-slate-50 p-3 dark:bg-white/5">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          成长趋势
        </div>
        <div className="mt-3 flex h-16 items-end gap-2">
          {[28, 44, 36, 58, 62, 74, 88].map((height, index) => (
            <div
              key={index}
              className="flex-1 rounded-t bg-gradient-to-t from-sky-500 to-emerald-300"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">
        {profile.username} 的近期互动主要集中在精选图片和置顶动态。
      </p>
    </section>
  );
}

function ProfileBadgeWall({ badges }: { badges: BadgeItem[] }) {
  return (
    <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-950 dark:text-white">荣誉展柜</h2>
        <Award className="size-4 text-amber-500" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {badges.map((badge) => (
          <div
            key={badge.id}
            title={`${badge.description} · ${formatDate(badge.achievedAt)}`}
            className="rounded-[8px] border border-slate-200 bg-slate-50 p-3 transition hover:-translate-y-0.5 hover:border-amber-200 hover:bg-amber-50 dark:border-white/10 dark:bg-white/5 dark:hover:border-amber-500/30 dark:hover:bg-amber-500/10"
          >
            <div className="text-2xl">{badge.icon}</div>
            <div className="mt-2 text-sm font-medium text-slate-950 dark:text-white">
              {badge.name}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {badge.rarity}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProfileAchievementPanel({
  achievements,
}: {
  achievements: AchievementItem[];
}) {
  return (
    <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-950 dark:text-white">成就进度</h2>
        <Shield className="size-4 text-emerald-500" />
      </div>
      <div className="mt-4 space-y-4">
        {achievements.map((achievement) => {
          const progress = Math.min(
            100,
            Math.round((achievement.progress / achievement.target) * 100)
          );
          return (
            <div key={achievement.id}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-950 dark:text-white">
                    {achievement.title}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {achievement.description}
                  </div>
                </div>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {progress}%
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                <div
                  className={`h-full rounded-full ${
                    achievement.completed
                      ? "bg-emerald-500"
                      : "bg-gradient-to-r from-sky-500 to-amber-400"
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FeaturedGallery({
  images,
  isOwner,
  onPreview,
}: {
  images: ImageItem[];
  isOwner: boolean;
  onPreview: (image: ImageItem) => void;
}) {
  const featured = images.filter((image) => image.isFeatured).slice(0, 8);
  const lead = featured[0];

  if (!lead) {
    return <EmptyState title="暂无精选作品" description="精选橱窗会在作品通过审核后展示。" />;
  }

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950 dark:text-white">
            精选橱窗
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            代表作品与最近被社区收藏最多的影像。
          </p>
        </div>
        {isOwner ? (
          <Button type="button" variant="outline" className="rounded-[8px]">
            <Star className="size-4" />
            管理精选
          </Button>
        ) : null}
      </div>
      <div className="grid gap-3 lg:grid-cols-[1.25fr_1fr]">
        <button
          type="button"
          onClick={() => onPreview(lead)}
          className="group relative min-h-[420px] overflow-hidden rounded-[8px] bg-slate-100 text-left dark:bg-slate-900"
        >
          <img
            src={getImageUrl(lead)}
            alt={lead.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/72 via-slate-950/10 to-transparent opacity-90" />
          <div className="absolute inset-x-0 bottom-0 p-6 text-white">
            <div className="mb-3 inline-flex items-center gap-1 rounded-full bg-white/16 px-3 py-1 text-xs backdrop-blur">
              <Sparkles className="size-3.5" />
              代表作品
            </div>
            <h3 className="text-3xl font-semibold">{lead.title}</h3>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {lead.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-white/14 px-2.5 py-1">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </button>
        <div className="grid grid-cols-2 gap-3">
          {featured.slice(1, 7).map((image) => (
            <ImageCard
              key={image.id}
              image={image}
              compact
              onPreview={() => onPreview(image)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function ImageCard({
  image,
  compact = false,
  onPreview,
}: {
  image: ImageItem;
  compact?: boolean;
  onPreview: () => void;
}) {
  const [errored, setErrored] = useState(false);

  return (
    <button
      type="button"
      onClick={onPreview}
      className={`group relative block overflow-hidden rounded-[8px] bg-slate-100 text-left dark:bg-slate-900 ${
        compact ? "min-h-48" : "min-h-72"
      }`}
    >
      {errored ? (
        <div className="flex h-full min-h-48 items-center justify-center text-slate-400">
          <ImageOff className="size-7" />
        </div>
      ) : (
        <img
          src={getImageUrl(image)}
          alt={image.title}
          loading="lazy"
          decoding="async"
          onError={() => setErrored(true)}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.035]"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/76 via-slate-950/12 to-transparent opacity-0 transition duration-200 group-hover:opacity-100 group-focus-visible:opacity-100" />
      <div className="absolute inset-x-0 bottom-0 translate-y-3 p-4 text-white opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
        <div className="line-clamp-1 text-sm font-semibold">{image.title}</div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/80">
          <span className="inline-flex items-center gap-1">
            <Heart className="size-3.5" />
            {formatCount(image.likes)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Bookmark className="size-3.5" />
            {formatCount(image.favorites)}
          </span>
        </div>
      </div>
    </button>
  );
}

function UserImageGrid({
  images,
  loading,
  error,
  hasMore,
  keyword,
  category,
  tag,
  sort,
  sentinelRef,
  onKeywordChange,
  onCategoryChange,
  onTagChange,
  onSortChange,
  onPreview,
  onRetry,
}: {
  images: ImageItem[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  keyword: string;
  category: string;
  tag: string;
  sort: SortMode;
  sentinelRef: (node: HTMLDivElement | null) => void;
  onKeywordChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onTagChange: (value: string) => void;
  onSortChange: (value: SortMode) => void;
  onPreview: (image: ImageItem) => void;
  onRetry: () => void;
}) {
  const categories = ["all", ...new Set(MOCK_IMAGES.map((image) => image.category))];
  const tags = ["all", ...new Set(MOCK_IMAGES.flatMap((image) => image.tags))];

  return (
    <section className="space-y-5">
      <div className="rounded-[8px] border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
        <div className="grid gap-3 lg:grid-cols-[1fr_160px_160px_160px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={keyword}
              onChange={(event) => onKeywordChange(event.target.value)}
              placeholder="搜索这个账户的图片"
              className="h-10 rounded-[8px] pl-9"
            />
          </label>
          <select
            value={category}
            onChange={(event) => onCategoryChange(event.target.value)}
            className="h-10 rounded-[8px] border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-950 dark:text-slate-200"
            aria-label="按分类筛选"
          >
            {categories.map((item) => (
              <option key={item} value={item}>
                {item === "all" ? "全部分类" : item}
              </option>
            ))}
          </select>
          <select
            value={tag}
            onChange={(event) => onTagChange(event.target.value)}
            className="h-10 rounded-[8px] border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-950 dark:text-slate-200"
            aria-label="按标签筛选"
          >
            {tags.map((item) => (
              <option key={item} value={item}>
                {item === "all" ? "全部标签" : item}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(event) => onSortChange(event.target.value as SortMode)}
            className="h-10 rounded-[8px] border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-950 dark:text-slate-200"
            aria-label="图片排序"
          >
            <option value="latest">最新</option>
            <option value="hot">最热</option>
            <option value="favorites">最多收藏</option>
          </select>
        </div>
      </div>

      {images.length === 0 && !loading ? (
        <EmptyState
          title={error ? "加载失败" : "没有匹配的图片"}
          description={error ?? "换一个关键词或筛选条件再试。"}
          action={
            error ? (
              <Button type="button" onClick={onRetry} className="rounded-[8px]">
                重试
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid auto-rows-[16px] grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {images.map((image, index) => (
            <div
              key={image.id}
              className={index % 5 === 0 ? "row-span-[20]" : "row-span-[16]"}
            >
              <ImageCard image={image} onPreview={() => onPreview(image)} />
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-72 animate-pulse rounded-[8px] bg-slate-100 dark:bg-white/10"
            />
          ))}
        </div>
      ) : null}

      <div ref={sentinelRef} className="h-1" />
      {!loading && images.length > 0 ? (
        <div className="flex items-center justify-center py-6 text-sm text-slate-500 dark:text-slate-400">
          {hasMore ? "继续滚动加载更多图片" : "影像流已抵达末尾"}
        </div>
      ) : null}
    </section>
  );
}

function TimelineMarker({ post }: { post: TimelinePost }) {
  return (
    <div className="sticky top-32 hidden w-28 shrink-0 text-right text-xs text-slate-500 dark:text-slate-400 md:block">
      <div className="font-medium text-slate-900 dark:text-slate-100">
        {getMonthKey(post.createdAt)}
      </div>
      <div className="mt-1">{formatDate(post.createdAt)}</div>
    </div>
  );
}

function TimelinePostCard({
  post,
  onLike,
  onPreview,
}: {
  post: TimelinePost;
  onLike: () => void;
  onPreview: (url: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const shouldClamp = post.content.length > 72;
  const images = post.images.slice(0, 4);

  return (
    <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {post.isPinned ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
              <Star className="size-3.5" />
              置顶动态
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500 dark:bg-white/10 dark:text-slate-300">
            {post.visibility === "public" ? (
              <Globe2 className="size-3.5" />
            ) : post.visibility === "followers" ? (
              <Users className="size-3.5" />
            ) : (
              <Lock className="size-3.5" />
            )}
            {post.visibility === "public"
              ? "公开"
              : post.visibility === "followers"
                ? "粉丝可见"
                : "仅自己"}
          </span>
        </div>
        <time className="text-xs text-slate-500 dark:text-slate-400">
          {formatDate(post.createdAt)}
        </time>
      </div>

      <p
        className={`mt-4 text-sm leading-7 text-slate-700 dark:text-slate-200 ${
          !expanded && shouldClamp ? "line-clamp-2" : ""
        }`}
      >
        {post.content}
      </p>
      {shouldClamp ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-2 text-xs font-medium text-sky-700 hover:text-sky-900 dark:text-sky-300 dark:hover:text-sky-100"
        >
          {expanded ? "收起" : "展开全文"}
        </button>
      ) : null}

      {images.length > 0 ? (
        <div
          className={`mt-4 grid gap-2 ${
            images.length === 1 ? "grid-cols-1" : "grid-cols-2"
          }`}
        >
          {images.map((url, index) => (
            <button
              key={url}
              type="button"
              onClick={() => onPreview(url)}
              className={`overflow-hidden rounded-[8px] bg-slate-100 dark:bg-slate-800 ${
                images.length === 3 && index === 0 ? "row-span-2" : ""
              }`}
            >
              <img
                src={url}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full min-h-40 w-full object-cover transition hover:scale-[1.03]"
              />
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {post.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-white/10 dark:text-slate-300"
          >
            #{tag}
          </span>
        ))}
      </div>

      <Separator className="my-4" />

      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <Button
          type="button"
          variant={post.isLiked ? "secondary" : "ghost"}
          size="sm"
          onClick={onLike}
          className="rounded-[8px]"
        >
          <Heart className={`size-4 ${post.isLiked ? "fill-rose-500 text-rose-500" : ""}`} />
          {formatCount(post.likes)}
        </Button>
        <Button type="button" variant="ghost" size="sm" className="rounded-[8px]">
          <MessageCircle className="size-4" />
          {formatCount(post.comments)}
        </Button>
        <Button type="button" variant="ghost" size="sm" className="rounded-[8px]">
          <Share2 className="size-4" />
          {formatCount(post.shares)}
        </Button>
      </div>
    </article>
  );
}

function ImageUploadDropzone({
  images,
  onChange,
}: {
  images: string[];
  onChange: (images: string[]) => void;
}) {
  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    Promise.all(
      files.map(
        (file) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.readAsDataURL(file);
          })
      )
    ).then((nextImages) => onChange([...images, ...nextImages].slice(0, 6)));
  }

  return (
    <div className="rounded-[8px] border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-white/15 dark:bg-white/5">
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 text-center text-sm text-slate-500 dark:text-slate-300">
        <Upload className="size-5" />
        选择图片或拖入灵感素材
        <input
          type="file"
          multiple
          accept="image/*"
          className="sr-only"
          onChange={handleFiles}
        />
      </label>
      {images.length > 0 ? (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {images.map((image, index) => (
            <div key={image} className="group relative overflow-hidden rounded-[8px]">
              <img src={image} alt="" className="h-24 w-full object-cover" />
              <button
                type="button"
                onClick={() => onChange(images.filter((_, itemIndex) => itemIndex !== index))}
                className="absolute right-1 top-1 inline-flex size-6 items-center justify-center rounded-full bg-slate-950/68 text-white opacity-0 transition group-hover:opacity-100"
                aria-label="删除已选图片"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PostComposer({
  images,
  onImagesChange,
  onSubmit,
  onCancel,
  publishing,
}: {
  images: string[];
  onImagesChange: (images: string[]) => void;
  onSubmit: (payload: CreatePostPayload) => Promise<void>;
  onCancel: () => void;
  publishing: boolean;
}) {
  const [content, setContent] = useState("");
  const [tagText, setTagText] = useState("日常, 创作");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const canPublish = content.trim().length > 0 || images.length > 0;
  const selectedVisibility =
    visibility === "public" ? "公开" : visibility === "followers" ? "粉丝可见" : "仅自己";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canPublish) return;

    await onSubmit({
      content: content.trim(),
      images,
      tags: tagText
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      visibility,
      linkedImageIds: [],
    });
    setContent("");
    onImagesChange([]);
    onCancel();
  }

  return (
    <form onSubmit={handleSubmit} className="overflow-hidden rounded-[8px] bg-white dark:bg-slate-950">
      <div className="border-b border-slate-200 bg-[oklch(0.985_0.006_248)] px-5 py-5 dark:border-white/10 dark:bg-slate-900 sm:px-6">
        <div className="flex items-start justify-between gap-4 pr-10">
          <div>
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-2.5 py-1 text-xs font-medium text-white dark:bg-white dark:text-slate-950">
              <Sparkles className="size-3.5" />
              创作动态
            </span>
            <DialogHeader className="gap-1 text-left">
              <DialogTitle className="text-2xl font-semibold tracking-normal text-slate-950 dark:text-white">
                发布动态
              </DialogTitle>
              <DialogDescription className="max-w-lg leading-6 text-slate-500 dark:text-slate-400">
                记录照片背后的拍摄进展、选片想法或现场笔记。
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="hidden rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-right shadow-sm dark:border-white/10 dark:bg-white/5 sm:block">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              当前范围
            </div>
            <div className="mt-0.5 text-sm font-medium text-slate-950 dark:text-white">
              {selectedVisibility}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-5 py-5 sm:px-6">
        <label className="block">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            动态内容
          </span>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={5}
            placeholder="记录这次拍摄、选片或创作进展"
            className="mt-2 min-h-36 w-full resize-y rounded-[8px] border border-slate-200 bg-[oklch(0.985_0.006_248)] p-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-400/10 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
          />
        </label>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_170px]">
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              标签
            </span>
            <Input
              value={tagText}
              onChange={(event) => setTagText(event.target.value)}
              placeholder="标签，用英文逗号分隔"
              className="mt-2 h-10 rounded-[8px]"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              可见范围
            </span>
            <select
              value={visibility}
              onChange={(event) => setVisibility(event.target.value as Visibility)}
              className="mt-2 h-10 w-full rounded-[8px] border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"
              aria-label="动态可见范围"
            >
              <option value="public">公开</option>
              <option value="followers">粉丝可见</option>
              <option value="private">仅自己</option>
            </select>
          </label>
        </div>

        <ImageUploadDropzone images={images} onChange={onImagesChange} />

        {content || images.length > 0 ? (
          <div className="rounded-[8px] border border-sky-200 bg-sky-50 p-3 dark:border-sky-500/20 dark:bg-sky-500/10">
            <div className="mb-2 text-xs font-medium text-sky-700 dark:text-sky-200">
              发布预览
            </div>
            <p className="line-clamp-3 text-sm leading-6 text-slate-700 dark:text-slate-200">
              {content || "图片动态"}
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 px-5 py-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {content.trim().length} 字 · {images.length} 张图片
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={publishing}
            className="h-10 rounded-[8px]"
            onClick={onCancel}
          >
            取消
          </Button>
          <Button
            type="submit"
            disabled={!canPublish || publishing}
            className="h-10 rounded-[8px]"
          >
            {publishing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            发布动态
          </Button>
        </div>
      </div>
    </form>
  );
}

function TimelineSection({
  isOwner,
  posts,
  loading,
  hasMore,
  sentinelRef,
  composerImages,
  publishing,
  onComposerImagesChange,
  onPublish,
  onLike,
  onPreview,
}: {
  isOwner: boolean;
  posts: TimelinePost[];
  loading: boolean;
  hasMore: boolean;
  sentinelRef: (node: HTMLDivElement | null) => void;
  composerImages: string[];
  publishing: boolean;
  onComposerImagesChange: (images: string[]) => void;
  onPublish: (payload: CreatePostPayload) => Promise<void>;
  onLike: (postId: string) => void;
  onPreview: (url: string) => void;
}) {
  const [composerOpen, setComposerOpen] = useState(false);

  function handleComposerOpenChange(open: boolean) {
    if (!open && publishing) return;
    setComposerOpen(open);
  }

  async function handlePublish(payload: CreatePostPayload) {
    await onPublish(payload);
    setComposerOpen(false);
  }

  return (
    <section className="space-y-5">
      {isOwner ? (
        <>
          <div className="flex justify-end">
            <Button
              type="button"
              className="h-10 rounded-[8px]"
              aria-label="打开发布动态面板"
              onClick={() => setComposerOpen(true)}
            >
              <Send className="size-4" />
              发布动态
            </Button>
          </div>
          <Dialog open={composerOpen} onOpenChange={handleComposerOpenChange}>
            <DialogContent
              showCloseButton={!publishing}
              className="max-w-2xl overflow-hidden rounded-[8px] border-slate-200 bg-transparent p-0 shadow-[0_28px_90px_rgba(15,23,42,0.28)] dark:border-white/10"
            >
              <PostComposer
                images={composerImages}
                onImagesChange={onComposerImagesChange}
                onSubmit={handlePublish}
                onCancel={() => setComposerOpen(false)}
                publishing={publishing}
              />
            </DialogContent>
          </Dialog>
        </>
      ) : null}

      <div className="space-y-5">
        {posts.map((post) => (
          <div key={post.id} className="flex gap-5">
            <TimelineMarker post={post} />
            <div className="relative flex-1">
              <div className="absolute -left-[30px] top-6 hidden size-3 rounded-full border-2 border-white bg-sky-500 shadow md:block" />
              <TimelinePostCard
                post={post}
                onLike={() => onLike(post.id)}
                onPreview={onPreview}
              />
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={index}
              className="h-40 animate-pulse rounded-[8px] bg-slate-100 dark:bg-white/10"
            />
          ))}
        </div>
      ) : null}
      <div ref={sentinelRef} className="h-1" />
      {!loading ? (
        <div className="flex justify-center py-5 text-sm text-slate-500 dark:text-slate-400">
          {hasMore ? "继续滚动加载更多动态" : "创作者生活轨迹已抵达当前末尾"}
        </div>
      ) : null}
    </section>
  );
}

function CollectionPreview({ collections }: { collections: CollectionItem[] }) {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      {collections.map((collection) => (
        <article
          key={collection.id}
          className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900/70"
        >
          <img
            src={collection.coverUrl}
            alt={collection.name}
            loading="lazy"
            decoding="async"
            className="h-48 w-full object-cover"
          />
          <div className="p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-slate-950 dark:text-white">
                {collection.name}
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500 dark:bg-white/10 dark:text-slate-300">
                {collection.isPublic ? <Globe2 className="size-3" /> : <Lock className="size-3" />}
                {collection.isPublic ? "公开" : "私密"}
              </span>
            </div>
            <div className="mt-3 flex justify-between text-sm text-slate-500 dark:text-slate-400">
              <span>{collection.imageCount} 张图片</span>
              <span>{formatDate(collection.updatedAt)} 更新</span>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
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
    <div className="flex min-h-72 flex-col items-center justify-center rounded-[8px] border border-dashed border-slate-300 bg-white/70 p-8 text-center dark:border-white/15 dark:bg-white/5">
      <div className="flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300">
        <ImageIcon className="size-5" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-slate-950 dark:text-white">
        {title}
      </h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

function ImagePreviewDialog({
  image,
  imageUrl,
  onOpenChange,
}: {
  image: ImageItem | null;
  imageUrl: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const open = Boolean(image || imageUrl);
  const src = image ? getImageUrl(image) : imageUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl border-white/20 bg-slate-950 p-2 text-white">
        <DialogHeader className="sr-only">
          <DialogTitle>{image?.title ?? "图片预览"}</DialogTitle>
        </DialogHeader>
        {src ? (
          <div className="overflow-hidden rounded-[8px]">
            <img src={src} alt={image?.title ?? ""} className="max-h-[76vh] w-full object-contain" />
          </div>
        ) : null}
        {image ? (
          <div className="px-2 pb-2">
            <h2 className="text-lg font-semibold">{image.title}</h2>
            <div className="mt-2 flex flex-wrap gap-3 text-sm text-white/70">
              <span className="inline-flex items-center gap-1">
                <Heart className="size-4" />
                {formatCount(image.likes)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Bookmark className="size-4" />
                {formatCount(image.favorites)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Eye className="size-4" />
                {formatCount(image.views)}
              </span>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ProfileSettingsSheet({
  open,
  profile,
  saving,
  darkMode,
  onOpenChange,
  onSave,
  onToggleTheme,
}: {
  open: boolean;
  profile: UserProfile;
  saving: boolean;
  darkMode: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: SettingsPayload) => Promise<void>;
  onToggleTheme: () => void;
}) {
  const [form, setForm] = useState<SettingsPayload>(() => ({
    username: profile.username,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    coverUrl: profile.coverUrl,
    location: profile.location ?? "",
    title: profile.title,
    socialLinks: profile.socialLinks ?? [],
  }));

  useEffect(() => {
    setForm({
      username: profile.username,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      coverUrl: profile.coverUrl,
      location: profile.location ?? "",
      title: profile.title,
      socialLinks: profile.socialLinks ?? [],
    });
  }, [profile]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSave(form);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="关闭设置"
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <aside className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-950 dark:text-white">
              个人资料设置
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              更新后会同步刷新账户主页展示。
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex size-9 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-white/10"
            aria-label="关闭"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="overflow-hidden rounded-[8px] border border-slate-200 dark:border-white/10">
            <img src={form.coverUrl || DEFAULT_COVER} alt="" className="h-36 w-full object-cover" />
            <div className="-mt-8 px-4 pb-4">
              <Avatar className="size-16 border-4 border-white dark:border-slate-950">
                <AvatarImage src={form.avatarUrl} alt={form.username} />
                <AvatarFallback>{getAvatarFallback(form.username)}</AvatarFallback>
              </Avatar>
            </div>
          </div>

          {[
            ["username", "用户名"],
            ["title", "展示称号"],
            ["avatarUrl", "头像地址"],
            ["coverUrl", "封面地址"],
            ["location", "所在地"],
          ].map(([key, label]) => (
            <label key={key} className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {label}
              </span>
              <Input
                value={String(form[key as keyof SettingsPayload] ?? "")}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    [key]: event.target.value,
                  }))
                }
                className="mt-2 h-10 rounded-[8px]"
              />
            </label>
          ))}

          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              个人简介
            </span>
            <textarea
              value={form.bio}
              onChange={(event) =>
                setForm((current) => ({ ...current, bio: event.target.value }))
              }
              className="mt-2 min-h-28 w-full rounded-[8px] border border-slate-200 bg-white p-3 text-sm leading-6 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-400/10 dark:border-white/10 dark:bg-slate-900"
            />
          </label>

          <div className="rounded-[8px] border border-slate-200 p-4 dark:border-white/10">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-slate-900 dark:text-white">
                  深色模式
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  切换账户页和全站主题。
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={darkMode}
                onClick={onToggleTheme}
                className={`inline-flex h-7 w-12 items-center rounded-full p-1 transition ${
                  darkMode ? "bg-slate-900 dark:bg-white" : "bg-slate-200"
                }`}
              >
                <span
                  className={`inline-flex size-5 items-center justify-center rounded-full bg-white text-slate-500 shadow transition ${
                    darkMode ? "translate-x-5 dark:bg-slate-950" : ""
                  }`}
                >
                  {darkMode ? <Shield className="size-3" /> : <Sparkles className="size-3" />}
                </span>
              </button>
            </div>
            <div className="grid gap-2 text-xs text-slate-500 dark:text-slate-400">
              <label className="flex items-center gap-2">
                <input type="checkbox" defaultChecked />
                允许粉丝查看动态时间线
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" defaultChecked />
                公开展示勋章墙
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-5 dark:border-white/10">
            <Button
              type="button"
              variant="outline"
              className="rounded-[8px]"
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button type="submit" disabled={saving} className="rounded-[8px]">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Settings className="size-4" />}
              保存
            </Button>
          </div>
        </form>
      </aside>
    </div>
  );
}

export default function AccountDetailPage() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile>(MOCK_PROFILE);
  const [profileSource, setProfileSource] = useState<"api" | "mock">("mock");
  const [viewMode, setViewMode] = useState<ViewMode>("owner");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(MOCK_PROFILE.followers);
  const [activeTab, setActiveTab] = useState<AccountTab>("featured");
  const [images, setImages] = useState<ImageItem[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageHasMore, setImageHasMore] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("all");
  const [tag, setTag] = useState("all");
  const [sort, setSort] = useState<SortMode>("latest");
  const [timelinePosts, setTimelinePosts] = useState<TimelinePost[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineHasMore, setTimelineHasMore] = useState(true);
  const [composerImages, setComposerImages] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ImageItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [darkMode, setDarkMode] = useState(() =>
    typeof document !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : false
  );
  const imageCursorRef = useRef("");
  const imageLoadingRef = useRef(false);
  const imageSentinelRef = useRef<HTMLDivElement | null>(null);
  const timelineCursorRef = useRef("");
  const timelineLoadingRef = useRef(false);
  const timelineSentinelRef = useRef<HTMLDivElement | null>(null);

  const isOwner = viewMode === "owner";

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!isAuthenticated) {
        setProfile(MOCK_PROFILE);
        setProfileSource("mock");
        setFollowerCount(MOCK_PROFILE.followers);
        setProfileError(null);
        return;
      }

      setProfileLoading(true);
      setProfileError(null);
      try {
        const detail = await fetchUserProfile(user?.id ? { id: user.id } : {});
        if (cancelled) return;
        const nextProfile = toProfile(detail);
        setProfile(nextProfile);
        setProfileSource("api");
        setFollowerCount(nextProfile.followers);
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof ApiError
            ? error.message
            : "账户数据暂时不可用，已展示 mock 账户。";
        setProfile(MOCK_PROFILE);
        setProfileSource("mock");
        setFollowerCount(MOCK_PROFILE.followers);
        setProfileError(message);
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id]);

  const loadImages = useCallback(
    async (reset = false) => {
      if (imageLoadingRef.current || (!imageHasMore && !reset)) return;

      imageLoadingRef.current = true;
      setImagesLoading(true);
      setImageError(null);
      const cursor = reset ? "" : imageCursorRef.current;

      try {
        if (profileSource === "api" && profile.id) {
          const resp = await fetchUserImages({
            userId: profile.id,
            cursor: cursor || undefined,
            pageSize: IMAGE_PAGE_SIZE,
            category: category === "all" ? undefined : category,
            tags: tag === "all" ? undefined : [tag],
            searchText: keyword.trim() || undefined,
            compressPictureType: { compressType: 2 },
          });
          const nextImages = getSortedImages(
            resp.list.map((picture, index) => toImageItem(picture, index)),
            sort
          );
          imageCursorRef.current = resp.nextCursor;
          setImageHasMore(resp.hasMore && Boolean(resp.nextCursor));
          setImages((current) => (reset ? nextImages : [...current, ...nextImages]));
        } else {
          await sleep(320);
          const all = getFilteredMockImages(keyword, category, tag, sort);
          const start = cursor ? Number(cursor) : 0;
          const nextImages = all.slice(start, start + IMAGE_PAGE_SIZE);
          const nextCursor = start + nextImages.length;
          imageCursorRef.current = String(nextCursor);
          setImageHasMore(nextCursor < all.length);
          setImages((current) => (reset ? nextImages : [...current, ...nextImages]));
        }
      } catch (error) {
        const message =
          error instanceof ApiError ? error.message : "图片流加载失败";
        setImageError(message);
        if (reset) {
          const fallback = getFilteredMockImages(keyword, category, tag, sort).slice(
            0,
            IMAGE_PAGE_SIZE
          );
          setImages(fallback);
          imageCursorRef.current = String(fallback.length);
          setImageHasMore(fallback.length < MOCK_IMAGES.length);
        }
      } finally {
        imageLoadingRef.current = false;
        setImagesLoading(false);
      }
    },
    [category, imageHasMore, keyword, profile.id, profileSource, sort, tag]
  );

  useEffect(() => {
    imageCursorRef.current = "";
    setImageHasMore(true);
    setImages([]);
    void loadImages(true);
  }, [loadImages]);

  const loadTimeline = useCallback(async (reset = false) => {
    if (timelineLoadingRef.current || (!timelineHasMore && !reset)) return;

    timelineLoadingRef.current = true;
    setTimelineLoading(true);
    const cursor = reset ? "" : timelineCursorRef.current;

    try {
      const resp = await fetchTimelinePosts({
        cursor,
        pageSize: TIMELINE_PAGE_SIZE,
      });
      timelineCursorRef.current = resp.nextCursor;
      setTimelineHasMore(resp.hasMore);
      setTimelinePosts((current) => (reset ? resp.list : [...current, ...resp.list]));
    } finally {
      timelineLoadingRef.current = false;
      setTimelineLoading(false);
    }
  }, [timelineHasMore]);

  useEffect(() => {
    timelineCursorRef.current = "";
    setTimelineHasMore(true);
    setTimelinePosts([]);
    void loadTimeline(true);
  }, [loadTimeline]);

  useEffect(() => {
    const node = imageSentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadImages(false);
        }
      },
      { rootMargin: "560px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [loadImages]);

  useEffect(() => {
    const node = timelineSentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadTimeline(false);
        }
      },
      { rootMargin: "420px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [loadTimeline]);

  const setImageSentinel = useCallback((node: HTMLDivElement | null) => {
    imageSentinelRef.current = node;
  }, []);

  const setTimelineSentinel = useCallback((node: HTMLDivElement | null) => {
    timelineSentinelRef.current = node;
  }, []);

  const featuredImages = useMemo(() => {
    const source = images.length > 0 ? images : MOCK_IMAGES;
    return source.map((image, index) => ({ ...image, isFeatured: index < 8 }));
  }, [images]);

  async function handleToggleFollow() {
    if (following) {
      await unfollowUser(profile.id);
      setFollowing(false);
      setFollowerCount((count) => Math.max(0, count - 1));
      return;
    }

    await followUser(profile.id);
    setFollowing(true);
    setFollowerCount((count) => count + 1);
  }

  async function handlePublish(payload: CreatePostPayload) {
    setPublishing(true);
    try {
      const post = await createTimelinePost(payload);
      setTimelinePosts((current) => [post, ...current]);
      toast({
        title: "动态已发布",
        description: "新的创作记录已插入时间线顶部。",
        variant: "success",
      });
    } finally {
      setPublishing(false);
    }
  }

  async function handleLikePost(postId: string) {
    await likePost(postId);
    setTimelinePosts((current) =>
      current.map((post) =>
        post.id === postId
          ? {
              ...post,
              isLiked: !post.isLiked,
              likes: post.isLiked ? Math.max(0, post.likes - 1) : post.likes + 1,
            }
          : post
      )
    );
  }

  async function handleSaveSettings(payload: SettingsPayload) {
    setSavingSettings(true);
    try {
      if (profileSource === "api" && isAuthenticated) {
        const detail = await updateUserProfile({
          id: profile.id,
          userName: payload.username,
          userAvatar: payload.avatarUrl,
          userProfile: payload.bio,
        });
        setProfile({
          ...toProfile(detail),
          coverUrl: payload.coverUrl || profile.coverUrl,
          title: payload.title || profile.title,
          location: payload.location,
          socialLinks: payload.socialLinks,
        });
      } else {
        await sleep(420);
        setProfile((current) => ({
          ...current,
          username: payload.username,
          bio: payload.bio,
          avatarUrl: payload.avatarUrl,
          coverUrl: payload.coverUrl,
          location: payload.location,
          title: payload.title,
          socialLinks: payload.socialLinks,
        }));
      }
      setSettingsOpen(false);
      toast({
        title: "资料已保存",
        description: "账户主页展示已更新。",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "保存失败",
        description: error instanceof ApiError ? error.message : "请稍后重试。",
        variant: "destructive",
      });
    } finally {
      setSavingSettings(false);
    }
  }

  function handleToggleTheme() {
    const next = !darkMode;
    document.documentElement.classList.toggle("dark", next);
    setDarkMode(next);
  }

  function renderActivePanel() {
    if (activeTab === "featured") {
      return (
        <FeaturedGallery
          images={featuredImages}
          isOwner={isOwner}
          onPreview={setSelectedImage}
        />
      );
    }

    if (activeTab === "images") {
      return (
        <UserImageGrid
          images={images}
          loading={imagesLoading}
          error={imageError}
          hasMore={imageHasMore}
          keyword={keyword}
          category={category}
          tag={tag}
          sort={sort}
          sentinelRef={setImageSentinel}
          onKeywordChange={setKeyword}
          onCategoryChange={setCategory}
          onTagChange={setTag}
          onSortChange={setSort}
          onPreview={setSelectedImage}
          onRetry={() => void loadImages(true)}
        />
      );
    }

    if (activeTab === "timeline") {
      return (
        <TimelineSection
          isOwner={isOwner}
          posts={timelinePosts}
          loading={timelineLoading}
          hasMore={timelineHasMore}
          sentinelRef={setTimelineSentinel}
          composerImages={composerImages}
          publishing={publishing}
          onComposerImagesChange={setComposerImages}
          onPublish={handlePublish}
          onLike={handleLikePost}
          onPreview={setPreviewUrl}
        />
      );
    }

    if (activeTab === "achievements") {
      return (
        <div className="grid gap-5 lg:grid-cols-2">
          <ProfileBadgeWall badges={profile.badges} />
          <ProfileAchievementPanel achievements={MOCK_ACHIEVEMENTS} />
        </div>
      );
    }

    if (activeTab === "collections") {
      return <CollectionPreview collections={MOCK_COLLECTIONS} />;
    }

    return (
      <section className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
        <h2 className="text-xl font-semibold text-slate-950 dark:text-white">
          关于 {profile.username}
        </h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">
          {profile.bio}
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-[8px] bg-slate-50 p-4 dark:bg-white/5">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              当前称号
            </div>
            <div className="mt-1 font-medium text-slate-950 dark:text-white">
              {profile.title}
            </div>
          </div>
          <div className="rounded-[8px] bg-slate-50 p-4 dark:bg-white/5">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              常用分类
            </div>
            <div className="mt-1 font-medium text-slate-950 dark:text-white">
              街拍、风景、人像
            </div>
          </div>
          <div className="rounded-[8px] bg-slate-50 p-4 dark:bg-white/5">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              社交链接
            </div>
            <div className="mt-1 flex items-center gap-1 font-medium text-slate-950 dark:text-white">
              <LinkIcon className="size-4" />
              {profile.socialLinks?.[0]?.type ?? "Portfolio"}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div
      className="min-h-dvh bg-[oklch(0.985_0.006_248)] text-slate-900 dark:bg-[oklch(0.17_0.014_248)] dark:text-slate-100"
      style={
        {
          "--account-accent": "oklch(0.62 0.16 218)",
        } as CSSProperties
      }
    >
      <ProfileHero
        profile={profile}
        isOwner={isOwner}
        viewMode={viewMode}
        following={following}
        followerCount={followerCount}
        loading={profileLoading}
        onToggleFollow={() => void handleToggleFollow()}
        onOpenSettings={() => setSettingsOpen(true)}
        onViewModeChange={setViewMode}
      />
      <ProfileTabs activeTab={activeTab} onChange={setActiveTab} />
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:px-8">
        <aside className="space-y-5">
          {profileError ? (
            <div className="rounded-[8px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
              {profileError}
            </div>
          ) : null}
          <CreatorInsightPanel profile={profile} images={images} />
          <ProfileBadgeWall badges={profile.badges} />
          <ProfileAchievementPanel achievements={MOCK_ACHIEVEMENTS} />
        </aside>
        <div>{renderActivePanel()}</div>
      </div>
      <footer className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 rounded-[8px] border border-slate-200 bg-white p-5 text-sm text-slate-500 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-400 md:flex-row">
          <span>
            {profile.username} 于 {formatDate(profile.joinedAt)} 开始整理这份创作档案。
          </span>
          <Button
            type="button"
            variant="outline"
            className="rounded-[8px]"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            <ArrowUp className="size-4" />
            返回顶部
          </Button>
        </div>
      </footer>
      <ImagePreviewDialog
        image={selectedImage}
        imageUrl={previewUrl}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedImage(null);
            setPreviewUrl(null);
          }
        }}
      />
      <ProfileSettingsSheet
        open={settingsOpen}
        profile={profile}
        saving={savingSettings}
        darkMode={darkMode}
        onOpenChange={setSettingsOpen}
        onSave={handleSaveSettings}
        onToggleTheme={handleToggleTheme}
      />
    </div>
  );
}
