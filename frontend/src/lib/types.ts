export type PostType = "daily" | "travel_share";
export type PostTypeFilter = "all" | PostType;

export interface AccountSummary {
  id: string;
  username: string;
  email: string;
  nickname: string;
  avatarUrl: string;
  bio: string;
  status: string;
  role: string;
  isFollowing?: boolean;
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
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
}

export type DetailUserResponse = DetailAccountResponse;

export interface FollowTargetRequest {
  targetUserId: string;
}

export interface FollowStatusResponse {
  targetUserId: string;
  isFollowing: boolean;
  followerCount: number;
  followingCount: number;
}

export interface FollowListRequest {
  targetUserId?: string;
  cursor?: string;
  pageSize?: number;
}

export interface FollowUserListResponse {
  pageSize: number;
  hasMore: boolean;
  nextCursor: string;
  list: AccountSummary[];
}

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
  isLiked: boolean;
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

export interface GetMediaAssetRequest {
  id: string;
  variantOption?: MediaVariantRequest;
}

export interface GetPostDetailRequest {
  id: string;
}

export interface DownloadMediaAssetRequest {
  id: string;
}

export interface ToggleMediaReactionRequest {
  id: string;
  reactionType?: string;
}

export interface MediaAssetToggleResponse {
  active: boolean;
  stats: MediaAssetStats;
}

export interface MediaAssetDownloadResponse {
  url: string;
  filename: string;
  fileSize: number;
  stats: MediaAssetStats;
}

export interface MediaAssetDirectUploadInitRequest {
  id?: string;
  fileName: string;
  fileSize: number;
  contentType?: string;
  title?: string;
  description?: string;
  category?: string;
  tags?: string[];
  visibility?: string;
  assetUsage?: string;
  width?: number;
  height?: number;
  dominantColor?: string;
  blurHash?: string;
}

export interface MediaAssetDirectUploadInitResponse {
  sessionId: string;
  assetId: string;
  objectKey: string;
  uploadUrl: string;
  uploadMethod: "PUT" | string;
  uploadHeaders: Record<string, string>;
  expiresAt: string;
}

export interface MediaAssetDirectUploadCompleteRequest {
  sessionId: string;
  eTag?: string;
  width?: number;
  height?: number;
  dominantColor?: string;
  blurHash?: string;
}

