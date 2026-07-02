export interface UserDetail {
  id: string;
  userEmail?: string;
  userName: string;
  userAvatar: string;
  userProfile: string;
  userRole: string;
}

export interface AuthUser {
  id: string;
  userEmail: string;
  userName: string;
  userAvatar: string;
  userProfile: string;
  userRole: string;
  createTime: string;
  updateTime: string;
}

export interface DetailUserResponse extends AuthUser {
  pictureCount: number;
  approvedPictureCount: number;
  pendingPictureCount: number;
  rejectedPictureCount: number;
}

export interface LoginRequest {
  userEmail: string;
  userPassword: string;
}

export interface LoginResponse extends AuthUser {
  token: string;
}

export interface RegisterRequest {
  userEmail: string;
  userPassword: string;
  userCheckPassword: string;
}

export interface RegisterResponse {
  id: string;
}

export interface UpdateUserRequest {
  id: string;
  userName?: string;
  userEmail?: string;
  userPassword?: string;
  userAvatar?: string;
  userProfile?: string;
}

export interface PictureResponse {
  id: string;
  url: string;
  name: string;
  introduction: string;
  category: string;
  tags: string[] | null;
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
  reviewMessage: string;
  reviewerId: string;
  reviewTime: string;
  thumbnailUrl: string;
  picColor: string;
  blurHash: string;
  viewCount: number;
  likeCount: number;
}

export interface PictureCursorPageResponse {
  pageSize: number;
  hasMore: boolean;
  nextCursor: string;
  list: PictureResponse[];
}

export interface PicturePageResponse {
  pageNum: number;
  pageSize: number;
  total: number;
  list: PictureResponse[];
}

export interface CompressPictureType {
  compressType: 0 | 1 | 2 | 3;
  cutWidth?: number;
  CutHeight?: number;
}

export interface PictureListReq {
  pageSize?: number;
  pageNum?: number;
  compressPictureType?: CompressPictureType;
  userId?: string;
  category?: string;
  tags?: string[];
  searchText?: string;
}

export interface PictureCursorListReq extends PictureListReq {
  cursor?: string;
}

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
