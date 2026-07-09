import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const bellUrl = new URL("../src/components/notifications/NotificationBell.tsx", import.meta.url);

test("navbar renders authenticated notification bell", async () => {
  assert.equal(existsSync(bellUrl), true);

  const navbar = await readFile(
    new URL("../src/components/Navbar.tsx", import.meta.url),
    "utf8"
  );

  assert.match(navbar, /NotificationBell/);
  assert.match(navbar, /isAuthenticated\s*\?\s*<NotificationBell/);
});

test("notification bell loads unread count and supports read actions", async () => {
  const source = await readFile(bellUrl, "utf8");

  for (const fragment of [
    "fetchUnreadNotificationCount",
    "fetchNotificationCursorList",
    "markNotificationRead",
    "markAllNotificationsRead",
    "Bell",
    "全部已读",
    "notification.actor",
    "notification.isRead",
  ]) {
    assert.match(source, new RegExp(fragment));
  }
});
