package media

import (
	"strings"
	"testing"

	"discover_world/model"
)

func TestBuildMediaDeleteReferenceSummaryRequiresConfirmationForPostAttachments(t *testing.T) {
	summary := buildMediaDeleteReferenceSummary([]*model.AssetLink{
		{OwnerType: "post", OwnerId: 12, LinkRole: "attachment", Status: 1},
		{OwnerType: "post", OwnerId: 18, LinkRole: "attachment", Status: 1},
	})

	if summary.hasBlockingReferences() {
		t.Fatal("post attachment references should not block forced media deletion")
	}
	if !summary.requiresForceConfirmation() {
		t.Fatal("post attachment references should require force confirmation")
	}

	message := summary.forceConfirmationMessage()
	for _, fragment := range []string{"动态 #12", "动态 #18", "删除后会从这些动态中移除该图片", "是否继续删除？"} {
		if !strings.Contains(message, fragment) {
			t.Fatalf("confirmation message %q missing %q", message, fragment)
		}
	}
}

func TestBuildMediaDeleteReferenceSummaryBlocksFeaturedAndExplainsLocations(t *testing.T) {
	summary := buildMediaDeleteReferenceSummary([]*model.AssetLink{
		{OwnerType: "user_profile", OwnerId: 7, LinkRole: "featured", Status: 1},
		{OwnerType: "site_home", OwnerId: 1, LinkRole: "featured", Status: 1},
		{OwnerType: "album", OwnerId: 9, LinkRole: "album_item", Status: 1},
		{OwnerType: "post", OwnerId: 12, LinkRole: "attachment", Status: 1},
	})

	if !summary.hasBlockingReferences() {
		t.Fatal("featured and album references should block media deletion")
	}
	if summary.requiresForceConfirmation() {
		t.Fatal("blocking references should not be treated as force-confirmable")
	}

	message := summary.blockingMessage()
	for _, fragment := range []string{
		"个人主页精选 #7",
		"首页精选 #1",
		"相册 #9",
		"动态 #12",
		"请先到对应位置取消精选、相册、头像等引用后再删除",
	} {
		if !strings.Contains(message, fragment) {
			t.Fatalf("blocking message %q missing %q", message, fragment)
		}
	}
}

func TestBuildDirectMediaDeleteReferenceLabelsIncludesAvatarsAndAlbumCovers(t *testing.T) {
	labels := buildDirectMediaDeleteReferenceLabels(
		[]*model.UserProfile{
			{UserId: 3},
			{UserId: 5},
		},
		[]*model.Album{
			{Id: 8},
		},
	)

	got := strings.Join(labels, "、")
	for _, fragment := range []string{"用户头像 #3", "用户头像 #5", "相册封面 #8"} {
		if !strings.Contains(got, fragment) {
			t.Fatalf("direct reference labels %q missing %q", got, fragment)
		}
	}
}
