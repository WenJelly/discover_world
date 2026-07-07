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

type SearchCategory = "all" | "media" | "posts" | "albums" | "users";

interface SearchCategoryConfig {
  key: SearchCategory;
  label: string;
  icon: typeof ImageIcon;
}

const SEARCH_CATEGORIES: SearchCategoryConfig[] = [
  { key: "all", label: "全部", icon: Sparkles },
  { key: "media", label: "图片", icon: ImageIcon },
  { key: "posts", label: "动态", icon: MessageSquare },
  { key: "albums", label: "相册", icon: Folder },
  { key: "users", label: "用户", icon: Users },
];

const RECENT_SEARCHES_KEY = "discover-world:recent-searches";
const RECENT_SEARCHES_LIMIT = 6;
const SEARCH_DEBOUNCE_MS = 400;
const TRENDING_SEARCHES = ["风景", "旅行", "美食", "建筑", "人像", "艺术"];

function readSearchQuery() {
  return new URLSearchParams(window.location.search).get("q")?.trim() ?? "";
}

function navigateSearch(query: string, category: SearchCategory = "all") {
  const trimmed = query.trim();
  const params = new URLSearchParams();
  if (trimmed) params.set("q", trimmed);
  if (category !== "all") params.set("category", category);

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
            className="bg-rose-100 text-rose-700 font-medium px-1 rounded"
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
    <div className="space-y-8">
      {/* Category skeleton */}
      <div className="space-y-4">
        <div className="h-6 w-32 bg-slate-200 rounded animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="aspect-[4/3] bg-slate-200 rounded-lg animate-pulse" />
              <div className="h-4 w-3/4 bg-slate-200 rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-slate-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Empty state when no results found
function EmptyResults({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-6">
        <Search className="w-10 h-10 text-slate-400" />
      </div>
      <h3 className="text-xl font-semibold text-slate-900 mb-2">
        没有找到「{query}」的结果
      </h3>
      <p className="text-slate-600 mb-6 max-w-md">
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
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mb-6">
        <AlertCircle className="w-10 h-10 text-red-500" />
      </div>
      <h3 className="text-xl font-semibold text-slate-900 mb-2">搜索出错</h3>
      <p className="text-slate-600 mb-6 max-w-md">{error}</p>
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
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <ImageIcon className="w-5 h-5 text-rose-600" />
        <h2 className="text-lg font-semibold text-slate-900">图片</h2>
        <span className="text-sm text-slate-500">({items.length})</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map((media) => {
          const imageUrl = getMediaImageUrl(media);
          const title = getMediaTitle(media);
          return (
            <article
              key={media.id}
              className="group cursor-pointer bg-white border-2 border-slate-200 rounded-lg overflow-hidden hover:border-rose-400 transition-colors duration-200"
            >
              <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    <ImageIcon className="w-8 h-8" />
                  </div>
                )}
              </div>
              <div className="p-3">
                <h3 className="text-sm font-medium text-slate-900 line-clamp-1 mb-1">
                  <HighlightText text={title} query={query} />
                </h3>
                <p className="text-xs text-slate-600 line-clamp-1">
                  {media.owner?.nickname || media.owner?.username || "匿名用户"}
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
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-semibold text-slate-900">动态</h2>
        <span className="text-sm text-slate-500">({items.length})</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((post) => (
          <article
            key={post.id}
            className="bg-white border-2 border-slate-200 rounded-lg p-4 hover:border-blue-400 transition-colors duration-200 cursor-pointer"
          >
            <div className="flex items-start gap-3 mb-3">
              <Avatar className="w-10 h-10">
                {post.author?.avatarUrl ? (
                  <AvatarImage src={post.author.avatarUrl} alt={post.author.nickname} />
                ) : null}
                <AvatarFallback>{getAvatarFallback(post.author)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 text-sm">
                  {post.author?.nickname || post.author?.username || "用户"}
                </p>
                <p className="text-xs text-slate-500">{post.createdAt}</p>
              </div>
            </div>
            <p className="text-sm text-slate-700 line-clamp-3 leading-relaxed">
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
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Folder className="w-5 h-5 text-purple-600" />
        <h2 className="text-lg font-semibold text-slate-900">相册</h2>
        <span className="text-sm text-slate-500">({items.length})</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((album) => {
          const coverUrl = getMediaImageUrl(album.cover);
          return (
            <article
              key={album.id}
              className="bg-white border-2 border-slate-200 rounded-lg overflow-hidden hover:border-purple-400 transition-colors duration-200 cursor-pointer"
            >
              <div className="aspect-video bg-slate-100">
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt={album.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    <Folder className="w-10 h-10" />
                  </div>
                )}
              </div>
              <div className="p-3">
                <h3 className="font-medium text-slate-900 text-sm line-clamp-1 mb-1">
                  <HighlightText text={album.name} query={query} />
                </h3>
                <p className="text-xs text-slate-600 line-clamp-1">
                  {album.author?.nickname || album.author?.username || "匿名用户"}
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
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-green-600" />
        <h2 className="text-lg font-semibold text-slate-900">用户</h2>
        <span className="text-sm text-slate-500">({items.length})</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map((user) => {
          const href = buildAccountProfileHref(user.id);
          return (
            <a
              key={user.id}
              href={href}
              onClick={(e) => handleSpaNavigate(e, href)}
              className="bg-white border-2 border-slate-200 rounded-lg p-4 hover:border-green-400 transition-colors duration-200 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              <Avatar className="w-16 h-16 mx-auto mb-3">
                {user.avatarUrl ? (
                  <AvatarImage src={user.avatarUrl} alt={user.nickname || user.username} />
                ) : null}
                <AvatarFallback className="text-base">
                  {getAvatarFallback(user)}
                </AvatarFallback>
              </Avatar>
              <h3 className="font-medium text-slate-900 text-sm line-clamp-1 mb-1">
                <HighlightText
                  text={user.nickname || user.username}
                  query={query}
                />
              </h3>
              <p className="text-xs text-slate-500 line-clamp-1">@{user.username}</p>
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
  const [category, setCategory] = useState<SearchCategory>("all");
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
      navigateSearch(trimmed, category);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [inputValue, query, category, isComposing]);

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
      navigateSearch(trimmed, category);
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
    navigateSearch(searchQuery, category);
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

    switch (category) {
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
  }, [result, category]);

  const hasResults =
    filteredResults &&
    (filteredResults.media.length > 0 ||
      filteredResults.posts.length > 0 ||
      filteredResults.albums.length > 0 ||
      filteredResults.users.length > 0);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Search Header */}
      <div className="bg-white border-b-2 border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="space-y-4">
            {/* Search Input */}
            <form onSubmit={handleSubmit} className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              <Input
                ref={inputRef}
                type="search"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
                placeholder="搜索图片、动态、相册和用户..."
                aria-label="搜索"
                className="w-full h-14 pl-12 pr-24 text-base border-2 border-slate-200 rounded-lg focus:border-rose-500 focus:ring-4 focus:ring-rose-500/20 transition-all"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                {loading && (
                  <Loader2 className="w-5 h-5 text-rose-600 animate-spin" />
                )}
                {inputValue && (
                  <button
                    type="button"
                    onClick={handleClearInput}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    aria-label="清空搜索"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                )}
              </div>
            </form>

            {/* Category Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 -mb-2 scrollbar-hide">
              {SEARCH_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isActive = category === cat.key;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setCategory(cat.key)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
                      isActive
                        ? "bg-rose-600 text-white"
                        : "bg-white border-2 border-slate-200 text-slate-700 hover:border-slate-300"
                    }`}
                    aria-pressed={isActive}
                  >
                    <Icon className="w-4 h-4" />
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading && !result ? (
          <SearchSkeleton />
        ) : error ? (
          <ErrorState error={error} onRetry={() => setQuery(query)} />
        ) : query && result && totalResults === 0 ? (
          <EmptyResults query={query} />
        ) : query && hasResults ? (
          <div className="space-y-8">
            {/* Results summary */}
            <div className="flex items-center justify-between">
              <p className="text-slate-600">
                找到 <span className="font-semibold text-slate-900">{totalResults}</span> 条关于
                「<span className="font-semibold text-slate-900">{query}</span>」的结果
              </p>
            </div>

            {/* Results */}
            {filteredResults && (
              <div className="space-y-10">
                <MediaResults items={filteredResults.media} query={query} />
                <PostResults items={filteredResults.posts} query={query} />
                <AlbumResults items={filteredResults.albums} query={query} />
                <UserResults items={filteredResults.users} query={query} />
              </div>
            )}
          </div>
        ) : (
          /* Welcome / Empty State */
          <div className="max-w-3xl mx-auto text-center py-12">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-rose-100 to-pink-100 flex items-center justify-center mx-auto mb-8">
              <Search className="w-12 h-12 text-rose-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">
              探索发现世界
            </h2>
            <p className="text-slate-600 mb-10">
              搜索你感兴趣的图片、动态、相册和创作者
            </p>

            {/* Trending Searches */}
            <div className="mb-10">
              <div className="flex items-center justify-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-900">热门搜索</h3>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {TRENDING_SEARCHES.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => handleRecentClick(term)}
                    className="px-4 py-2 bg-white border-2 border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:border-rose-400 hover:text-rose-700 transition-colors"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>

            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <div>
                <div className="flex items-center justify-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-slate-400" />
                  <h3 className="text-sm font-semibold text-slate-900">最近搜索</h3>
                  <button
                    type="button"
                    onClick={handleClearRecent}
                    className="text-xs text-slate-500 hover:text-slate-700 ml-2"
                  >
                    清除
                  </button>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {recentSearches.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => handleRecentClick(term)}
                      className="px-4 py-2 bg-slate-100 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors"
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
