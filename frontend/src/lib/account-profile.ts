import type {
  DetailUserResponse,
  ImageItem,
  PictureResponse,
  UserProfile,
} from "./types";

export type AccountImageSort = "latest" | "hot" | "favorites";

export type AccountImageFilter = {
  keyword: string;
  category: string;
  tag: string;
  sort: AccountImageSort;
};

function parseTime(value: string) {
  const parsed = Date.parse(value.replace(" ", "T"));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function toAccountProfile(detail: DetailUserResponse): UserProfile {
  const accountUsername = detail.username?.trim() || "";
  const displayName =
    detail.nickname?.trim() ||
    detail.userName?.trim() ||
    accountUsername ||
    "用户";
  const role = (detail.role || detail.userRole || "user").trim().toLowerCase();
  const approvedCount =
    detail.publicMediaAssetCount ??
    detail.publicPictureCount ??
    detail.approvedMediaAssetCount ??
    detail.approvedPictureCount ??
    0;

  return {
    id: detail.id,
    username: displayName,
    accountUsername,
    email: "",
    handle: accountUsername ? `@${accountUsername}` : `@${detail.id}`,
    avatarUrl: detail.avatarUrl || detail.userAvatar || "",
    coverUrl: "",
    bio: detail.bio || detail.userProfile || "",
    role,
    title: role === "admin" ? "管理员" : "创作者",
    level: 0,
    location: "",
    joinedAt: detail.createdAt || detail.createTime || "",
    followers: 0,
    following: 0,
    likes: 0,
    imageCount: approvedCount,
    achievementCount: 0,
    badges: [],
    styleTags: [],
    socialLinks: [],
  };
}

export function toImageItem(picture: PictureResponse, index: number): ImageItem {
  const urls = picture.urls ?? {
    thumbnail: "",
    preview: "",
    detail: "",
    original: "",
  };
  const stats = picture.stats ?? {
    viewCount: 0,
    reactionCount: 0,
    favoriteCount: 0,
    commentCount: 0,
    shareCount: 0,
    downloadCount: 0,
  };

  return {
    id: picture.id,
    url:
      picture.thumbnailUrl ||
      urls.thumbnail ||
      urls.preview ||
      urls.detail ||
      urls.original ||
      picture.url,
    title: picture.title || picture.name || "未命名作品",
    description: picture.description || picture.introduction,
    category: picture.category || "未分类",
    tags: picture.tags ?? [],
    likes: stats.reactionCount ?? picture.likeCount ?? 0,
    favorites: stats.favoriteCount ?? 0,
    views: stats.viewCount ?? picture.viewCount ?? 0,
    createdAt: picture.createdAt || picture.createTime || picture.updateTime,
    uploadedAt: picture.createdAt || picture.createTime || picture.updateTime,
    isFeatured: index < 8,
    user: picture.user
      ? {
          id: picture.user.id,
          username: picture.user.nickname || picture.user.username || picture.user.userName || "用户",
          avatarUrl: picture.user.avatarUrl || picture.user.userAvatar,
          bio: picture.user.bio || picture.user.userProfile,
        }
      : undefined,
  };
}

export function getImageFilterOptions(images: ImageItem[]) {
  const categories = Array.from(
    new Set(images.map((image) => image.category).filter(Boolean))
  ).sort();
  const tags = Array.from(
    new Set(images.flatMap((image) => image.tags).filter(Boolean))
  ).sort();

  return {
    categories: ["all", ...categories],
    tags: ["all", ...tags],
  };
}

export function filterAndSortImages(
  images: ImageItem[],
  filter: AccountImageFilter
) {
  const keyword = filter.keyword.trim().toLowerCase();
  const filtered = images.filter((image) => {
    const matchesKeyword =
      keyword.length === 0 ||
      image.title.toLowerCase().includes(keyword) ||
      image.description?.toLowerCase().includes(keyword);
    const matchesCategory =
      filter.category === "all" || image.category === filter.category;
    const matchesTag = filter.tag === "all" || image.tags.includes(filter.tag);

    return matchesKeyword && matchesCategory && matchesTag;
  });

  return filtered.sort((left, right) => {
    if (filter.sort === "hot") {
      return right.likes + right.views - (left.likes + left.views);
    }
    if (filter.sort === "favorites") {
      return right.favorites - left.favorites;
    }
    return parseTime(right.createdAt) - parseTime(left.createdAt);
  });
}
