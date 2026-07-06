export interface AccountSummary {
  id: string;
  username: string;
  email: string;
  nickname: string;
  avatarUrl: string;
  bio: string;
  status: string;
  role: string;
  userEmail?: string;
  userName?: string;
  userAvatar?: string;
  userProfile?: string;
  userRole?: string;
}

export type UserDetail = AccountSummary;

export interface AuthUser extends AccountSummary {
  id: string;
  username: string;
  email: string;
  phone?: string;
  nickname: string;
  avatarUrl: string;
  bio: string;
  status: string;
  role: string;
  createdAt: string;
  updatedAt: string;
  userEmail: string;
  userName: string;
  userAvatar: string;
  userProfile: string;
  userRole: string;
  createTime: string;
  updateTime: string;
}

export interface DetailAccountResponse extends AuthUser {
  mediaAssetCount: number;
  publicMediaAssetCount: number;
  approvedMediaAssetCount: number;
  pendingMediaAssetCount: number;
  rejectedMediaAssetCount: number;
  pictureCount: number;
  publicPictureCount: number;
  approvedPictureCount: number;
  pendingPictureCount: number;
  rejectedPictureCount: number;
}

export type DetailUserResponse = DetailAccountResponse;

export interface LoginRequest {
  userEmail: string;
  userPassword: string;
  email?: string;
  password?: string;
}

export interface LoginResponse extends AuthUser {
  token: string;
}

export interface RegisterRequest {
  userEmail: string;
  userPassword: string;
  userCheckPassword: string;
  username?: string;
  email?: string;
  password?: string;
  checkPassword?: string;
}

export interface RegisterResponse {
  id: string;
}

export interface UpdateUserRequest {
  id: string;
  username?: string;
  email?: string;
  password?: string;
  nickname?: string;
  avatarUrl?: string;
  bio?: string;
  userName?: string;
  userEmail?: string;
  userPassword?: string;
  userAvatar?: string;
  userProfile?: string;
}

export interface MediaAssetUrls {
  thumbnail: string;
  preview: string;
  detail: string;
  original: string;
}

export interface MediaAssetStats {
  viewCount: number;
  reactionCount: number;
  favoriteCount: number;
  commentCount: number;
  shareCount: number;
  downloadCount: number;
}

export interface MediaAssetPermissions {
  canViewOriginal?: boolean;
  canDownload?: boolean;
}

export interface MediaAssetResponse {
  id: string;
  mediaType: string;
  assetUsage: string;
  title: string;
  description: string;
  category: string;
  tags: string[] | null;
  ownerUserId: string;
  owner: AccountSummary | null;
  originalFilename: string;
  visibility: string;
  status: string;
  auditStatus: string;
  reviewMessage: string;
  reviewerId: string;
  reviewTime: string;
  fileSize: number;
  width: number;
  height: number;
  aspectRatio: number;
  mimeType: string;
  fileExt: string;
  dominantColor: string;
  blurHash: string;
  urls: MediaAssetUrls;
  stats: MediaAssetStats;
  permissions?: MediaAssetPermissions;
  metadataJson: string;
  createdAt: string;
  updatedAt: string;
  url: string;
  name: string;
  introduction: string;
  picSize: number;
  picWidth: number;
  picHeight: number;
  picScale: number;
  picFormat: string;
  userId: string;
  user: UserDetail | null;
  createTime: string;
  editTime: string;
  updateTime: string;
  reviewStatus: number;
  thumbnailUrl: string;
  picColor: string;
  viewCount: number;
  likeCount: number;
}

export type PictureResponse = MediaAssetResponse;

export interface MediaAssetCursorPageResponse {
  pageSize: number;
  hasMore: boolean;
  nextCursor: string;
  list: MediaAssetResponse[];
}

export type PictureCursorPageResponse = MediaAssetCursorPageResponse;

export interface MediaAssetPageResponse {
  pageNum: number;
  pageSize: number;
  total: number;
  list: MediaAssetResponse[];
}

export type PicturePageResponse = MediaAssetPageResponse;

