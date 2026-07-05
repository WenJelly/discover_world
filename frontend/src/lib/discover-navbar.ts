export const DISCOVER_NAVBAR_VISIBILITY_EVENT =
  "discover-world:navbar-visibility";

export type DiscoverNavbarVisibilityDetail = {
  visible: boolean;
};

export function shouldShowDiscoverNavbar(scrollY: number) {
  return scrollY <= 8;
}
