import { useEffect, useMemo, useRef, useState } from "react";
import { ImageOff, LayoutGrid, RefreshCw, Rows3 } from "lucide-react";
import { PublicPictureCard } from "@/components/public/PublicPictureCard";
import { useInView } from "@/hooks/useInView";
import { useInfinitePictures } from "@/hooks/useInfinitePictures";
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
  parseDiscoverSearch,
  type DiscoverCategoryKey,
  type DiscoverLayoutKey,
  type DiscoverPhotographerKey,
  type DiscoverSearchState,
  type DiscoverSortKey,
  type DiscoverTabKey,
} from "@/lib/public-discover";

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
  return `/public${query}`;
}

export default function PublicGalleryPage() {
  const [discoverState, setDiscoverState] = useState<DiscoverSearchState>(() =>
    parseDiscoverSearch(window.location.search)
  );
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [galleryWidth, setGalleryWidth] = useState(0);
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
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (!target.closest(".discovery_navigation")) {
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

  const { pictures, loading, error, hasMore, loadMore, retry } =
    useInfinitePictures({
      pageSize: 30,
    });

  useEffect(() => {
    if (sentinelInView && hasMore && !loading) {
      loadMore();
    }
  }, [hasMore, loadMore, loading, sentinelInView]);

  const filteredPictures = useMemo(
    () => filterAndSortDiscoverPictures(pictures, discoverState),
    [pictures, discoverState]
  );

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

  const canShowQueryBar = discoverState.tab === "rating";

  const navigateDiscover = (nextState: DiscoverSearchState) => {
    const href = getHref(nextState);
    window.history.pushState({}, "", href);
    setDiscoverState(nextState);
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

    navigateDiscover({
      ...discoverState,
      layout,
    });
  };

  return (
    <section className="public-discover-page">
      <div className="profile_nav">
        <div className="profile_nav__inner">
          {canShowQueryBar ? (
            <div className="discover_layout_navigation">
              <div
                className="discover-layout-switch"
                role="group"
                aria-label="切换图片流展示格式"
              >
                {DISCOVER_LAYOUT_OPTIONS.map((option) => {
                  const active = option.key === discoverState.layout;
                  const Icon = option.key === "justified" ? Rows3 : LayoutGrid;

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
                      <Icon size={16} strokeWidth={2} aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

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

          {canShowQueryBar ? (
            <div className="discovery_navigation">
              <div className="discovery_options">
                <div className="discovery_sort">
                  <button
                    type="button"
                    className="discovery_sort__target"
                    aria-expanded={openMenu === "sort"}
                    onClick={() =>
                      setOpenMenu((current) => (current === "sort" ? null : "sort"))
                    }
                  >
                    {activeSortLabel}
                  </button>
                  <div className="arrow" />
                  {openMenu === "sort" ? (
                    <div className="popup popup-centered discovery_sort_popover">
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

                <div className="discovery_sort">
                  <button
                    type="button"
                    className="discovery_sort__target"
                    aria-expanded={openMenu === "photographer"}
                    onClick={() =>
                      setOpenMenu((current) =>
                        current === "photographer" ? null : "photographer"
                      )
                    }
                  >
                    {activePhotographerLabel}
                  </button>
                  <div className="arrow" />
                  {openMenu === "photographer" ? (
                    <div className="popup popup-centered discovery_sort_popover">
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

                <div className="category_region">
                  <button
                    type="button"
                    className="category_picker"
                    aria-expanded={openMenu === "category"}
                    onClick={() =>
                      setOpenMenu((current) =>
                        current === "category" ? null : "category"
                      )
                    }
                  >
                    <span className="category_target">{activeCategoryLabel}</span>
                    <div className="arrow" />
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
          ) : null}
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
                      <PublicPictureCard picture={item.picture} />
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
                <p>公开图片暂时无法加载,请稍后重试。</p>
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
                <h2>暂时没有公开图片</h2>
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
    </section>
  );
}
