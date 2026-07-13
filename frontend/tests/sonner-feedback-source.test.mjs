import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("shadcn Sonner is installed and mounted below the centered navbar", () => {
  const packageJson = JSON.parse(read("package.json"));
  const app = read("src/App.tsx");

  assert.equal(typeof packageJson.dependencies.sonner, "string");
  assert.equal(
    existsSync(new URL("../src/components/ui/sonner.tsx", import.meta.url)),
    true
  );
  assert.match(
    app,
    /import \{ Toaster as Sonner \} from "@\/components\/ui\/sonner"/
  );
  assert.match(app, /<Sonner[\s\S]*position="top-center"/);
  assert.match(
    app,
    /const sonnerTopOffset = "calc\(var\(--navbar-height, 4rem\) \+ 0\.75rem\)"/
  );
  assert.match(app, /offset=\{\{ top: sonnerTopOffset \}\}/);
  assert.match(app, /mobileOffset=\{\{ top: sonnerTopOffset,/);
  assert.doesNotMatch(app, /\srichColors\b/);
  assert.doesNotMatch(app, /\scloseButton\b/);
  assert.doesNotMatch(app, /ToastProvider|useToast/);
});

test("business files alias the Sonner API instead of restoring project Toast hooks", () => {
  for (const path of [
    "src/context/AuthContext.tsx",
    "src/components/auth/AuthDialog.tsx",
    "src/components/Navbar.tsx",
    "src/components/photo/PhotoDetailDialog.tsx",
    "src/components/post/PostCard.tsx",
    "src/components/post/PostComposerDialog.tsx",
    "src/components/post/PostImageAttach.tsx",
    "src/components/upload/ImageAttachButton.tsx",
    "src/pages/AccountDetailPage.tsx",
    "src/pages/AdminPage.tsx",
    "src/pages/CommunityPage.tsx",
    "src/pages/DiscoverPage.tsx",
  ]) {
    const source = read(path);
    assert.match(source, /import \{ toast as sonner \} from "sonner"/);
    assert.doesNotMatch(source, /useToast|ToastProvider/);
  }

  assert.equal(
    existsSync(new URL("../src/hooks/use-toast.tsx", import.meta.url)),
    false
  );
  assert.equal(
    existsSync(new URL("../src/components/ui/toast.tsx", import.meta.url)),
    false
  );
});

test("Sonner messages use Discover World business copy", () => {
  const combined = [
    "src/context/AuthContext.tsx",
    "src/components/auth/AuthDialog.tsx",
    "src/components/Navbar.tsx",
    "src/components/post/PostCard.tsx",
    "src/components/post/PostComposerDialog.tsx",
    "src/pages/AccountDetailPage.tsx",
    "src/pages/AdminPage.tsx",
    "src/pages/CommunityPage.tsx",
  ]
    .map(read)
    .join("\n");

  for (const copy of [
    "登录成功",
    "注册成功",
    "登录已过期",
    "头像更新成功",
    "资料已保存",
    "动态已发布",
    "动态已删除",
    "评论已发布",
    "举报已提交",
    "图片已删除",
    "精选已更新",
    "Hero 配置已保存",
    "讨论已发布",
  ]) {
    assert.match(combined, new RegExp(copy));
  }
});

test("page-level loading errors are not duplicated through Sonner", () => {
  const community = read("src/pages/CommunityPage.tsx");
  const discover = read("src/pages/DiscoverPage.tsx");
  const upload = read("src/pages/UploadPage.tsx");

  assert.doesNotMatch(community, /sonner\.error\("动态加载失败"/);
  assert.doesNotMatch(community, /sonner\.error\("论坛加载失败"/);
  assert.doesNotMatch(discover, /sonner\.error\("作品详情加载失败"/);
  assert.doesNotMatch(upload, /useToast|sonner\./);
});