export interface ProfilePostResponse {
  id: string;
  userId: string;
  content: string;
  postType: PostType;
  visibility: "public" | "private" | string;
  status: string;
  location: string;
  isPinned: boolean;
  pinnedAt: string;
  images: MediaAssetResponse[];
  stats: MediaAssetStats;
  likedBy: AccountSummary[];
  isLiked: boolean;
  isFavorited: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublicPostResponse extends ProfilePostResponse {
  author: AccountSummary;
}

export interface PublicPostCursorPageResponse {
  pageSize: number;
  hasMore: boolean;
  nextCursor: string;
  list: PublicPostResponse[];
}

export interface PublicPostListReq {
  cursor?: string;
  pageSize?: number;
  sort?: string;
  searchText?: string;
  postType?: PostTypeFilter;
  variantOption?: MediaVariantRequest;
}

export interface CreatePostRequest {
  content?: string;
  postType?: PostType;
  visibility?: string;
  location?: string;
  imageIds?: string[];
}

export interface UpdatePostRequest {
  id: string;
  content?: string;
  postType?: PostType;
  visibility?: string;
  location?: string;
  imageIds?: string[];
}

export interface PinPostRequest {
  id: string;
}

export interface UnpinPostRequest {
  id: string;
}

export interface PostToggleResponse {
  active: boolean;
  stats: MediaAssetStats;
  likedBy?: AccountSummary[];
}

export interface CreatePostCommentRequest {
  postId: string;
  content: string;
}

export interface PostCommentResponse {
  id: string;
  postId: string;
  userId: string;
  author: AccountSummary;
  content: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface PostCommentCursorListRequest {
  postId: string;
  cursor?: string;
  pageSize?: number;
}

export interface PostCommentCursorPageResponse {
  pageSize: number;
  hasMore: boolean;
  nextCursor: string;
  list: PostCommentResponse[];
}

export interface ProfilePostCursorPageResponse {
  pageSize: number;
  hasMore: boolean;
  nextCursor: string;
  list: ProfilePostResponse[];
}

export interface ForumBoardListRequest {
  pageSize?: number;
}

export interface ForumBoardResponse {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ForumBoardListResponse {
  list: ForumBoardResponse[];
}

export interface ForumPostListRequest {
  boardId?: string;
  cursor?: string;
  pageSize?: number;
  variantOption?: MediaVariantRequest;
}

export interface ForumPostResponse {
  post: PublicPostResponse;
  board: ForumBoardResponse;
  title: string;
  isLocked: boolean;
  isBoardPinned: boolean;
  lastActivityAt: string;
}

export interface ForumPostCursorPageResponse {
  pageSize: number;
  hasMore: boolean;
  nextCursor: string;
  list: ForumPostResponse[];
}

export interface CreateForumPostRequest {
  boardId: string;
  title: string;
  content?: string;
  location?: string;
  imageIds?: string[];
}

export interface FollowingPostListReq {
  cursor?: string;
  pageSize?: number;
  variantOption?: MediaVariantRequest;
}

export interface FollowingMediaListReq {
  cursor?: string;
  pageSize?: number;
  variantOption?: MediaVariantRequest;
}

export interface NotificationResponse {
  id: string;
  actorUserId: string;
  actor: AccountSummary;
  eventType: string;
  targetType: string;
  targetId: string;
  title: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationCursorPageResponse {
  pageSize: number;
  hasMore: boolean;
  nextCursor: string;
  list: NotificationResponse[];
}

export interface NotificationListReq {
  cursor?: string;
  pageSize?: number;
}

export interface UnreadNotificationCountResponse {
  unreadCount: number;
}

export interface MarkNotificationReadRequest {
  id: string;
}

export interface MarkAllNotificationsReadRequest {}

export interface CreateModerationReportRequest {
  targetType: "post" | "comment_record" | string;
  targetId: string;
  reason: string;
  description?: string;
}

export interface ModerationReportResponse {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  status: string;
  createdAt: string;
}

export interface AdminModerationReportQueryRequest {
  status?: string;
  targetType?: string;
  targetId?: string;
  reporterUserId?: string;
  createdAtFrom?: string;
  createdAtTo?: string;
  pageNum?: number;
  pageSize?: number;
}

export interface AdminModerationReportResolveRequest {
  id: string;
  resolution: "accepted" | "rejected" | "resolved";
  resolutionNote?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
}

export interface AdminModerationReportResponse {
  id: string;
  reporterUserId: string;
  reporter: AccountSummary;
  targetType: string;
  targetId: string;
  reason: string;
  description: string;
  status: string;
  handlerUserId: string;
  resolution: string;
  resolutionNote: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string;
}

export interface AdminModerationReportPageResponse {
  pageNum: number;
  pageSize: number;
  total: number;
  list: AdminModerationReportResponse[];
}

export interface AdminContentQueryRequest {
  targetType?: string;
  status?: string;
  userId?: string;
  searchText?: string;
  pageNum?: number;
  pageSize?: number;
}

export interface AdminContentResponse {
  id: string;
  targetType: string;
  author: AccountSummary;
  title: string;
  content: string;
  status: string;
  createdAt: string;
}

export interface AdminContentPageResponse {
  pageNum: number;
  pageSize: number;
  total: number;
  list: AdminContentResponse[];
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

export type GlobalSearchType = "media" | "post" | "album" | "user";

export interface GlobalSearchRequest {
  q?: string;
  types?: GlobalSearchType[];
  pageSize?: number;
  variantOption?: MediaVariantRequest;
  searchText?: string;
  compressType?: number;
}

export interface GlobalSearchPostResponse {
  id: string;
  userId: string;
  author: AccountSummary;
  content: string;
  postType: PostType;
  location: string;
  stats: MediaAssetStats;
  createdAt: string;
  updatedAt: string;
}

export interface GlobalSearchAlbumResponse {
  id: string;
  userId: string;
  author: AccountSummary;
  name: string;
  description: string;
  cover: MediaAssetResponse;
  createdAt: string;
  updatedAt: string;
}

export interface GlobalSearchResponse {
  q: string;
  types: GlobalSearchType[];
  pageSize: number;
  media: MediaAssetResponse[];
  posts: GlobalSearchPostResponse[];
  albums: GlobalSearchAlbumResponse[];
  users: AccountSummary[];
}

export interface GetHomepageConfigRequest {
  variantOption?: MediaVariantRequest;
}

export interface HomepageHeroConfig {
  /** Empty string means no hero is configured. */
  assetId: string;
  /** object-position percentages in [0,100]. */
  focalX: number;
  focalY: number;
  media: MediaAssetResponse | null;
}

export interface HomepageConfigResponse {
  hero: HomepageHeroConfig;
  featured: MediaAssetResponse[];
}

export interface UpdateHomepageHeroRequest {
  /** Empty/omitted assetId clears the hero selection. */
  assetId?: string;
  focalX?: number;
  focalY?: number;
}

export interface UpdateHomepageFeaturedRequest {
  mediaAssetIds?: string[];
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
  sort?: string;
}

export interface AdminQueryMediaAssetRequest extends MediaAssetListReq {
  createdAtFrom?: string;
  createdAtTo?: string;
}

export interface ReviewMediaAssetRequest {
  id: string;
  auditStatus: "approved" | "rejected" | string;
  reviewMessage?: string;
}

export interface AdminModeratePostRequest {
  id: string;
  reason?: string;
  reportId?: string;
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
  role: string;
  title: string;
  level: number;
  location?: string;
  joinedAt: string;
  followers: number;
  following: number;
  isFollowing: boolean;
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
