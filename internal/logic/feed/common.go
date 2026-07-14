package feed

import (
	"context"
	accountmodel "discover_world/model/account"
	"strconv"
	"strings"

	commonauth "discover_world/internal/common/auth"
	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
)

const (
	defaultFollowingFeedPageSize = 20
	maxFollowingFeedPageSize     = 60
	maxFollowingSourceUsers      = 100
)

func loadLoginUser(ctx context.Context, svcCtx *svc.ServiceContext) (*accountmodel.UserAccount, error) {
	return commonauth.LoadRequiredLoginUser(ctx, svcCtx, "")
}

func normalizePageSize(size int64) int64 {
	if size <= 0 {
		return defaultFollowingFeedPageSize
	}
	if size > maxFollowingFeedPageSize {
		return maxFollowingFeedPageSize
	}
	return size
}

func parseCursor(raw string) (uint64, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return 0, nil
	}
	id, err := strconv.ParseUint(raw, 10, 64)
	if err != nil {
		return 0, commonresponse.BadRequest("cursor 格式不正确")
	}
	return id, nil
}

func formatID(id uint64) string {
	if id == 0 {
		return ""
	}
	return strconv.FormatUint(id, 10)
}
