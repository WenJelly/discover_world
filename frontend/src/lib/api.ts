import type {
  AccountSummary,
  ApiResponse,
  CreatePostRequest,
  DetailAccountResponse,
  DetailUserResponse,
  GetMediaAssetRequest,
  GetHomepageConfigRequest,
  GlobalSearchRequest,
  GlobalSearchResponse,
  HomepageConfigResponse,
  LoginRequest,
  LoginResponse,
  MediaAssetDirectUploadCompleteRequest,
  MediaAssetDirectUploadInitResponse,
  MediaAssetCursorListReq,
  MediaAssetCursorPageResponse,
  MediaAssetListReq,
  MediaAssetPageResponse,
  MediaAssetResponse,
  MediaAssetToggleResponse,
  OverviewStatsResponse,
  PictureCursorListReq,
  PictureCursorPageResponse,
  PictureListReq,
  PicturePageResponse,
  PostToggleResponse,
  ProfileAlbumListReq,
  ProfileAlbumPageResponse,
  ProfileFeaturedMediaListReq,
  ProfilePostCursorPageResponse,
  ProfilePostListReq,
  ProfilePostResponse,
  RegisterRequest,
  RegisterResponse,
  ToggleMediaReactionRequest,
  UpdateHomepageFeaturedRequest,
  UpdateHomepageHeroRequest,
  UpdatePostRequest,
  UpdateProfileFeaturedMediaReq,
  UpdateUserRequest,
} from "./types";
import {
  buildAccountAvatarUploadFormData,
  buildMediaAssetDirectUploadInitRequest,
  buildMediaAssetUrlUploadRequest,
  type MediaDirectUploadImageMetadata,
  type MediaUploadMetadata,
} from "./media-upload";
import {
  isTokenUsable,
  notifyAuthExpired,
  TOKEN_KEY,
} from "./auth-session";
import {
  normalizeApiErrorMessage,
  type ApiErrorContext,
} from "./api-error";

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8888";
const REQUEST_TIMEOUT_MS = 12_000;
const UPLOAD_REQUEST_TIMEOUT_MS = 60_000;
const DIRECT_OBJECT_UPLOAD_TIMEOUT_MS = 5 * 60_000;

export class ApiError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

type RequestOptions = {
  requireAuth?: boolean;
  timeoutMs?: number;
  errorContext?: ApiErrorContext;
};

function isWrappedResponse<T>(value: unknown): value is ApiResponse<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ApiResponse<T>).code === "number" &&
    "message" in value
  );
}

async function request<T>(
  path: string,
  body: unknown,
  options: RequestOptions = {}
): Promise<T> {
  const errorContext = options.errorContext ?? "request";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options.requireAuth) {
    const token = getToken();
    if (!token || !isTokenUsable(token)) {
      const message = "登录已过期，请重新登录";
      notifyAuthExpired(message);
      throw new ApiError(401, message);
    }

    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, options.timeoutMs ?? REQUEST_TIMEOUT_MS);

  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (
      error instanceof DOMException &&
      error.name === "AbortError"
    ) {
      throw new ApiError(
        0,
        normalizeApiErrorMessage("服务响应超时", errorContext)
      );
    }

    throw new ApiError(0, "服务暂时不可用,请稍后重试");
  } finally {
    window.clearTimeout(timeoutId);
  }

  let json: ApiResponse<T> | T | null = null;
  try {
    json = (await res.json()) as ApiResponse<T> | T;
  } catch {
    if (res.status === 401) {
      const message = "登录已过期，请重新登录";
      notifyAuthExpired(message);
      throw new ApiError(401, message);
    }

    throw new ApiError(0, "服务暂时不可用,请稍后重试");
  }

  if (isWrappedResponse<T>(json) && (res.status === 401 || json.code === 401)) {
    const message = json.message || "登录已过期，请重新登录";
    notifyAuthExpired(message);
    throw new ApiError(401, message);
  }

  if (isWrappedResponse<T>(json)) {
    if (json.code !== 200) {
      throw new ApiError(
        json.code,
        normalizeApiErrorMessage(json.message, errorContext)
      );
    }
    return json.data;
  }

  if (!res.ok) {
    throw new ApiError(res.status, "服务暂时不可用,请稍后重试");
  }
  return json as T;
}

