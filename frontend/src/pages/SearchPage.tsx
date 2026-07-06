import {
  Fragment,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  ArrowUpRight,
  Clock,
  Eye,
  Heart,
  Image as ImageIcon,
  Images,
  Loader2,
  MapPin,
  MessageCircle,
  MessageSquareText,
  RotateCcw,
  Search,
  SearchX,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, globalSearch } from "@/lib/api";
import type {
  AccountSummary,
  GlobalSearchAlbumResponse,
  GlobalSearchPostResponse,
  GlobalSearchResponse,
  MediaAssetResponse,
} from "@/lib/types";

type SearchGroupKey = "media" | "posts" | "albums" | "users";

type SearchGroupSummary = {
  key: SearchGroupKey;
  label: string;
  count: number;
  icon: typeof ImageIcon;
};

const SEARCH_GROUP_ORDER: SearchGroupKey[] = ["media", "posts", "albums", "users"];
const RECENT_SEARCHES_KEY = "discover-world:recent-searches";
const RECENT_SEARCHES_LIMIT = 8;
const SEARCH_DEBOUNCE_MS = 400;
const SUGGESTED_QUERIES = ["风景", "旅行", "美食", "城市", "人像"];

function readSearchQuery() {
  return new URLSearchParams(window.location.search).get("q")?.trim() ?? "";
}

function navigateSearch(query: string, options: { replace?: boolean } = {}) {
  const trimmed = query.trim();
  const nextUrl = trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search";
  const currentUrl = `${window.location.pathname}${window.location.search}`;
  if (nextUrl === currentUrl) return;

  if (options.replace) {
    window.history.replaceState({}, "", nextUrl);
  } else {
    window.history.pushState({}, "", nextUrl);
  }
  window.dispatchEvent(new Event("popstate"));
}

function readRecentSearches(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string" && item.trim() !== "")
      .slice(0, RECENT_SEARCHES_LIMIT);
  } catch {
    return [];
  }
}

function persistRecentSearches(items: string[]) {
  try {
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(items));
  } catch {
    // localStorage 不可用时静默降级
  }
}

function getAvatarFallback(account?: AccountSummary | null) {
  const source =
    account?.nickname?.trim() || account?.username?.trim() || account?.email?.trim() || "用户";
  return source.slice(0, 2).toUpperCase();
}

function getMediaImageUrl(media?: MediaAssetResponse | null) {
  if (!media) return "";
  return (
    media.urls?.thumbnail ||
    media.urls?.preview ||
    media.thumbnailUrl ||
    media.url ||
    media.urls?.detail ||
    media.urls?.original ||
    ""
  );
}

function getMediaTitle(media: MediaAssetResponse) {
  return media.title || media.name || media.originalFilename || "未命名作品";
}

function buildAccountProfileHref(userId: string) {
  const trimmed = userId.trim();
  return trimmed ? `/account?userId=${encodeURIComponent(trimmed)}` : "/account";
}

