import type {
  ApiResponse,
  PictureCursorListReq,
  PictureCursorPageResponse,
  PictureListReq,
  PicturePageResponse,
} from "./types";

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8888";

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
    return localStorage.getItem("token");
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
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "服务暂时不可用,请稍后重试");
  }

  let json: ApiResponse<T>;
  try {
    json = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError(0, "服务暂时不可用,请稍后重试");
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
