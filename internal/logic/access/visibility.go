package access

import (
	"context"
	"strings"

	"discover_world/internal/svc"
	"discover_world/model"
)

const (
	VisibilityPublic    = "public"
	VisibilityFollowers = "followers"
	VisibilityPrivate   = "private"
	VisibilityUnlisted  = "unlisted"
)

type ViewerAccessLevel string

const (
	ViewerAccessPublic   ViewerAccessLevel = "public"
	ViewerAccessFollower ViewerAccessLevel = "follower"
	ViewerAccessOwner    ViewerAccessLevel = "owner"
	ViewerAccessAdmin    ViewerAccessLevel = "admin"
)

func ResolveViewerAccess(ctx context.Context, svcCtx *svc.ServiceContext, viewer *model.UserAccount, ownerID uint64) (ViewerAccessLevel, error) {
	if viewer == nil || viewer.Id == 0 || ownerID == 0 {
		return ViewerAccessPublic, nil
	}
	if svcCtx != nil && svcCtx.IsAdminAccount(viewer) {
		return ViewerAccessAdmin, nil
	}
	if viewer.Id == ownerID {
		return ViewerAccessOwner, nil
	}
	if svcCtx == nil || svcCtx.UserFollowModel == nil {
		return ViewerAccessPublic, nil
	}
	isFollowing, err := svcCtx.UserFollowModel.IsFollowing(ctx, viewer.Id, ownerID)
	if err != nil {
		return ViewerAccessPublic, err
	}
	if isFollowing {
		return ViewerAccessFollower, nil
	}
	return ViewerAccessPublic, nil
}

func CanViewVisibility(visibility string, level ViewerAccessLevel) bool {
	switch strings.ToLower(strings.TrimSpace(visibility)) {
	case VisibilityPublic:
		return true
	case VisibilityFollowers:
		return level == ViewerAccessFollower || level == ViewerAccessOwner || level == ViewerAccessAdmin
	case VisibilityPrivate, VisibilityUnlisted:
		return level == ViewerAccessOwner || level == ViewerAccessAdmin
	default:
		return level == ViewerAccessOwner || level == ViewerAccessAdmin
	}
}

func VisibleValuesForLevel(level ViewerAccessLevel) []string {
	switch level {
	case ViewerAccessAdmin, ViewerAccessOwner:
		return []string{VisibilityPublic, VisibilityFollowers, VisibilityPrivate, VisibilityUnlisted}
	case ViewerAccessFollower:
		return []string{VisibilityPublic, VisibilityFollowers}
	default:
		return []string{VisibilityPublic}
	}
}

func AllowsOwnerScope(values []string) bool {
	seen := map[string]bool{}
	for _, value := range values {
		seen[strings.ToLower(strings.TrimSpace(value))] = true
	}
	return seen[VisibilityPublic] && seen[VisibilityFollowers] && seen[VisibilityPrivate] && seen[VisibilityUnlisted]
}