function handleSpaNavigate(event: MouseEvent<HTMLAnchorElement>, href: string) {
  if (
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0
  ) {
    return;
  }
  event.preventDefault();
  window.history.pushState({}, "", href);
  window.dispatchEvent(new Event("popstate"));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function getSearchGroupCount(result: GlobalSearchResponse, group: SearchGroupKey) {
  switch (group) {
    case "media":
      return result.media.length;
    case "posts":
      return result.posts.length;
    case "albums":
      return result.albums.length;
    case "users":
      return result.users.length;
  }
}

function getFirstAvailableGroup(result: GlobalSearchResponse): SearchGroupKey {
  return (
    SEARCH_GROUP_ORDER.find((group) => getSearchGroupCount(result, group) > 0) ?? "media"
  );
}

function buildSearchGroupSummaries(result: GlobalSearchResponse): SearchGroupSummary[] {
  return [
    { key: "media", label: "图片", count: result.media.length, icon: ImageIcon },
    { key: "posts", label: "动态", count: result.posts.length, icon: MessageSquareText },
    { key: "albums", label: "相册", count: result.albums.length, icon: Images },
    { key: "users", label: "用户", count: result.users.length, icon: UserRound },
  ];
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const keyword = query.trim();
  if (!keyword || !text) return <>{text}</>;

  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const parts: { value: string; hit: boolean }[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const index = lowerText.indexOf(lowerKeyword, cursor);
    if (index === -1) {
      parts.push({ value: text.slice(cursor), hit: false });
      break;
    }
    if (index > cursor) {
      parts.push({ value: text.slice(cursor, index), hit: false });
    }
    parts.push({ value: text.slice(index, index + keyword.length), hit: true });
    cursor = index + keyword.length;
  }

  return (
    <>
      {parts.map((part, index) =>
        part.hit ? (
          <mark
            key={index}
            className="rounded-sm bg-indigo-100 px-0.5 text-indigo-700"
          >
            {part.value}
          </mark>
        ) : (
          <Fragment key={index}>{part.value}</Fragment>
        )
      )}
    </>
  );
}

function AuthorLink({
  userId,
  children,
  className,
  label,
}: {
  userId?: string;
  children: React.ReactNode;
  className?: string;
  label: string;
}) {
  const trimmed = userId?.trim();
  if (!trimmed) {
    return <span className={className}>{children}</span>;
  }
  const href = buildAccountProfileHref(trimmed);
  return (
    <a
      href={href}
      aria-label={label}
      className={`${className ?? ""} rounded-sm transition-colors hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30`}
      onClick={(event) => handleSpaNavigate(event, href)}
    >
      {children}
    </a>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  count,
}: {
  icon: typeof ImageIcon;
  title: string;
  count: number;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2.5">
        <span className="inline-flex size-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700">
          <Icon className="size-4" strokeWidth={2.2} aria-hidden="true" />
        </span>
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      </div>
      <span className="text-sm tabular-nums text-slate-500">{count} 条</span>
    </div>
  );
}

function MediaResults({ items, query }: { items: MediaAssetResponse[]; query: string }) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-4">
      <SectionHeader icon={ImageIcon} title="图片" count={items.length} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((media) => {
          const imageUrl = getMediaImageUrl(media);
          const title = getMediaTitle(media);
          return (
            <article
              key={media.id}
              className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-900/5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={title}
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-slate-400">
                    <ImageIcon className="size-7" aria-hidden="true" />
                  </div>
                )}
              </div>
              <div className="space-y-2 p-3.5">
                <h3 className="line-clamp-1 text-sm font-semibold text-slate-950">
                  <HighlightedText text={title} query={query} />
                </h3>
                <p className="line-clamp-2 min-h-10 text-sm leading-5 text-slate-600">
                  {media.description || media.category || "暂无描述"}
                </p>
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                  <AuthorLink
                    userId={media.owner?.id}
                    label={`查看${media.owner?.nickname || media.owner?.username || "创作者"}的个人主页`}
                    className="line-clamp-1 min-w-0"
                  >
                    {media.owner?.nickname || media.owner?.username || "创作者"}
                  </AuthorLink>
                  <span className="inline-flex shrink-0 items-center gap-1 tabular-nums">
                    <Eye className="size-3.5" aria-hidden="true" />
                    {media.stats?.viewCount ?? 0}
                  </span>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function PostResults({
  items,
  query,
}: {
  items: GlobalSearchPostResponse[];
  query: string;
}) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-4">
      <SectionHeader icon={MessageSquareText} title="动态" count={items.length} />
      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((post) => (
          <article
            key={post.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md motion-reduce:transition-none"
          >
            <div className="flex items-start gap-3">
              <AuthorLink
                userId={post.userId || post.author?.id}
                label={`查看${post.author?.nickname || post.author?.username || "用户"}的个人主页`}
                className="shrink-0"
              >
                <Avatar className="size-9">
                  {post.author?.avatarUrl ? (
                    <AvatarImage src={post.author.avatarUrl} alt={post.author.nickname} />
                  ) : null}
                  <AvatarFallback className="text-xs">
                    {getAvatarFallback(post.author)}
                  </AvatarFallback>
                </Avatar>
              </AuthorLink>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <AuthorLink
                    userId={post.userId || post.author?.id}
                    label={`查看${post.author?.nickname || post.author?.username || "用户"}的个人主页`}
                    className="font-semibold text-slate-950"
                  >
                    {post.author?.nickname || post.author?.username || "用户"}
                  </AuthorLink>
                  {post.location ? (
                    <span className="inline-flex items-center gap-1 text-slate-500">
                      <MapPin className="size-3.5" aria-hidden="true" />
                      {post.location}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-700">
                  <HighlightedText text={post.content || "暂无内容"} query={query} />
                </p>
                <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Heart className="size-3.5" aria-hidden="true" />
                    {post.stats?.reactionCount ?? 0}
                  </span>
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <MessageCircle className="size-3.5" aria-hidden="true" />
                    {post.stats?.commentCount ?? 0}
                  </span>
                  <span>{post.createdAt}</span>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function AlbumResults({
  items,
  query,
}: {
  items: GlobalSearchAlbumResponse[];
  query: string;
}) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-4">
      <SectionHeader icon={Images} title="相册" count={items.length} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((album) => {
          const coverUrl = getMediaImageUrl(album.cover);
          return (
            <article
              key={album.id}
              className="group grid grid-cols-[112px_1fr] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md motion-reduce:transition-none"
            >
              <div className="aspect-square overflow-hidden bg-slate-100">
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt={album.name}
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-slate-400">
                    <Images className="size-6" aria-hidden="true" />
                  </div>
                )}
              </div>
              <div className="min-w-0 p-3.5">
                <h3 className="line-clamp-1 text-sm font-semibold text-slate-950">
                  <HighlightedText text={album.name} query={query} />
                </h3>
                <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-600">
                  {album.description || "暂无描述"}
                </p>
                <AuthorLink
                  userId={album.userId || album.author?.id}
                  label={`查看${album.author?.nickname || album.author?.username || "创作者"}的个人主页`}
                  className="mt-3 line-clamp-1 block text-xs text-slate-500"
                >
                  {album.author?.nickname || album.author?.username || "创作者"}
                </AuthorLink>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function UserResults({ items, query }: { items: AccountSummary[]; query: string }) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-4">
      <SectionHeader icon={UserRound} title="用户" count={items.length} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((user) => (
          <a
            key={user.id}
            href={buildAccountProfileHref(user.id)}
            className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-900/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            aria-label={`查看${user.nickname || user.username}的个人主页`}
            onClick={(event) => handleSpaNavigate(event, buildAccountProfileHref(user.id))}
          >
            <div className="flex items-center gap-3">
              <Avatar className="size-11 shrink-0">
                {user.avatarUrl ? (
                  <AvatarImage src={user.avatarUrl} alt={user.nickname || user.username} />
                ) : null}
                <AvatarFallback>{getAvatarFallback(user)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-1 text-sm font-semibold text-slate-950">
                  <HighlightedText text={user.nickname || user.username} query={query} />
                </h3>
                <p className="line-clamp-1 text-xs text-slate-500">@{user.username}</p>
              </div>
              <ArrowUpRight
                className="size-4 shrink-0 text-slate-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-indigo-500 motion-reduce:transition-none"
                aria-hidden="true"
              />
            </div>
            <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-slate-600">
              {user.bio || "暂无简介"}
            </p>
          </a>
        ))}
      </div>
    </section>
  );
}

function ResultSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="h-4 w-32 animate-pulse rounded-md bg-slate-200/80" />
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-10 w-24 animate-pulse rounded-lg bg-slate-200/80"
          />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="aspect-[4/3] animate-pulse bg-slate-200/80" />
            <div className="space-y-2.5 p-3.5">
              <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200/80" />
              <div className="h-3.5 w-full animate-pulse rounded bg-slate-200/60" />
              <div className="h-3.5 w-2/3 animate-pulse rounded bg-slate-200/60" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyGroup({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <SearchX className="size-6" aria-hidden="true" />
      </span>
      <p className="text-sm text-slate-500">{label}分组暂无结果,试试其他分组或更换关键词</p>
    </div>
  );
}

export default function SearchPage() {
  const [query, setQuery] = useState(() => readSearchQuery());
  const [draft, setDraft] = useState(() => readSearchQuery());
  const [result, setResult] = useState<GlobalSearchResponse | null>(null);
  const [activeGroup, setActiveGroup] = useState<SearchGroupKey>("media");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [isComposing, setIsComposing] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() =>
    readRecentSearches()
  );
  const tabRefs = useRef<Partial<Record<SearchGroupKey, HTMLButtonElement | null>>>({});
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const syncFromLocation = () => {
      const nextQuery = readSearchQuery();
      setQuery(nextQuery);
      // 仅当地址变化来自外部(返回键、导航栏搜索)时重置输入框,
      // 防抖导航时保留用户正在输入的内容(含首尾空格)。
      setDraft((prev) => (prev.trim() === nextQuery ? prev : nextQuery));
    };

    window.addEventListener("popstate", syncFromLocation);
    return () => window.removeEventListener("popstate", syncFromLocation);
  }, []);

  // 即输即搜:输入停顿后自动执行搜索;中文输入法组词期间不触发。
  useEffect(() => {
    if (isComposing) return;
    const trimmed = draft.trim();
    if (trimmed === query) return;

    const timer = window.setTimeout(() => {
      navigateSearch(trimmed, { replace: true });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [draft, query, isComposing]);

  useEffect(() => {
    let active = true;

    if (!query) {
      setResult(null);
      setError("");
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setError("");
    globalSearch({
      q: query,
      pageSize: 12,
      variantOption: { compressType: 2 },
    })
      .then((resp) => {
        if (active) {
          setResult(resp);
        }
      })
      .catch((err: unknown) => {
        if (!active) return;
        setResult(null);
        setError(err instanceof ApiError ? err.message : "搜索失败，请稍后重试");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [query, reloadToken]);

  useEffect(() => {
    if (result) {
      setActiveGroup(getFirstAvailableGroup(result));
    }
  }, [result]);

  useEffect(() => {
    if (!query) return;
    setRecentSearches((prev) => {
      const next = [query, ...prev.filter((item) => item !== query)].slice(
        0,
        RECENT_SEARCHES_LIMIT
      );
      persistRecentSearches(next);
      return next;
    });
  }, [query]);

  const totalCount = useMemo(() => {
    if (!result) return 0;
    return (
      result.media.length +
      result.posts.length +
      result.albums.length +
      result.users.length
    );
  }, [result]);

  const groupSummaries = useMemo(
    () => (result ? buildSearchGroupSummaries(result) : []),
    [result]
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigateSearch(draft);
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    persistRecentSearches([]);
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = SEARCH_GROUP_ORDER.indexOf(activeGroup);
    let nextIndex = -1;

    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % SEARCH_GROUP_ORDER.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex =
        (currentIndex - 1 + SEARCH_GROUP_ORDER.length) % SEARCH_GROUP_ORDER.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = SEARCH_GROUP_ORDER.length - 1;
    }

    if (nextIndex === -1) return;
    event.preventDefault();
    const nextGroup = SEARCH_GROUP_ORDER[nextIndex];
    setActiveGroup(nextGroup);
    tabRefs.current[nextGroup]?.focus();
  };

  const renderActiveResults = () => {
    if (!result) return null;

    switch (activeGroup) {
      case "media":
        return result.media.length > 0 ? (
          <MediaResults items={result.media} query={query} />
        ) : (
          <EmptyGroup label="图片" />
        );
      case "posts":
        return result.posts.length > 0 ? (
          <PostResults items={result.posts} query={query} />
        ) : (
          <EmptyGroup label="动态" />
        );
      case "albums":
        return result.albums.length > 0 ? (
          <AlbumResults items={result.albums} query={query} />
        ) : (
          <EmptyGroup label="相册" />
        );
      case "users":
        return result.users.length > 0 ? (
          <UserResults items={result.users} query={query} />
        ) : (
          <EmptyGroup label="用户" />
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pt-24 text-slate-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pb-16 sm:px-6 lg:px-8">
        <section className="space-y-4">
          <div className="max-w-3xl">
            <h1 className="text-2xl font-semibold tracking-normal text-slate-950 sm:text-3xl">
              搜索
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600" role="status">
              {query
                ? loading
                  ? `正在搜索「${query}」…`
                  : result
                    ? `「${query}」共找到 ${totalCount} 条结果`
                    : `正在搜索「${query}」`
                : "输入关键词,搜索图片、动态、相册和用户"}
            </p>
          </div>
          <form className="flex max-w-3xl gap-2" role="search" onSubmit={handleSubmit}>
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
                aria-label="搜索全站内容"
                placeholder="搜索图片、动态、相册、用户"
                autoComplete="off"
                className={`h-12 rounded-xl border-slate-200 bg-white pl-10 text-[15px] shadow-sm transition-all duration-200 hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 ${
                  draft ? "pr-20" : "pr-10"
                }`}
              />
              <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
                {loading ? (
                  <Loader2
                    className="size-4 animate-spin text-slate-400"
                    aria-hidden="true"
                  />
                ) : null}
                {draft ? (
                  <button
                    type="button"
                    onClick={() => setDraft("")}
                    className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                    aria-label="清空搜索"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </div>
            <Button type="submit" className="h-12 shrink-0 rounded-xl px-6">
              搜索
            </Button>
          </form>
        </section>

        {loading && !result ? (
          <ResultSkeleton />
        ) : error ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-red-200 bg-red-50 px-6 py-12 text-center">
            <span className="inline-flex size-12 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertCircle className="size-6" aria-hidden="true" />
            </span>
            <p className="text-sm text-red-700">{error}</p>
            <Button
              type="button"
              variant="outline"
              className="gap-2 border-red-200 bg-white text-red-700 hover:bg-red-50 hover:text-red-800"
              onClick={() => setReloadToken((token) => token + 1)}
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              重试
            </Button>
          </div>
        ) : query && result && totalCount === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
            <span className="inline-flex size-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <SearchX className="size-7" aria-hidden="true" />
            </span>
            <div className="space-y-1">
              <p className="text-base font-medium text-slate-900">
                没有找到与「{query}」相关的结果
              </p>
              <p className="text-sm text-slate-500">试试更短或更通用的关键词</p>
            </div>
            <Button type="button" variant="outline" onClick={() => setDraft("")}>
              清空重新搜索
            </Button>
          </div>
        ) : result ? (
          <div className="space-y-8">
            <div
              className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-2"
              role="tablist"
              aria-label="搜索结果分组"
              onKeyDown={handleTabKeyDown}
            >
              {groupSummaries.map((group) => {
                const Icon = group.icon;
                const selected = activeGroup === group.key;
                return (
                  <button
                    key={group.key}
                    ref={(node) => {
                      tabRefs.current[group.key] = node;
                    }}
                    type="button"
                    role="tab"
                    tabIndex={selected ? 0 : -1}
                    aria-selected={activeGroup === group.key}
                    aria-controls={`search-results-${group.key}`}
                    id={`search-tab-${group.key}`}
                    onClick={() => setActiveGroup(group.key)}
                    className={`relative inline-flex min-w-fit cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 ${
                      selected
                        ? "text-white"
                        : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                    }`}
                  >
                    {selected ? (
                      <motion.span
                        layoutId="search-tab-active"
                        transition={
                          prefersReducedMotion
                            ? { duration: 0 }
                            : { type: "spring", stiffness: 500, damping: 40 }
                        }
                        className="absolute inset-0 rounded-lg bg-slate-900"
                        aria-hidden="true"
                      />
                    ) : null}
                    <Icon className="relative size-4" aria-hidden="true" />
                    <span className="relative">{group.label}</span>
                    <span
                      className={`relative rounded-full px-2 py-0.5 text-xs tabular-nums ${
                        selected ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {group.count}
                    </span>
                  </button>
                );
              })}
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${query}-${activeGroup}`}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, y: -4 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.18, ease: "easeOut" }}
                id={`search-results-${activeGroup}`}
                role="tabpanel"
                aria-labelledby={`search-tab-${activeGroup}`}
              >
                {renderActiveResults()}
              </motion.div>
            </AnimatePresence>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-8 py-10 text-center">
            <div className="flex flex-col items-center gap-4">
              <span className="inline-flex size-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <Sparkles className="size-8" aria-hidden="true" />
              </span>
              <div className="space-y-1.5">
                <h2 className="text-lg font-semibold text-slate-950">探索全站内容</h2>
                <p className="text-sm leading-6 text-slate-500">
                  搜索感兴趣的图片、动态、相册和创作者
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {SUGGESTED_QUERIES.map((keyword) => (
                  <button
                    key={keyword}
                    type="button"
                    onClick={() => navigateSearch(keyword)}
                    className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm text-slate-600 shadow-sm transition-all duration-200 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
                  >
                    {keyword}
                  </button>
                ))}
              </div>
            </div>

            {recentSearches.length > 0 ? (
              <div className="w-full space-y-3 text-left">
                <div className="flex items-center justify-between">
                  <h3 className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700">
                    <Clock className="size-4 text-slate-400" aria-hidden="true" />
                    最近搜索
                  </h3>
                  <button
                    type="button"
                    onClick={clearRecentSearches}
                    className="cursor-pointer text-xs text-slate-400 transition-colors hover:text-slate-600"
                  >
                    清除记录
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => navigateSearch(term)}
                      className="cursor-pointer rounded-full bg-slate-100 px-4 py-1.5 text-sm text-slate-600 transition-colors duration-200 hover:bg-slate-200 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
