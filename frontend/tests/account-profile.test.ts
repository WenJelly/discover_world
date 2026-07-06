import assert from "node:assert/strict";
import test from "node:test";

import {
  filterAndSortImages,
  getImageFilterOptions,
  toAccountProfile,
  toImageItem,
} from "../src/lib/account-profile.ts";
import type { DetailUserResponse, PictureResponse } from "../src/lib/types.ts";

test("toAccountProfile maps backend account detail without mock profile defaults", () => {
  const detail = {
    id: "42",
    username: "alice",
    email: "alice@example.com",
    nickname: "Alice Chen",
    avatarUrl: "https://cdn.example.com/avatar.jpg",
    bio: "backend bio",
    createdAt: "2026-07-01 10:00:00",
    publicMediaAssetCount: 5,
    approvedMediaAssetCount: 7,
    mediaAssetCount: 9,
  } as DetailUserResponse;

  const profile = toAccountProfile(detail);

  assert.equal(profile.id, "42");
  assert.equal(profile.username, "Alice Chen");
  assert.equal(profile.handle, "@alice");
  assert.equal(profile.email, "");
  assert.equal(profile.avatarUrl, "https://cdn.example.com/avatar.jpg");
  assert.equal(profile.bio, "backend bio");
  assert.equal(profile.joinedAt, "2026-07-01 10:00:00");
  assert.equal(profile.imageCount, 5);
  assert.equal(profile.followers, 0);
  assert.equal(profile.likes, 0);
  assert.deepEqual(profile.badges, []);
  assert.deepEqual(profile.styleTags, []);
});

test("toImageItem maps backend media URLs and stats without fabricated favorites", () => {
  const picture = {
    id: "100",
    title: "Misty Ridge",
    description: "from backend",
    category: "自然风光",
    tags: ["山野", "清晨"],
    urls: {
      thumbnail: "https://cdn.example.com/thumb.jpg",
      preview: "https://cdn.example.com/preview.jpg",
      detail: "https://cdn.example.com/detail.jpg",
      original: "https://cdn.example.com/original.jpg",
    },
    stats: {
      viewCount: 123,
      reactionCount: 8,
      favoriteCount: 4,
      commentCount: 2,
      shareCount: 1,
      downloadCount: 0,
    },
    createdAt: "2026-07-02 12:00:00",
  } as PictureResponse;

  const image = toImageItem(picture, 0);

  assert.equal(image.id, "100");
  assert.equal(image.url, "https://cdn.example.com/thumb.jpg");
  assert.equal(image.title, "Misty Ridge");
  assert.equal(image.description, "from backend");
  assert.equal(image.category, "自然风光");
  assert.deepEqual(image.tags, ["山野", "清晨"]);
  assert.equal(image.likes, 8);
  assert.equal(image.favorites, 4);
  assert.equal(image.views, 123);
  assert.equal(image.createdAt, "2026-07-02 12:00:00");
  assert.equal(image.isFeatured, true);
});

test("filter helpers derive categories and apply backend image filters", () => {
  const images = [
    {
      id: "1",
      url: "/one.jpg",
      title: "清晨山路",
      category: "自然风光",
      tags: ["山野", "清晨"],
      likes: 2,
      favorites: 1,
      views: 20,
      createdAt: "2026-07-01 08:00:00",
    },
    {
      id: "2",
      url: "/two.jpg",
      title: "城市夜色",
      category: "城市风光",
      tags: ["夜景"],
      likes: 10,
      favorites: 3,
      views: 80,
      createdAt: "2026-07-02 08:00:00",
    },
  ];

  assert.deepEqual(getImageFilterOptions(images), {
    categories: ["all", "城市风光", "自然风光"],
    tags: ["all", "夜景", "山野", "清晨"],
  });

  assert.deepEqual(
    filterAndSortImages(images, {
      keyword: "山",
      category: "自然风光",
      tag: "山野",
      sort: "latest",
    }).map((image) => image.id),
    ["1"]
  );

  assert.deepEqual(
    filterAndSortImages(images, {
      keyword: "",
      category: "all",
      tag: "all",
      sort: "hot",
    }).map((image) => image.id),
    ["2", "1"]
  );
});
