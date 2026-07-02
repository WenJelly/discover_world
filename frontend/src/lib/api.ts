import type {
  ApiResponse,
  DetailUserResponse,
  LoginRequest,
  LoginResponse,
  PictureCursorListReq,
  PictureCursorPageResponse,
  PictureListReq,
  PicturePageResponse,
  RegisterRequest,
  RegisterResponse,
  UpdateUserRequest,
} from "./types";
import {
  isTokenUsable,
  notifyAuthExpired,
  TOKEN_KEY,
} from "./auth-session";

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8888";
const REQUEST_TIMEOUT_MS = 12_000;

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
};

async function request<T>(
  path: string,
  body: unknown,
  options: RequestOptions = {}
): Promise<T> {
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
  }, REQUEST_TIMEOUT_MS);

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
      throw new ApiError(0, "服务响应超时,请稍后重试");
    }

    throw new ApiError(0, "服务暂时不可用,请稍后重试");
  } finally {
    window.clearTimeout(timeoutId);
  }

  let json: ApiResponse<T> | null = null;
  try {
    json = (await res.json()) as ApiResponse<T>;
  } catch {
    if (res.status === 401) {
      const message = "登录已过期，请重新登录";
      notifyAuthExpired(message);
      throw new ApiError(401, message);
    }

    throw new ApiError(0, "服务暂时不可用,请稍后重试");
  }

  if (res.status === 401 || json?.code === 401) {
    const message = json?.message || "登录已过期，请重新登录";
    notifyAuthExpired(message);
    throw new ApiError(401, message);
  }

  if (json.code !== 200) {
    throw new ApiError(json.code, json.message);
  }
  return json.data;
}

export function fetchPictureList(
  req: PictureListReq
): Promise<PicturePageResponse> {
  return request<PicturePageResponse>("/api/picture/list", req);
}

export function fetchPictureCursorList(
  req: PictureCursorListReq
): Promise<PictureCursorPageResponse> {
  return request<PictureCursorPageResponse>(
    "/api/picture/list/cursor",
    req
  );
}

export function fetchUserImages(
  req: PictureCursorListReq & { userId: string }
): Promise<PictureCursorPageResponse> {
  return fetchPictureCursorList({
    ...req,
    userId: req.userId,
  });
}

export function loginUser(req: LoginRequest): Promise<LoginResponse> {
  return request<LoginResponse>("/api/user/login", {
    userEmail: req.userEmail,
    userPassword: req.userPassword,
  });
}

export function registerUser(
  req: RegisterRequest
): Promise<RegisterResponse> {
  return request<RegisterResponse>("/api/user/register", {
    userEmail: req.userEmail,
    userPassword: req.userPassword,
    userCheckPassword: req.userCheckPassword,
  });
}

export function fetchUserProfile(
  req: { id?: string; userEmail?: string } = {}
): Promise<DetailUserResponse> {
  return request<DetailUserResponse>(
    "/api/user/get/detail",
    {
      id: req.id,
      userEmail: req.userEmail,
    },
    { requireAuth: true }
  );
}

export function updateUserProfile(
  req: UpdateUserRequest
): Promise<DetailUserResponse> {
  return request<DetailUserResponse>(
    "/api/user/update",
    req,
    { requireAuth: true }
  );
}
