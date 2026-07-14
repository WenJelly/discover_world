package follow

import (
	"context"
	"database/sql"
	"errors"
	"strconv"
	"strings"

	commonauth "discover_world/internal/common/auth"
	commonresponse "discover_world/internal/common/response"
	mediaLogic "discover_world/internal/logic/media"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"discover_world/model"
)

const (
	defaultFollowPageSize = 20
	maxFollowPageSize     = 100
)

func loadLoginUser(ctx context.Context, svcCtx *svc.ServiceContext) (*model.UserAccount, error) {
	return commonauth.LoadRequiredLoginUser(ctx, svcCtx, "")
}

func parseRequiredID(raw, field string) (uint64, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return 0, commonresponse.BadRequest(field + " 必须是正整数")
	}
	id, err := strconv.ParseUint(raw, 10, 64)
	if err != nil || id == 0 {
		return 0, commonresponse.BadRequest(field + " 必须是正整数")
	}
	return id, nil
}

func parseOptionalID(raw, field string) (uint64, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return 0, nil
	}
	return parseRequiredID(raw, field)
}

func formatID(id uint64) string {
	if id == 0 {
		return ""
	}
	return strconv.FormatUint(id, 10)
}

func nullStringValue(value sql.NullString) string {
	if !value.Valid {
		return ""
	}
	return value.String
}

func loadFollowTarget(ctx context.Context, svcCtx *svc.ServiceContext, targetID uint64) (*model.UserAccount, error) {
	target, err := svcCtx.UserAccountModel.FindOneActive(ctx, targetID)
	if err != nil {
		if errors.Is(err, model.ErrNotFound) {
			return nil, commonresponse.NotFound("账号不存在")
		}
		return nil, commonresponse.InternalServerError("查询账号失败")
	}
	return target, nil
}

func validateFollowTarget(ctx context.Context, svcCtx *svc.ServiceContext, loginUser *model.UserAccount, targetID uint64) (*model.UserAccount, error) {
	if loginUser == nil {
		return nil, commonresponse.Unauthorized("请先登录")
	}
	if targetID == loginUser.Id {
		return nil, commonresponse.BadRequest("不能关注自己")
	}
	return loadFollowTarget(ctx, svcCtx, targetID)
}

func buildFollowStatus(ctx context.Context, svcCtx *svc.ServiceContext, loginUser *model.UserAccount, target *model.UserAccount) (*types.FollowStatusResponse, error) {
	if target == nil {
		return &types.FollowStatusResponse{}, nil
	}

	followerCount, err := svcCtx.UserFollowModel.CountFollowers(ctx, target.Id)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询粉丝数失败")
	}
	followingCount, err := svcCtx.UserFollowModel.CountFollowing(ctx, target.Id)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询关注数失败")
	}
	isFollowing := false
	if loginUser != nil && loginUser.Id != target.Id {
		isFollowing, err = svcCtx.UserFollowModel.IsFollowing(ctx, loginUser.Id, target.Id)
		if err != nil {
			return nil, commonresponse.InternalServerError("查询关注状态失败")
		}
	}

	return &types.FollowStatusResponse{
		TargetUserId:   formatID(target.Id),
		IsFollowing:    isFollowing,
		FollowerCount:  followerCount,
		FollowingCount: followingCount,
	}, nil
}

func normalizePageSize(size int64) int64 {
	if size <= 0 {
		return defaultFollowPageSize
	}
	if size > maxFollowPageSize {
		return maxFollowPageSize
	}
	return size
}

func parseCursor(raw string) (uint64, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return 0, nil
	}
	cursor, err := strconv.ParseUint(raw, 10, 64)
	if err != nil {
		return 0, commonresponse.BadRequest("cursor 格式不正确")
	}
	return cursor, nil
}

func buildPublicAccountSummaries(ctx context.Context, svcCtx *svc.ServiceContext, userIDs []uint64) ([]types.AccountSummary, error) {
	if len(userIDs) == 0 {
		return []types.AccountSummary{}, nil
	}

	accounts, err := svcCtx.UserAccountModel.FindByIDs(ctx, userIDs)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询账号列表失败")
	}
	profiles, err := svcCtx.UserProfileModel.FindByUserIDs(ctx, userIDs)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询账号资料失败")
	}
	avatarURLs, err := mediaLogic.LoadAvatarURLsByOwner(ctx, svcCtx, profiles)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询账号头像失败")
	}

	accountByID := make(map[uint64]*model.UserAccount, len(accounts))
	for _, account := range accounts {
		if account != nil && strings.EqualFold(strings.TrimSpace(account.Status), "active") && !account.DeletedAt.Valid {
			accountByID[account.Id] = account
		}
	}

	resp := make([]types.AccountSummary, 0, len(userIDs))
	for _, id := range userIDs {
		account := accountByID[id]
		if account == nil {
			continue
		}
		profile := profiles[id]
		nickname := ""
		bio := ""
		if profile != nil {
			nickname = nullStringValue(profile.Nickname)
			bio = nullStringValue(profile.Bio)
		}
		if nickname == "" {
			nickname = account.Username
		}
		resp = append(resp, types.AccountSummary{
			Id:        formatID(account.Id),
			Username:  account.Username,
			Email:     "",
			Nickname:  nickname,
			AvatarUrl: avatarURLs[id],
			Bio:       bio,
			Status:    account.Status,
			Role:      strings.TrimSpace(account.Role),
		})
	}
	return resp, nil
}

func refUserIDs(refs []model.FollowUserRef) []uint64 {
	ids := make([]uint64, 0, len(refs))
	for _, ref := range refs {
		ids = append(ids, ref.UserID)
	}
	return ids
}

func nextCursor(refs []model.FollowUserRef, hasMore bool) string {
	if !hasMore || len(refs) == 0 {
		return ""
	}
	return formatID(refs[len(refs)-1].Cursor)
}
