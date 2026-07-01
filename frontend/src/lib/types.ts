export interface UserDetail {
  id: string;
  userName: string;
  userAvatar: string;
  userProfile: string;
  userRole: string;
}

export interface PictureResponse {
  id: string;
  url: string;
  name: string;
  introduction: string;
  category: string;
  tags: string[];
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
  compressType: 0 | 1 | 2;
  cutWidth?: number;
  CutHeight?: number;
}

export interface PictureListReq {
  pageSize?: number;
  pageNum?: number;
  compressPictureType?: CompressPictureType;
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