async function requestFormData<T>(
  path: string,
  body: FormData,
  options: RequestOptions = {}
): Promise<T> {
  const errorContext = options.errorContext ?? "upload";
  const headers: Record<string, string> = {};
  if (options.requireAuth) {
    const token = getToken();
    if (!token || !isTokenUsable(token)) {
      const message = "登录已过期，请重新登录";
      notifyAuthExpired(message);
      throw new ApiError(401, message);
    }

    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, UPLOAD_REQUEST_TIMEOUT_MS);

  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(
        0,
        normalizeApiErrorMessage("上传超时", errorContext)
      );
    }

    throw new ApiError(0, "服务暂时不可用,请稍后重试");
  } finally {
    window.clearTimeout(timeoutId);
  }

  let json: ApiResponse<T> | T | null = null;
  try {
    json = (await res.json()) as ApiResponse<T> | T;
  } catch {
    if (res.status === 401) {
      const message = "登录已过期，请重新登录";
      notifyAuthExpired(message);
      throw new ApiError(401, message);
    }

    throw new ApiError(0, "服务暂时不可用,请稍后重试");
  }

  if (isWrappedResponse<T>(json) && (res.status === 401 || json.code === 401)) {
    const message = json.message || "登录已过期，请重新登录";
    notifyAuthExpired(message);
    throw new ApiError(401, message);
  }

  if (isWrappedResponse<T>(json)) {
    if (json.code !== 200) {
      throw new ApiError(
        json.code,
        normalizeApiErrorMessage(json.message, errorContext)
      );
    }
    return json.data;
  }

  if (!res.ok) {
    throw new ApiError(res.status, "服务暂时不可用,请稍后重试");
  }
  return json as T;
}

