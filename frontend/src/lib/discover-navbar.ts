const DISCOVER_TOOLBAR_PIN_SCROLL_Y = 56;

export function shouldPinDiscoverToolbar(scrollY: number) {
  return scrollY >= DISCOVER_TOOLBAR_PIN_SCROLL_Y;
}
