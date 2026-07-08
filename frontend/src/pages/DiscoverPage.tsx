import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GalleryHorizontal, Grid2X2, ImageOff, RefreshCw } from "lucide-react";
import { DiscoverPictureCard } from "@/components/discover/DiscoverPictureCard";
import { PhotoDetailDialog } from "@/components/photo/PhotoDetailDialog";
import { useToast } from "@/hooks/use-toast";
import { useInView } from "@/hooks/useInView";
import { useInfinitePictures } from "@/hooks/useInfinitePictures";
import {
  fetchFollowStatus,
  fetchMediaAssetDetail,
  followUser,
  unfollowUser,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import type { FollowStatusResponse, MediaAssetResponse } from "@/lib/types";
import { shouldPinDiscoverToolbar } from "@/lib/discover-navbar";
import {
  buildDiscoverSearch,
  buildJustifiedRows,
  buildRegularGridRows,
  DISCOVER_CATEGORY_OPTIONS,
  DISCOVER_LAYOUT_OPTIONS,
  DISCOVER_PHOTOGRAPHER_OPTIONS,
  DISCOVER_SORT_OPTIONS,
  DISCOVER_TABS,
  filterAndSortDiscoverPictures,
  getDiscoverCategoryQuery,
  parseDiscoverSearch,
  resolveDiscoverPreviewIndex,
  type DiscoverCategoryKey,
  type DiscoverLayoutKey,
  type DiscoverPhotographerKey,
  type DiscoverSearchState,
  type DiscoverSortKey,
  type DiscoverTabKey,
} from "@/lib/discover";

type OpenMenu = "sort" | "photographer" | "category" | null;

const DESKTOP_SKELETON_RATIOS = [1.5, 1.78, 1.5];
const MOBILE_SKELETON_RATIOS = [1.35, 1];
const REGULAR_GRID_DESKTOP_TILE_WIDTH = 320;
const REGULAR_GRID_MOBILE_TILE_WIDTH = 168;

function isDesktopWidth(width: number) {
  return width >= 680;
}

function buildDiscoverSkeletonLayout(
  containerWidth: number,
  height: number,
  gap: number,
  isDesktop: boolean
) {
  const ratios = isDesktop ? DESKTOP_SKELETON_RATIOS : MOBILE_SKELETON_RATIOS;
  const availableWidth = Math.max(1, containerWidth - gap * (ratios.length - 1));
  const ratioSum = ratios.reduce((sum, ratio) => sum + ratio, 0);
  let consumedWidth = 0;

  return ratios.map((ratio, index) => {
    const remaining = ratios.length - index - 1;
    const width =
      remaining === 0
        ? Math.max(1, availableWidth - consumedWidth)
        : Math.max(1, Math.round((availableWidth * ratio) / ratioSum));

    consumedWidth += width;

    return { width, height };
  });
}

function getHref(nextState: DiscoverSearchState) {
  const query = buildDiscoverSearch(nextState);
  return `/discover${query}`;
}

export default function DiscoverPage() {
  const [discoverState, setDiscoverState] = useState<DiscoverSearchState>(() =>
    parseDiscoverSearch(window.location.search)
  );
  const [discoverRefreshKey, setDiscoverRefreshKey] = useState(0);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [isToolbarPinned, setIsToolbarPinned] = useState(() =>
    shouldPinDiscoverToolbar(window.scrollY)
  );
  const [assetOverrides, setAssetOverrides] = useState<
    Record<string, MediaAssetResponse>
  >({});
  const [galleryWidth, setGalleryWidth] = useState(0);
  const [activePictureId, setActivePictureId] = useState<string | null>(null);
  const [followStates, setFollowStates] = useState<
    Record<string, FollowStatusResponse>
  >({});
  const [followPendingUserId, setFollowPendingUserId] = useState<string | null>(null);
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [sentinelRef, sentinelInView] = useInView<HTMLDivElement>({
    rootMargin: "480px 0px",
    once: false,
  });

  useEffect(() => {
    const syncFromLocation = () =>
      setDiscoverState(parseDiscoverSearch(window.location.search));

    window.addEventListener("popstate", syncFromLocation);
    return () => window.removeEventListener("popstate", syncFromLocation);
  }, []);

  useEffect(() => {
    const syncToolbarPinning = () => {
      setIsToolbarPinned(shouldPinDiscoverToolbar(window.scrollY));
    };

    syncToolbarPinning();
    window.addEventListener("scroll", syncToolbarPinning, { passive: true });

    return () => {
      window.removeEventListener("scroll", syncToolbarPinning);
    };
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (!target.closest(".discover-filter-navigation")) {
        setOpenMenu(null);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    const node = frameRef.current;
    if (!node) {
      return;
    }

    const updateWidth = () => {
      setGalleryWidth(Math.floor(node.clientWidth));
    };

    updateWidth();

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  const discoverCategoryQuery = useMemo(
    () => getDiscoverCategoryQuery(discoverState.category),
    [discoverState.category]
  );
  const discoverMediaSort = useMemo(() => {
    if (discoverState.tab === "rating" && discoverState.sort === "1") {
      return "hot";
    }
    if (discoverState.tab === "upcoming") {
      return "rising";
    }
    if (discoverState.tab === "fresh") {
      return "created";
    }
    return "latest";
  }, [discoverState.sort, discoverState.tab]);

  const { pictures, loading, error, hasMore, loadMore, retry } =
    useInfinitePictures({
      pageSize: 30,
      category: discoverCategoryQuery,
      sort: discoverMediaSort,
      refreshKey: discoverRefreshKey,
    });

  useEffect(() => {
    setAssetOverrides({});
  }, [discoverCategoryQuery, discoverMediaSort, discoverRefreshKey]);

  const mergedPictures = useMemo(
    () =>
      pictures.map((picture) =>
        assetOverrides[picture.id]
          ? { ...picture, ...assetOverrides[picture.id] }
          : picture
      ),
    [assetOverrides, pictures]
  );

  useEffect(() => {
    if (sentinelInView && hasMore && !loading) {
      loadMore();
    }
  }, [hasMore, loadMore, loading, sentinelInView]);

  const filteredPictures = useMemo(
    () => filterAndSortDiscoverPictures(mergedPictures, discoverState),
    [mergedPictures, discoverState]
  );

  const activeIndex = useMemo(
    () =>
      resolveDiscoverPreviewIndex(filteredPictures, activePictureId),
    [activePictureId, filteredPictures]
  );
  const activePicture = activeIndex >= 0 ? filteredPictures[activeIndex] : null;
  const activeOwnerId =
    activePicture?.ownerUserId || activePicture?.owner?.id || "";
  const activeOwnerFollowState = activeOwnerId
    ? followStates[activeOwnerId]
    : undefined;
  const hideActiveFollow =
    !activeOwnerId || Boolean(user?.id && activeOwnerId === user.id);

  const handleOpenPicture = (picture: MediaAssetResponse) => {
    setActivePictureId(picture.id);
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) setActivePictureId(null);
  };

  const handleAssetChange = useCallback((asset: MediaAssetResponse) => {
    setAssetOverrides((current) => ({
      ...current,
      [asset.id]: {
        ...current[asset.id],
        ...asset,
      },
    }));
  }, []);

  useEffect(() => {
    if (!activePictureId) return;
    let cancelled = false;

    fetchMediaAssetDetail({
      id: activePictureId,
      variantOption: { compressType: 2 },
    })
      .then((detail) => {
        if (!cancelled) handleAssetChange(detail);
      })
      .catch((error) => {
        if (cancelled) return;
        toast({
          title: "作品详情加载失败",
          description: error instanceof Error ? error.message : "请稍后重试",
          variant: "destructive",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [activePictureId, handleAssetChange, toast]);

  useEffect(() => {
    if (!isAuthenticated || !activeOwnerId || hideActiveFollow) return;
    let cancelled = false;

    fetchFollowStatus({ targetUserId: activeOwnerId })
      .then((status) => {
        if (cancelled) return;
        setFollowStates((current) => ({
          ...current,
          [activeOwnerId]: status,
        }));
      })
      .catch(() => {
        if (cancelled) return;
        setFollowStates((current) => ({
          ...current,
          [activeOwnerId]: {
            targetUserId: activeOwnerId,
            isFollowing: false,
            followerCount: 0,
            followingCount: 0,
          },
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [activeOwnerId, hideActiveFollow, isAuthenticated]);

  const handleToggleFollow = useCallback(async () => {
    if (!activeOwnerId || hideActiveFollow) return;
    if (!isAuthenticated) {
      toast({
        title: "请先登录",
        description: "登录后可以关注创作者",
        variant: "default",
      });
      return;
    }

    const previous = activeOwnerFollowState;
    const nextFollowing = !(previous?.isFollowing ?? false);
    setFollowPendingUserId(activeOwnerId);
    setFollowStates((current) => ({
      ...current,
      [activeOwnerId]: {
        targetUserId: activeOwnerId,
        isFollowing: nextFollowing,
        followerCount: Math.max(
          0,
          (current[activeOwnerId]?.followerCount ?? 0) +
            (nextFollowing ? 1 : -1)
        ),
        followingCount: current[activeOwnerId]?.followingCount ?? 0,
      },
    }));

    try {
      const status = nextFollowing
        ? await followUser({ targetUserId: activeOwnerId })
        : await unfollowUser({ targetUserId: activeOwnerId });
      setFollowStates((current) => ({
        ...current,
        [activeOwnerId]: status,
      }));
    } catch (error) {
      setFollowStates((current) => {
        const next = { ...current };
        if (previous) {
          next[activeOwnerId] = previous;
        } else {
          delete next[activeOwnerId];
        }
        return next;
      });
      toast({
        title: nextFollowing ? "关注失败" : "取消关注失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setFollowPendingUserId(null);
    }
  }, [
    activeOwnerFollowState,
    activeOwnerId,
    hideActiveFollow,
    isAuthenticated,
    toast,
  ]);

  const targetRowHeight = isDesktopWidth(galleryWidth) ? 350 : 132;
  const gap = isDesktopWidth(galleryWidth) ? 10 : 8;
  const isDesktopGallery = isDesktopWidth(galleryWidth);
  const hasMeasuredGallery = galleryWidth > 0;
  const skeletonLayout = useMemo(
    () =>
      buildDiscoverSkeletonLayout(
        Math.max(galleryWidth, 1),
        isDesktopGallery ? 280 : 136,
        gap,
        isDesktopGallery
      ),
    [galleryWidth, gap, isDesktopGallery]
  );
  const justifiedRows = useMemo(
    () =>
      buildJustifiedRows(
        filteredPictures,
        Math.max(galleryWidth, 0),
        targetRowHeight,
        gap
      ),
    [filteredPictures, galleryWidth, gap, targetRowHeight]
  );
  const regularGridRows = useMemo(
    () =>
      buildRegularGridRows(
        filteredPictures,
        Math.max(galleryWidth, 0),
        gap,
        isDesktopGallery
          ? REGULAR_GRID_DESKTOP_TILE_WIDTH
          : REGULAR_GRID_MOBILE_TILE_WIDTH
      ),
    [filteredPictures, galleryWidth, gap, isDesktopGallery]
  );
  const isRegularLayout = discoverState.layout === "grid";
  const displayRows = isRegularLayout ? regularGridRows : justifiedRows;

  const activeSortLabel =
    DISCOVER_SORT_OPTIONS.find((item) => item.key === discoverState.sort)?.title ||
    DISCOVER_SORT_OPTIONS[0].title;
  const activePhotographerLabel =
    DISCOVER_PHOTOGRAPHER_OPTIONS.find(
      (item) => item.key === discoverState.photographerType
    )?.title || DISCOVER_PHOTOGRAPHER_OPTIONS[0].title;
  const activeCategoryLabel =
    DISCOVER_CATEGORY_OPTIONS.find((item) => item.key === discoverState.category)
      ?.title || DISCOVER_CATEGORY_OPTIONS[0].title;

  const navigateDiscover = (
    nextState: DiscoverSearchState,
    options: { refreshData?: boolean } = {}
  ) => {
    const href = getHref(nextState);
    window.history.pushState({}, "", href);
    setDiscoverState(nextState);
    if (options.refreshData !== false) {
      setDiscoverRefreshKey((value) => value + 1);
    }
    setOpenMenu(null);
  };

  const handleTabClick = (tab: DiscoverTabKey) => {
    navigateDiscover({
      ...discoverState,
      tab,
    });
  };

  const handleSortClick = (sort: DiscoverSortKey) => {
    navigateDiscover({
      ...discoverState,
      sort,
    });
  };

  const handlePhotographerClick = (photographerType: DiscoverPhotographerKey) => {
    navigateDiscover({
      ...discoverState,
      photographerType,
    });
  };

  const handleCategoryClick = (category: DiscoverCategoryKey) => {
    navigateDiscover({
      ...discoverState,
      category,
    });
  };

  const handleLayoutClick = (layout: DiscoverLayoutKey) => {
    if (layout === discoverState.layout) {
      return;
    }

    navigateDiscover(
      {
        ...discoverState,
        layout,
      },
      { refreshData: false }
    );
  };
  const discoverPageClassName = [
    "discover-page",
    activePictureId ? "discover-page--preview-open" : "",
    isToolbarPinned ? "discover-page--toolbar-pinned" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={discoverPageClassName}>
      <div className="discover-toolbar">
        <div className="discover-toolbar__inner">
          <div className="discover_layout_navigation">
            <div
              className="discover-layout-switch"
              role="group"
              aria-label="切换图片流展示格式"
            >
              {DISCOVER_LAYOUT_OPTIONS.map((option) => {
                const active = option.key === discoverState.layout;
                const Icon =
                  option.key === "justified" ? GalleryHorizontal : Grid2X2;

                return (
                  <button
                    key={option.key}
                    type="button"
                    className={
                      active
                        ? "discover-layout-switch__button selected"
                        : "discover-layout-switch__button"
                    }
                    aria-label={option.title}
                    aria-pressed={active}
                    title={option.title}
                    onClick={() => handleLayoutClick(option.key)}
                  >
                    <Icon size={18} strokeWidth={2} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </div>

          <ul className="px_tabs" aria-label="发现导航标签">
            {DISCOVER_TABS.map((tab) => {
              const nextState = { ...discoverState, tab: tab.key };
              const active = discoverState.tab === tab.key;

              return (
                <li
                  key={tab.key}
                  className={active ? "active discover_tab_rating" : undefined}
                >
                  <a
                    href={getHref(nextState)}
                    onClick={(event) => {
                      event.preventDefault();
                      handleTabClick(tab.key);
                    }}
                  >
                    <span className="text px_topnav__link_text">{tab.title}</span>
                  </a>
                </li>
              );
            })}
          </ul>

          <div className="discover-filter-navigation">
            <div className="discover-filter-options">
              <div className="discover-filter">
                <button
                  type="button"
                  className="discover-filter__target"
                  aria-expanded={openMenu === "sort"}
                  onClick={() =>
                    setOpenMenu((current) => (current === "sort" ? null : "sort"))
                  }
                >
                  {activeSortLabel}
                </button>
                {openMenu === "sort" ? (
                  <div className="popup popup-centered discover-filter-popover">
                    <div className="contain">
                      <div className="inside">
                        <div className="sort_options">
                          <ul>
                            {DISCOVER_SORT_OPTIONS.map((option) => (
                              <li key={option.key}>
                                <a
                                  href={getHref({
                                    ...discoverState,
                                    sort: option.key,
                                  })}
                                  className={
                                    option.key === discoverState.sort
                                      ? "selected"
                                      : undefined
                                  }
                                  onClick={(event) => {
                                    event.preventDefault();
                                    handleSortClick(option.key);
                                  }}
                                >
                                  {option.title}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="discover-filter">
                <button
                  type="button"
                  className="discover-filter__target"
                  aria-expanded={openMenu === "photographer"}
                  onClick={() =>
                    setOpenMenu((current) =>
                      current === "photographer" ? null : "photographer"
                    )
                  }
                >
                  {activePhotographerLabel}
                </button>
                {openMenu === "photographer" ? (
                  <div className="popup popup-centered discover-filter-popover">
                    <div className="contain">
                      <div className="inside">
                        <div className="sort_options">
                          <ul>
                            {DISCOVER_PHOTOGRAPHER_OPTIONS.map((option) => (
                              <li key={option.key}>
                                <a
                                  href={getHref({
                                    ...discoverState,
                                    photographerType: option.key,
                                  })}
                                  className={
                                    option.key === discoverState.photographerType
                                      ? "selected"
                                      : undefined
                                  }
                                  onClick={(event) => {
                                    event.preventDefault();
                                    handlePhotographerClick(option.key);
                                  }}
                                >
                                  {option.title}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="discover-category-region">
                <button
                  type="button"
                  className="discover-category-picker"
                  aria-expanded={openMenu === "category"}
                  onClick={() =>
                    setOpenMenu((current) =>
                      current === "category" ? null : "category"
                    )
                  }
                >
                  <span className="discover-category-target">{activeCategoryLabel}</span>
                </button>
                {openMenu === "category" ? (
                  <div className="popup popup-centered category_popover category_content">
                    <div className="contain">
                      <div className="inside clearfix">
                        <div className="header clearfix">
                          <a
                            href={getHref({
                              ...discoverState,
                              category: "all",
                            })}
                            className={
                              discoverState.category === "all"
                                ? "selected"
                                : undefined
                            }
                            onClick={(event) => {
                              event.preventDefault();
                              handleCategoryClick("all");
                            }}
                          >
                            全部类别
                          </a>
                        </div>
                        <div className="categories">
                          <ul>
                            {DISCOVER_CATEGORY_OPTIONS.filter(
                              (option) => option.key !== "all"
                            ).map((option) => (
                              <li key={option.key}>
                                <a
                                  href={getHref({
                                    ...discoverState,
                                    category: option.key,
                                  })}
                                  className={
                                    option.key === discoverState.category
                                      ? "selected"
                                      : undefined
                                  }
                                  onClick={(event) => {
                                    event.preventDefault();
                                    handleCategoryClick(option.key);
                                  }}
                                >
                                  {option.title}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="clearfix" />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

            </div>
          </div>
        </div>
      </div>

      <div className="photo_grid_region">
        <div
          className="full-aspect-ratio-photo-grid infinite_scroll_container"
          ref={frameRef}
        >
          {displayRows.length > 0 ? (
            <div
              className={
                isRegularLayout
                  ? "grid-container discover-regular-grid"
                  : "grid-container"
              }
            >
              {displayRows.map((row, index) => (
                <div
                  key={`${row.height}-${index}`}
                  className={
                    isRegularLayout
                      ? "discover-photo-row discover-photo-row--regular"
                      : "discover-photo-row"
                  }
                  style={{ gap }}
                >
                  {row.items.map((item) => (
                    <div
                      key={item.picture.id}
                      className="discover-photo-box"
                      style={{
                        width: item.displayWidth,
                        height: item.displayHeight,
                      }}
                    >
                      <DiscoverPictureCard
                        picture={item.picture}
                        onOpen={handleOpenPicture}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : null}

          {loading && displayRows.length === 0 ? (
            <div className="grid-container">
              {Array.from({ length: isDesktopGallery ? 3 : 5 }).map((_, rowIndex) => (
                  <div
                    key={rowIndex}
                    className="discover-photo-row discover-photo-row--loading discover-skeleton-layout"
                    style={{ gap }}
                  >
                    {skeletonLayout.map((item, columnIndex) => (
                      <div
                        key={columnIndex}
                        className="discover-photo-skeleton"
                        style={{
                          width: item.width,
                          height: item.height,
                        }}
                      />
                    ))}
                  </div>
                ))}
            </div>
          ) : null}

          {!loading && error && displayRows.length === 0 ? (
            <div className="discover-feedback">
              <ImageOff size={40} aria-hidden="true" />
              <div>
                <h2>加载失败</h2>
                <p>发现图片暂时无法加载,请稍后重试。</p>
              </div>
              <button type="button" className="discover-feedback__button" onClick={retry}>
                <RefreshCw size={14} aria-hidden="true" />
                重试
              </button>
            </div>
          ) : null}

          {!loading && !error && hasMeasuredGallery && displayRows.length === 0 ? (
            <div className="discover-feedback">
              <ImageOff size={40} aria-hidden="true" />
              <div>
                <h2>暂时没有发现图片</h2>
                <p>当前筛选条件下还没有可展示的作品。</p>
              </div>
            </div>
          ) : null}

          {error && displayRows.length > 0 ? (
            <div className="discover-inline-error">
              <span>加载失败</span>
              <button type="button" onClick={retry}>
                <RefreshCw size={14} aria-hidden="true" />
                重试
              </button>
            </div>
          ) : null}

          <div ref={sentinelRef} className="discover-sentinel" aria-hidden="true" />

          {loading && displayRows.length > 0 ? (
            <div className="discover-loading-more">加载中</div>
          ) : null}
        </div>
      </div>

      <PhotoDetailDialog
        media={activePicture}
        open={!!activePicture}
        onOpenChange={handleDialogOpenChange}
        isFollowing={activeOwnerFollowState?.isFollowing ?? false}
        followPending={followPendingUserId === activeOwnerId}
        hideFollow={hideActiveFollow}
        onToggleFollow={handleToggleFollow}
        onAssetChange={handleAssetChange}
      />
    </section>
  );
}