async function readDirectUploadImageMetadata(
  file: File
): Promise<MediaDirectUploadImageMetadata> {
  if (
    typeof URL === "undefined" ||
    typeof URL.createObjectURL !== "function" ||
    typeof Image === "undefined"
  ) {
    return {};
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise<MediaDirectUploadImageMetadata>((resolve) => {
      const image = new Image();
      image.onload = () => {
        resolve({
          width: image.naturalWidth || image.width,
          height: image.naturalHeight || image.height,
        });
      };
      image.onerror = () => resolve({});
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function uploadDirectObject(
  file: File,
  upload: MediaAssetDirectUploadInitResponse
): Promise<string> {
  const headers = new Headers(upload.uploadHeaders ?? {});
  if (!headers.has("Content-Type") && file.type) {
    headers.set("Content-Type", file.type);
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, DIRECT_OBJECT_UPLOAD_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(upload.uploadUrl, {
      method: upload.uploadMethod || "PUT",
      headers,
      body: file,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(
        0,
        normalizeApiErrorMessage("上传超时", "upload")
      );
    }
    throw new ApiError(0, "上传对象存储失败，请稍后重试");
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (!res.ok) {
    throw new ApiError(res.status, "上传对象存储失败，请检查存储桶 CORS 配置");
  }

  return res.headers.get("ETag") ?? "";
}

function normalizeAccountSummary(account: AccountSummary | null | undefined): AccountSummary | null {
  if (!account) return null;
  const userEmail = account.email || account.userEmail || "";
  const userName = account.nickname || account.username || account.userName || userEmail;
  return {
    ...account,
    username: account.username || account.userName || userName,
    email: userEmail,
    nickname: account.nickname || userName,
    avatarUrl: account.avatarUrl || account.userAvatar || "",
    bio: account.bio || account.userProfile || "",
    status: account.status || "active",
    role: account.role || account.userRole || "user",
    userEmail,
    userName,
    userAvatar: account.avatarUrl || account.userAvatar || "",
    userProfile: account.bio || account.userProfile || "",
    userRole: account.role || account.userRole || "user",
  };
}

function normalizeAccount<T extends DetailAccountResponse | LoginResponse>(account: T): T {
  const normalized = normalizeAccountSummary(account);
  const mediaAssetCount = "mediaAssetCount" in account ? account.mediaAssetCount : 0;
  const approvedMediaAssetCount =
    "approvedMediaAssetCount" in account ? account.approvedMediaAssetCount : 0;
  const pendingMediaAssetCount =
    "pendingMediaAssetCount" in account ? account.pendingMediaAssetCount : 0;
  const rejectedMediaAssetCount =
    "rejectedMediaAssetCount" in account ? account.rejectedMediaAssetCount : 0;
  const publicMediaAssetCount =
    "publicMediaAssetCount" in account
      ? account.publicMediaAssetCount
      : approvedMediaAssetCount;

  return {
    ...account,
    ...(normalized ?? {}),
    phone: account.phone || "",
    createdAt: account.createdAt || account.createTime || "",
    updatedAt: account.updatedAt || account.updateTime || "",
    createTime: account.createdAt || account.createTime || "",
    updateTime: account.updatedAt || account.updateTime || "",
    mediaAssetCount,
    publicMediaAssetCount,
    approvedMediaAssetCount,
    pendingMediaAssetCount,
    rejectedMediaAssetCount,
    pictureCount: mediaAssetCount,
    publicPictureCount: publicMediaAssetCount,
    approvedPictureCount: approvedMediaAssetCount,
    pendingPictureCount: pendingMediaAssetCount,
    rejectedPictureCount: rejectedMediaAssetCount,
  } as T;
}

function auditStatusToLegacy(status: string): number {
  switch (status) {
    case "approved":
      return 1;
    case "rejected":
      return 2;
    default:
      return 0;
  }
}

function normalizeMediaAsset(asset: MediaAssetResponse): MediaAssetResponse {
  const urls = asset.urls ?? { thumbnail: "", preview: "", detail: "", original: "" };
  const stats = asset.stats ?? {
    viewCount: 0,
    reactionCount: 0,
    favoriteCount: 0,
    commentCount: 0,
    shareCount: 0,
    downloadCount: 0,
  };
  const owner = normalizeAccountSummary(asset.owner);
  const url = urls.original || urls.detail || urls.preview || urls.thumbnail || asset.url || "";

  return {
    ...asset,
    urls,
    stats,
    owner,
    title: asset.title || asset.name || "未命名作品",
    description: asset.description || asset.introduction || "",
    assetUsage: asset.assetUsage || "work",
    tags: asset.tags ?? [],
    ownerUserId: asset.ownerUserId || asset.userId || "",
    isLiked: asset.isLiked ?? false,
    url,
    name: asset.title || asset.name || "未命名作品",
    introduction: asset.description || asset.introduction || "",
    picSize: asset.fileSize ?? asset.picSize ?? 0,
    picWidth: asset.width ?? asset.picWidth ?? 0,
    picHeight: asset.height ?? asset.picHeight ?? 0,
    picScale: asset.aspectRatio ?? asset.picScale ?? 0,
    picFormat: asset.fileExt ?? asset.picFormat ?? "",
    userId: asset.ownerUserId || asset.userId || "",
    user: owner,
    createTime: asset.createdAt || asset.createTime || "",
    editTime: asset.updatedAt || asset.editTime || "",
    updateTime: asset.updatedAt || asset.updateTime || "",
    reviewStatus: auditStatusToLegacy(asset.auditStatus),
    thumbnailUrl: urls.thumbnail || urls.preview || url,
    picColor: asset.dominantColor || asset.picColor || "",
    viewCount: stats.viewCount ?? asset.viewCount ?? 0,
    likeCount: stats.reactionCount ?? asset.likeCount ?? 0,
  };
}

function normalizeMediaAssetPage<T extends MediaAssetPageResponse | MediaAssetCursorPageResponse>(page: T): T {
  return {
    ...page,
    list: (page.list ?? []).map(normalizeMediaAsset),
  };
}

function normalizeProfilePost(post: ProfilePostResponse): ProfilePostResponse {
  return {
    ...post,
    images: (post.images ?? []).map(normalizeMediaAsset),
    stats: post.stats ?? {
      viewCount: 0,
      reactionCount: 0,
      favoriteCount: 0,
      commentCount: 0,
      shareCount: 0,
      downloadCount: 0,
    },
    isLiked: post.isLiked ?? false,
    isFavorited: post.isFavorited ?? false,
  };
}

function normalizeProfilePostPage(
  page: ProfilePostCursorPageResponse
): ProfilePostCursorPageResponse {
  return {
    ...page,
    list: (page.list ?? []).map(normalizeProfilePost),
  };
}

function normalizeProfileAlbumPage(
  page: ProfileAlbumPageResponse
): ProfileAlbumPageResponse {
  return {
    ...page,
    list: (page.list ?? []).map((album) => ({
      ...album,
      cover: album.cover?.id ? normalizeMediaAsset(album.cover) : album.cover,
    })),
  };
}

function clampFocalPercent(value: unknown): number {
  const num = typeof value === "number" && Number.isFinite(value) ? value : 50;
  return Math.min(100, Math.max(0, num));
}

function normalizeHomepageConfig(
  resp: HomepageConfigResponse
): HomepageConfigResponse {
  const hero = resp.hero ?? {
    assetId: "",
    focalX: 50,
    focalY: 50,
    media: null,
  };
  const assetId = hero.assetId ?? "";
  const media = assetId && hero.media?.id ? normalizeMediaAsset(hero.media) : null;

  return {
    hero: {
      // A configured hero whose media can no longer be resolved (deleted or
      // withdrawn) is reported as unset so callers can fall back safely.
      assetId: media ? assetId : "",
      focalX: clampFocalPercent(hero.focalX),
      focalY: clampFocalPercent(hero.focalY),
      media,
    },
    featured: (resp.featured ?? []).map(normalizeMediaAsset),
  };
}

function normalizeGlobalSearchResponse(
  resp: GlobalSearchResponse
): GlobalSearchResponse {
  return {
    ...resp,
    media: (resp.media ?? []).map(normalizeMediaAsset),
    posts: resp.posts ?? [],
    albums: (resp.albums ?? []).map((album) => ({
      ...album,
      cover: album.cover?.id ? normalizeMediaAsset(album.cover) : album.cover,
    })),
    users: (resp.users ?? [])
      .map((user) => normalizeAccountSummary(user))
      .filter((user): user is AccountSummary => Boolean(user)),
  };
}

function toMediaListReq(req: PictureListReq | MediaAssetListReq): MediaAssetListReq {
  const legacy = req as PictureListReq;
  const compress = legacy.compressPictureType;
  return {
    ...req,
    ownerUserId: (req as MediaAssetListReq).ownerUserId || legacy.userId,
    variantOption:
      (req as MediaAssetListReq).variantOption ||
      (compress
        ? {
            compressType: compress.compressType,
            cutWidth: compress.cutWidth,
            cutHeight: compress.cutHeight ?? compress.CutHeight,
          }
        : undefined),
  };
}

export async function fetchMediaAssetList(
  req: MediaAssetListReq
): Promise<MediaAssetPageResponse> {
  const page = await request<MediaAssetPageResponse>("/api/media/list", req);
  return normalizeMediaAssetPage(page);
}

export async function fetchMediaAssetCursorList(
  req: MediaAssetCursorListReq
): Promise<MediaAssetCursorPageResponse> {
  const page = await request<MediaAssetCursorPageResponse>(
    "/api/media/list/cursor",
    req
  );
  return normalizeMediaAssetPage(page);
}

export function fetchPictureList(
  req: PictureListReq
): Promise<PicturePageResponse> {
  return fetchMediaAssetList(toMediaListReq(req));
}

export function fetchPictureCursorList(
  req: PictureCursorListReq
): Promise<PictureCursorPageResponse> {
  return fetchMediaAssetCursorList({
    ...toMediaListReq(req),
    cursor: req.cursor,
  });
}

export function globalSearch(
  req: GlobalSearchRequest
): Promise<GlobalSearchResponse> {
  return request<GlobalSearchResponse>("/api/search", req).then(
    normalizeGlobalSearchResponse
  );
}

export async function fetchHomepageConfig(
  req: GetHomepageConfigRequest = {}
): Promise<HomepageConfigResponse> {
  const resp = await request<HomepageConfigResponse>("/api/homepage/config", req);
  return normalizeHomepageConfig(resp);
}

export async function updateHomepageHero(
  req: UpdateHomepageHeroRequest
): Promise<HomepageConfigResponse> {
  const resp = await request<HomepageConfigResponse>(
    "/api/admin/homepage/hero/update",
    {
      assetId: req.assetId ?? "",
      focalX: clampFocalPercent(req.focalX),
      focalY: clampFocalPercent(req.focalY),
    },
    { requireAuth: true }
  );
  return normalizeHomepageConfig(resp);
}

export async function updateHomepageFeatured(
  req: UpdateHomepageFeaturedRequest
): Promise<HomepageConfigResponse> {
  const resp = await request<HomepageConfigResponse>(
    "/api/admin/homepage/featured/update",
    { mediaAssetIds: req.mediaAssetIds ?? [] },
    { requireAuth: true }
  );
  return normalizeHomepageConfig(resp);
}

export function fetchUserImages(
  req: PictureCursorListReq & { userId: string }
): Promise<PictureCursorPageResponse> {
  return fetchPictureCursorList({
    ...req,
    userId: req.userId,
  });
}

export function fetchOverviewStats(): Promise<OverviewStatsResponse> {
  return request<OverviewStatsResponse>("/api/overview/stats", {});
}

export async function deleteMediaAsset(
  id: string,
  options: { force?: boolean } = {}
): Promise<void> {
  return request<void>(
    "/api/media/delete",
    { id, force: options.force ?? false },
    { requireAuth: true }
  );
}

export async function fetchMediaAssetDetail(
  req: GetMediaAssetRequest
): Promise<MediaAssetResponse> {
  const resp = await request<MediaAssetResponse>("/api/media/detail", req, {
    requireAuth: true,
  });
  return normalizeMediaAsset(resp);
}

export async function toggleMediaReaction(
  req: ToggleMediaReactionRequest
): Promise<MediaAssetToggleResponse> {
  return request<MediaAssetToggleResponse>(
    "/api/media/reaction/toggle",
    { id: req.id, reactionType: req.reactionType ?? "like" },
    { requireAuth: true }
  );
}

export async function uploadMediaAsset(
  file: File,
  metadata: MediaUploadMetadata = {}
): Promise<MediaAssetResponse> {
  const imageMetadata = await readDirectUploadImageMetadata(file);
  const upload = await request<MediaAssetDirectUploadInitResponse>(
    "/api/media/upload/direct/init",
    buildMediaAssetDirectUploadInitRequest(file, metadata, imageMetadata),
    {
      requireAuth: true,
      timeoutMs: UPLOAD_REQUEST_TIMEOUT_MS,
      errorContext: "upload",
    }
  );

  const eTag = await uploadDirectObject(file, upload);
  const completeRequest: MediaAssetDirectUploadCompleteRequest = {
    sessionId: upload.sessionId,
    eTag,
    width: imageMetadata.width,
    height: imageMetadata.height,
    dominantColor: imageMetadata.dominantColor,
    blurHash: imageMetadata.blurHash,
  };
  const resp = await request<MediaAssetResponse>(
    "/api/media/upload/direct/complete",
    completeRequest,
    {
      requireAuth: true,
      timeoutMs: UPLOAD_REQUEST_TIMEOUT_MS,
      errorContext: "upload",
    }
  );
  return normalizeMediaAsset(resp);
}

export async function uploadMediaAssetByUrl(
  fileUrl: string,
  metadata: MediaUploadMetadata = {}
): Promise<MediaAssetResponse> {
  const resp = await request<MediaAssetResponse>(
    "/api/media/upload/url",
    buildMediaAssetUrlUploadRequest(fileUrl, metadata),
    {
      requireAuth: true,
      timeoutMs: UPLOAD_REQUEST_TIMEOUT_MS,
      errorContext: "upload",
    }
  );
  return normalizeMediaAsset(resp);
}

export async function uploadAccountAvatar(file: File): Promise<DetailUserResponse> {
  const resp = await requestFormData<DetailAccountResponse>(
    "/api/account/avatar/upload",
    buildAccountAvatarUploadFormData(file),
    { requireAuth: true }
  );
  return normalizeAccount(resp);
}

export async function fetchProfilePostCursorList(
  req: ProfilePostListReq
): Promise<ProfilePostCursorPageResponse> {
  const page = await request<ProfilePostCursorPageResponse>(
    "/api/profile/post/list/cursor",
    req,
    { requireAuth: true }
  );
  return normalizeProfilePostPage(page);
}

export async function createPost(
  req: CreatePostRequest
): Promise<ProfilePostResponse> {
  const resp = await request<ProfilePostResponse>("/api/post/create", req, {
    requireAuth: true,
  });
  return normalizeProfilePost(resp);
}

export async function updatePost(
  req: UpdatePostRequest
): Promise<ProfilePostResponse> {
  const resp = await request<ProfilePostResponse>("/api/post/update", req, {
    requireAuth: true,
  });
  return normalizeProfilePost(resp);
}

export async function deletePost(id: string): Promise<void> {
  return request<void>("/api/post/delete", { id }, { requireAuth: true });
}

export async function togglePostReaction(
  id: string,
  reactionType: string = "like"
): Promise<PostToggleResponse> {
  return request<PostToggleResponse>(
    "/api/post/reaction/toggle",
    { id, reactionType },
    { requireAuth: true }
  );
}

export async function togglePostFavorite(
  id: string
): Promise<PostToggleResponse> {
  return request<PostToggleResponse>(
    "/api/post/favorite/toggle",
    { id },
    { requireAuth: true }
  );
}

export async function fetchProfileFeaturedMediaList(
  req: ProfileFeaturedMediaListReq
): Promise<MediaAssetPageResponse> {
  const page = await request<MediaAssetPageResponse>(
    "/api/profile/featured/media/list",
    req,
    { requireAuth: true }
  );
  return normalizeMediaAssetPage(page);
}

export async function updateProfileFeaturedMedia(
  req: UpdateProfileFeaturedMediaReq
): Promise<MediaAssetPageResponse> {
  const page = await request<MediaAssetPageResponse>(
    "/api/profile/featured/media/update",
    req,
    { requireAuth: true }
  );
  return normalizeMediaAssetPage(page);
}

export async function fetchProfileAlbumList(
  req: ProfileAlbumListReq
): Promise<ProfileAlbumPageResponse> {
  const page = await request<ProfileAlbumPageResponse>(
    "/api/profile/album/list",
    req,
    { requireAuth: true }
  );
  return normalizeProfileAlbumPage(page);
}

export async function loginUser(req: LoginRequest): Promise<LoginResponse> {
  const resp = await request<LoginResponse>("/api/account/login", {
    email: req.email ?? req.userEmail,
    password: req.password ?? req.userPassword,
  });
  return normalizeAccount(resp);
}

export async function registerUser(
  req: RegisterRequest
): Promise<RegisterResponse> {
  return request<RegisterResponse>("/api/account/register", {
    username: req.username,
    email: req.email ?? req.userEmail,
    password: req.password ?? req.userPassword,
    checkPassword: req.checkPassword ?? req.userCheckPassword,
  });
}

export async function fetchUserProfile(
  req: { id?: string; userEmail?: string } = {}
): Promise<DetailUserResponse> {
  const resp = await request<DetailAccountResponse>(
    "/api/account/detail",
    {
      id: req.id,
      email: req.userEmail,
    },
    { requireAuth: true }
  );
  return normalizeAccount(resp);
}

export async function updateUserProfile(
  req: UpdateUserRequest
): Promise<DetailUserResponse> {
  const resp = await request<DetailAccountResponse>(
    "/api/account/update",
    {
      id: req.id,
      username: req.username ?? req.userName,
      email: req.email ?? req.userEmail,
      password: req.password ?? req.userPassword,
      nickname: req.nickname ?? req.userName,
      avatarUrl: req.avatarUrl ?? req.userAvatar,
      bio: req.bio ?? req.userProfile,
    },
    { requireAuth: true }
  );
  return normalizeAccount(resp);
}
