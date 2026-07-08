import {
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Search,
  X,
  Loader2,
  ImageIcon,
  MessageSquare,
  Folder,
  Users,
  Sparkles,
  TrendingUp,
  Clock,
  AlertCircle,
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

type SearchGroupKey = "all" | "media" | "posts" | "albums" | "users";

interface SearchCategoryConfig {
  key: SearchGroupKey;
  label: string;
  icon: typeof ImageIcon;
}

const SEARCH_CATEGORIES: SearchCategoryConfig[] = [
  { key: "all", label: "ALL / 全部", icon: Sparkles },
  { key: "media", label: "INDEX / 图片", icon: ImageIcon },
  { key: "posts", label: "FEEDS / 动态", icon: MessageSquare },
  { key: "albums", label: "ALBUMS / 相册", icon: Folder },
  { key: "users", label: "USERS / 用户", icon: Users },
];

const SEARCH_GROUP_HEADINGS: Record<SearchGroupKey, string> = {
  all: "SEARCH INDEX",
  media: "IMAGE INDEX",
  posts: "FEEDS",
  albums: "ALBUMS",
  users: "USERS",
};

const RECENT_SEARCHES_KEY = "discover-world:recent-searches";
const RECENT_SEARCHES_LIMIT = 6;
const SEARCH_DEBOUNCE_MS = 400;
const TRENDING_SEARCHES = ["风景", "旅行", "美食", "建筑", "人像", "艺术"];

function readSearchQuery() {
  return new URLSearchParams(window.location.search).get("q")?.trim() ?? "";
}

function navigateSearch(query: string, group: SearchGroupKey = "all") {
  const trimmed = query.trim();
  const params = new URLSearchParams();
  if (trimmed) params.set("q", trimmed);
  if (group !== "all") params.set("category", group);

  const nextUrl = params.toString() ? `/search?${params}` : "/search";
  const currentUrl = `${window.location.pathname}${window.location.search}`;

  if (nextUrl !== currentUrl) {
    window.history.pushState({}, "", nextUrl);
    window.dispatchEvent(new Event("popstate"));
  }
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

function saveRecentSearch(query: string) {
  try {
    const trimmed = query.trim();
    if (!trimmed) return;

    const current = readRecentSearches();
    const updated = [trimmed, ...current.filter((q) => q !== trimmed)].slice(
      0,
      RECENT_SEARCHES_LIMIT
    );
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

function clearRecentSearches() {
  try {
    window.localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    // Silently fail
  }
}

function getAvatarFallback(account?: AccountSummary | null) {
  const source =
    account?.nickname?.trim() ||
    account?.username?.trim() ||
    account?.email?.trim() ||
    "U";
  return source.slice(0, 2).toUpperCase();
}

function getMediaImageUrl(media?: MediaAssetResponse | null) {
  if (!media) return "";
  return (
    media.urls?.thumbnail ||
    media.urls?.preview ||
    media.thumbnailUrl ||
    media.url ||
    ""
  );
}

function getMediaTitle(media: MediaAssetResponse) {
  return media.title || media.name || media.originalFilename || "未命名";
}

function getMediaCardVariant(index: number) {
  return index % 7 === 1 || index % 7 === 5 ? "large" : "standard";
}

function getMediaDate(media: MediaAssetResponse) {
  const raw = media.createdAt || media.createTime || media.updatedAt || media.updateTime;
  if (!raw) return "未记录";
  return raw.slice(0, 10).replaceAll("-", ".");
}

function getAccountDisplayName(account?: AccountSummary | null) {
  return account?.nickname || account?.username || "匿名用户";
}

function buildAccountProfileHref(userId: string) {
  return userId.trim() ? `/account?userId=${encodeURIComponent(userId.trim())}` : "/account";
}

function handleSpaNavigate(
  event: React.MouseEvent<HTMLAnchorElement>,
  href: string
) {
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
}

// Highlight matched text in search results
function HighlightText({ text, query }: { text: string; query: string }) {
  const keyword = query.trim().toLowerCase();
  if (!keyword || !text) return <>{text}</>;

  const lowerText = text.toLowerCase();
  const parts: { value: string; match: boolean }[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const index = lowerText.indexOf(keyword, cursor);
    if (index === -1) {
      parts.push({ value: text.slice(cursor), match: false });
      break;
    }
    if (index > cursor) {
      parts.push({ value: text.slice(cursor, index), match: false });
    }
    parts.push({ value: text.slice(index, index + keyword.length), match: true });
    cursor = index + keyword.length;
  }

  return (
    <>
      {parts.map((part, i) =>
        part.match ? (
          <mark
            key={i}
            className="rounded-[2px] bg-slate-200 px-1 font-medium text-slate-950"
          >
            {part.value}
          </mark>
        ) : (
          <span key={i}>{part.value}</span>
        )
      )}
    </>
  );
}

// Loading skeleton for search results
function SearchSkeleton() {
  return (
    <div className="search-skeleton">
      <div className="h-5 w-36 animate-pulse rounded-sm bg-slate-200" />
      <div className="search-gallery-grid">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className={`search-gallery-card ${
              getMediaCardVariant(index) === "large" ? "search-gallery-card--large" : ""
            }`}
          >
            <div className="search-gallery-card__image animate-pulse bg-slate-200" />
            <div className="mt-3 h-3 w-2/3 animate-pulse rounded-sm bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Empty state when no results found
function EmptyResults({ query }: { query: string }) {
  return (
    <div className="search-state">
      <div className="search-state__icon">
        <Search className="h-9 w-9 text-slate-500" />
      </div>
      <h3 className="mb-2 text-xl font-semibold text-slate-950">
        没有找到「{query}」的结果
      </h3>
      <p className="mb-6 max-w-md text-slate-600">
        试试更简短或更通用的关键词，或者浏览热门搜索
      </p>
      <Button
        variant="outline"
        onClick={() => navigateSearch("")}
        className="gap-2"
      >
        <X className="w-4 h-4" />
        清空搜索
      </Button>
    </div>
  );
}

// Error state
function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="search-state">
      <div className="search-state__icon search-state__icon--error">
        <AlertCircle className="h-9 w-9 text-red-600" />
      </div>
      <h3 className="mb-2 text-xl font-semibold text-slate-950">搜索出错</h3>
      <p className="mb-6 max-w-md text-slate-600">{error}</p>
      <Button onClick={onRetry} className="gap-2">
        重试
      </Button>
    </div>
  );
}

// Media results grid
function MediaResults({
  items,
  query,
}: {
  items: MediaAssetResponse[];
  query: string;
}) {
  if (items.length === 0) return null;

  return (
    <section className="search-result-section">
      <div className="search-section-heading">
        <div>
          <p className="search-section-kicker">INDEX / 图片</p>
          <h2 className="search-section-title">图片作品</h2>
        </div>
        <span className="search-section-count">{items.length}</span>
      </div>
      <div className="search-gallery-grid">
        {items.map((media, index) => {
          const imageUrl = getMediaImageUrl(media);
          const title = getMediaTitle(media);
          const isLarge = getMediaCardVariant(index) === "large";
          return (
            <article
              key={media.id}
              className={`search-gallery-card ${isLarge ? "search-gallery-card--large" : ""}`}
            >
              <div className="search-gallery-card__image">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-400">
                    <ImageIcon className="h-8 w-8" />
                  </div>
                )}
              </div>
              <div className="search-gallery-card__meta">
                <div className="min-w-0">
                  <h3 className="search-gallery-card__title">
                    <HighlightText text={title} query={query} />
                  </h3>
                  <p className="search-gallery-card__date">{getMediaDate(media)}</p>
                </div>
                <p className="search-gallery-card__author">
                  @{getAccountDisplayName(media.owner)}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

// Posts results
function PostResults({
  items,
  query,
}: {
  items: GlobalSearchPostResponse[];
  query: string;
}) {
  if (items.length === 0) return null;

  return (
    <section className="search-result-section">
      <div className="search-section-heading">
        <div>
          <p className="search-section-kicker">FEEDS / 动态</p>
          <h2 className="search-section-title">创作者动态</h2>
        </div>
        <span className="search-section-count">{items.length}</span>
      </div>
      <div className="search-content-grid search-content-grid--two">
        {items.map((post) => (
          <article
            key={post.id}
            className="search-result-card"
          >
            <div className="mb-4 flex items-start gap-3">
              <Avatar className="h-10 w-10">
                {post.author?.avatarUrl ? (
                  <AvatarImage src={post.author.avatarUrl} alt={post.author.nickname} />
                ) : null}
                <AvatarFallback>{getAvatarFallback(post.author)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-950">
                  {getAccountDisplayName(post.author)}
                </p>
                <p className="text-xs text-slate-500">{post.createdAt}</p>
              </div>
            </div>
            <p className="line-clamp-3 text-sm leading-relaxed text-slate-700">
              <HighlightText text={post.content || "无内容"} query={query} />
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

// Albums results
function AlbumResults({
  items,
  query,
}: {
  items: GlobalSearchAlbumResponse[];
  query: string;
}) {
  if (items.length === 0) return null;

  return (
    <section className="search-result-section">
      <div className="search-section-heading">
        <div>
          <p className="search-section-kicker">ALBUMS / 相册</p>
          <h2 className="search-section-title">公开相册</h2>
        </div>
        <span className="search-section-count">{items.length}</span>
      </div>
      <div className="search-content-grid search-content-grid--three">
        {items.map((album) => {
          const coverUrl = getMediaImageUrl(album.cover);
          return (
            <article
              key={album.id}
              className="search-result-card search-result-card--media"
            >
              <div className="aspect-video bg-slate-100">
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt={album.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-400">
                    <Folder className="h-10 w-10" />
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="mb-1 line-clamp-1 text-sm font-medium text-slate-950">
                  <HighlightText text={album.name} query={query} />
                </h3>
                <p className="line-clamp-1 text-xs text-slate-600">
                  {getAccountDisplayName(album.author)}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

// Users results
function UserResults({
  items,
  query,
}: {
  items: AccountSummary[];
  query: string;
}) {
  if (items.length === 0) return null;

  return (
    <section className="search-result-section">
      <div className="search-section-heading">
        <div>
          <p className="search-section-kicker">USERS / 用户</p>
          <h2 className="search-section-title">创作者</h2>
        </div>
        <span className="search-section-count">{items.length}</span>
      </div>
      <div className="search-content-grid search-content-grid--four">
        {items.map((user) => {
          return (
            <a
              key={user.id}
              href={buildAccountProfileHref(user.id)}
              onClick={(e) => handleSpaNavigate(e, buildAccountProfileHref(user.id))}
              className="search-result-card search-user-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
            >
              <Avatar className="mx-auto mb-3 h-16 w-16">
                {user.avatarUrl ? (
                  <AvatarImage src={user.avatarUrl} alt={user.nickname || user.username} />
                ) : null}
                <AvatarFallback className="text-base">
                  {getAvatarFallback(user)}
                </AvatarFallback>
              </Avatar>
              <h3 className="mb-1 line-clamp-1 text-sm font-medium text-slate-950">
                <HighlightText
                  text={user.nickname || user.username}
                  query={query}
                />
              </h3>
              <p className="line-clamp-1 text-xs text-slate-500">@{user.username}</p>
            </a>
          );
        })}
      </div>
    </section>
  );
}

export default function SearchPage() {
  const [query, setQuery] = useState(() => readSearchQuery());
  const [inputValue, setInputValue] = useState(() => readSearchQuery());
  const [activeGroup, setActiveGroup] = useState<SearchGroupKey>("all");
  const [result, setResult] = useState<GlobalSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>(() =>
    readRecentSearches()
  );
  const [isComposing, setIsComposing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync with URL changes (browser back/forward)
  useEffect(() => {
    const syncFromUrl = () => {
      const nextQuery = readSearchQuery();
      setQuery(nextQuery);
      setInputValue(nextQuery);
    };

    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, []);

  // Debounced search
  useEffect(() => {
    if (isComposing) return;
    const trimmed = inputValue.trim();
    if (trimmed === query) return;

    const timer = window.setTimeout(() => {
      setQuery(trimmed);
      navigateSearch(trimmed, activeGroup);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [inputValue, query, activeGroup, isComposing]);

  // Perform search
  useEffect(() => {
    let active = true;

    if (!query) {
      setResult(null);
      setError("");
      setLoading(false);
      return;
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
          saveRecentSearch(query);
          setRecentSearches(readRecentSearches());
        }
      })
      .catch((err: unknown) => {
        if (!active) return;
        setResult(null);
        setError(err instanceof ApiError ? err.message : "搜索失败，请稍后重试");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [query]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (trimmed) {
      setQuery(trimmed);
      navigateSearch(trimmed, activeGroup);
    }
  };

  const handleClearInput = () => {
    setInputValue("");
    setQuery("");
    navigateSearch("");
    inputRef.current?.focus();
  };

  const handleRecentClick = (searchQuery: string) => {
    setInputValue(searchQuery);
    setQuery(searchQuery);
    navigateSearch(searchQuery, activeGroup);
  };

  const handleClearRecent = () => {
    clearRecentSearches();
    setRecentSearches([]);
  };

  const totalResults = useMemo(() => {
    if (!result) return 0;
    return (
      result.media.length +
      result.posts.length +
      result.albums.length +
      result.users.length
    );
  }, [result]);

  const filteredResults = useMemo(() => {
    if (!result) return null;

    switch (activeGroup) {
      case "media":
        return {
          ...result,
          posts: [],
          albums: [],
          users: [],
        };
      case "posts":
        return {
          ...result,
          media: [],
          albums: [],
          users: [],
        };
      case "albums":
        return {
          ...result,
          media: [],
          posts: [],
          users: [],
        };
      case "users":
        return {
          ...result,
          media: [],
          posts: [],
          albums: [],
        };
      default:
        return result;
    }
  }, [result, activeGroup]);

  const hasResults =
    filteredResults &&
    (filteredResults.media.length > 0 ||
      filteredResults.posts.length > 0 ||
      filteredResults.albums.length > 0 ||
      filteredResults.users.length > 0);

  const visibleResultsCount = useMemo(() => {
    if (!filteredResults) return 0;
    return (
      filteredResults.media.length +
      filteredResults.posts.length +
      filteredResults.albums.length +
      filteredResults.users.length
    );
  }, [filteredResults]);

  return (
    <div className="search-page">
      <div className="search-page-header">
        <div className="search-page-container search-page-header__inner">
          <div className="search-page-toolbar">
            <form onSubmit={handleSubmit} className="search-main-form">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                ref={inputRef}
                type="search"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
                placeholder="搜索图片、动态、相册、用户"
                aria-label="搜索"
                className="search-main-input"
              />
              <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
                {loading && (
                  <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
                )}
                {inputValue && (
                  <button
                    type="button"
                    onClick={handleClearInput}
                    className="search-clear-button"
                    aria-label="清空搜索"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            </form>

            <div
              className="search-group-tabs"
              role="tablist"
              aria-label="搜索结果分组"
            >
              {SEARCH_CATEGORIES.map((group) => {
                const Icon = group.icon;
                const isActive = activeGroup === group.key;
                return (
                  <button
                    key={group.key}
                    type="button"
                    role="tab"
                    aria-selected={activeGroup === group.key}
                    onClick={() => {
                      setActiveGroup(group.key);
                      if (query) navigateSearch(query, group.key);
                    }}
                    className={`search-group-tab${isActive ? " search-group-tab--active" : ""}`}
                    aria-pressed={isActive}
                  >
                    <Icon className="h-4 w-4" />
                    {group.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="search-page-container search-page-content">
        {loading && !result ? (
          <SearchSkeleton />
        ) : error ? (
          <ErrorState error={error} onRetry={() => setQuery(query)} />
        ) : query && result && totalResults === 0 ? (
          <EmptyResults query={query} />
        ) : query && hasResults ? (
          <div className="search-results-stack">
            <div className="search-results-meta">
              <h1>{SEARCH_GROUP_HEADINGS[activeGroup]}</h1>
              <p>
                Found <span>{visibleResultsCount}</span> results for "{query}"
              </p>
            </div>

            {filteredResults && (
              <div className="search-results-sections">
                <MediaResults items={filteredResults.media} query={query} />
                <PostResults items={filteredResults.posts} query={query} />
                <AlbumResults items={filteredResults.albums} query={query} />
                <UserResults items={filteredResults.users} query={query} />
              </div>
            )}
          </div>
        ) : query && result ? (
          <EmptyResults query={query} />
        ) : (
          <div className="search-welcome">
            <div className="search-welcome__icon">
              <Search className="h-11 w-11 text-slate-600" />
            </div>
            <h2>探索发现世界</h2>
            <p>
              搜索你感兴趣的图片、动态、相册和创作者
            </p>

            <div className="search-suggestion-group">
              <div className="search-suggestion-heading">
                <TrendingUp className="h-5 w-5 text-slate-400" />
                <h3>热门搜索</h3>
              </div>
              <div className="search-suggestion-list">
                {TRENDING_SEARCHES.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => handleRecentClick(term)}
                    className="search-suggestion-button"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>

            {recentSearches.length > 0 && (
              <div className="search-suggestion-group">
                <div className="search-suggestion-heading">
                  <Clock className="h-5 w-5 text-slate-400" />
                  <h3>最近搜索</h3>
                  <button
                    type="button"
                    onClick={handleClearRecent}
                    className="ml-2 text-xs text-slate-500 hover:text-slate-800"
                  >
                    清除
                  </button>
                </div>
                <div className="search-suggestion-list">
                  {recentSearches.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => handleRecentClick(term)}
                      className="search-suggestion-button search-suggestion-button--muted"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