export interface ProfilePostResponse {
  id: string;
  userId: string;
  content: string;
  visibility: "public" | "private" | string;
  status: string;
  location: string;
  isPinned: boolean;
  pinnedAt: string;
  images: MediaAssetResponse[];
  stats: MediaAssetStats;
  isLiked: boolean;
  isFavorited: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePostRequest {
  content?: string;
  visibility?: string;
  location?: string;
  imageIds?: string[];
}

export interface PostToggleResponse {
  active: boolean;
  stats: MediaAssetStats;
}

export interface ProfilePostCursorPageResponse {
  pageSize: number;
  hasMore: boolean;
  nextCursor: string;
  list: ProfilePostResponse[];
}

export interface ProfileAlbumResponse {
  id: string;
  userId: string;
  name: string;
  description: string;
  cover: MediaAssetResponse;
  itemCount: number;
  visibility: "public" | "followers" | "private" | "unlisted" | string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileAlbumPageResponse {
  pageNum: number;
  pageSize: number;
  total: number;
  list: ProfileAlbumResponse[];
}

export interface OverviewStatsResponse {
  publicMediaAssetCount: number;
  creatorCount: number;
  publicPostCount: number;
  publicAlbumCount: number;
}

export interface MediaVariantRequest {
  compressType: 0 | 1 | 2 | 3;
  cutWidth?: number;
  cutHeight?: number;
}

export interface MediaAssetUploadByUrlRequest {
  id?: string;
  fileUrl: string;
  title?: string;
  description?: string;
  category?: string;
  tags?: string[];
  visibility?: string;
  assetUsage?: string;
}

export type CompressPictureType = MediaVariantRequest & {
  CutHeight?: number;
};

export interface MediaAssetListReq {
  pageSize?: number;
  pageNum?: number;
  variantOption?: MediaVariantRequest;
  ownerUserId?: string;
  category?: string;
  tags?: string[];
  searchText?: string;
  auditStatus?: string;
}

export interface ProfilePostListReq {
  userId?: string;
  cursor?: string;
  pageSize?: number;
}

export interface ProfileFeaturedMediaListReq {
  userId?: string;
  pageSize?: number;
  variantOption?: MediaVariantRequest;
}

export interface UpdateProfileFeaturedMediaReq {
  mediaAssetIds?: string[];
}

export interface ProfileAlbumListReq {
  userId?: string;
  pageNum?: number;
  pageSize?: number;
}

export type PictureListReq = MediaAssetListReq & {
  compressPictureType?: CompressPictureType;
  userId?: string;
};

export interface MediaAssetCursorListReq extends MediaAssetListReq {
  cursor?: string;
}

export type PictureCursorListReq = PictureListReq & {
  cursor?: string;
};

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export type BadgeRarity = "common" | "rare" | "epic" | "legendary";

export interface BadgeItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: BadgeRarity;
  achievedAt: string;
}

export interface AchievementItem {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  completed: boolean;
}

export interface SocialLink {
  type: string;
  url: string;
}

export interface UserProfile {
  id: string;
  username: string;
  accountUsername?: string;
  email?: string;
  handle: string;
  avatarUrl: string;
  coverUrl: string;
  bio: string;
  title: string;
  level: number;
  location?: string;
  joinedAt: string;
  followers: number;
  following: number;
  likes: number;
  imageCount: number;
  achievementCount: number;
  badges: BadgeItem[];
  styleTags: string[];
  socialLinks?: SocialLink[];
}

export interface ImageItem {
  id: string;
  url: string;
  title: string;
  description?: string;
  category: string;
  tags: string[];
  likes: number;
  favorites: number;
  views: number;
  createdAt: string;
  isFeatured?: boolean;
  user?: {
    id: string;
    username: string;
    avatarUrl?: string;
    bio?: string;
  };
  uploadedAt?: string;
}

export interface TimelinePost {
  id: string;
  content: string;
  images: string[];
  tags: string[];
  createdAt: string;
  likes: number;
  comments: number;
  shares: number;
  isLiked: boolean;
  isPinned?: boolean;
  visibility: "public" | "followers" | "private";
}
