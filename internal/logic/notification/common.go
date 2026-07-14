package notification

import (
	"context"
	"database/sql"
	"strconv"
	"strings"
	"time"

	commonauth "discover_world/internal/common/auth"
	commonresponse "discover_world/internal/common/response"
	mediaLogic "discover_world/internal/logic/media"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"discover_world/model"
)

const (
	defaultNotificationPageSize = 20
	maxNotificationPageSize     = 100
)

func loadLoginUser(ctx context.Context, svcCtx *svc.ServiceContext) (*model.UserAccount, error) {
	return commonauth.LoadRequiredLoginUser(ctx, svcCtx, "")
}

func normalizePageSize(size int64) int64 {
	if size <= 0 {
		return defaultNotificationPageSize
	}
	if size > maxNotificationPageSize {
		return maxNotificationPageSize
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

func formatTime(value time.Time) string {
	if value.IsZero() {
		return ""
	}
	return value.Format(time.RFC3339)
}

func buildNotificationResponses(ctx context.Context, svcCtx *svc.ServiceContext, rows []*model.Notification) ([]types.NotificationResponse, error) {
	if len(rows) == 0 {
		return []types.NotificationResponse{}, nil
	}

	actorIDs := make([]uint64, 0, len(rows))
	for _, row := range rows {
		if row != nil && row.ActorUserId.Valid && row.ActorUserId.Int64 > 0 {
			actorIDs = append(actorIDs, uint64(row.ActorUserId.Int64))
		}
	}

	accounts, err := svcCtx.UserAccountModel.FindByIDs(ctx, actorIDs)
	if err != nil {
		return nil, commonresponse.InternalServerError("query notification actors failed")
	}
	profiles, err := svcCtx.UserProfileModel.FindByUserIDs(ctx, actorIDs)
	if err != nil {
		return nil, commonresponse.InternalServerError("query notification actor profiles failed")
	}
	avatarURLs, err := mediaLogic.LoadAvatarURLsByOwner(ctx, svcCtx, profiles)
	if err != nil {
		return nil, commonresponse.InternalServerError("query notification actor avatars failed")
	}

	accountByID := make(map[uint64]*model.UserAccount, len(accounts))
	for _, account := range accounts {
		if account != nil && strings.EqualFold(strings.TrimSpace(account.Status), "active") && !account.DeletedAt.Valid {
			accountByID[account.Id] = account
		}
	}

	resp := make([]types.NotificationResponse, 0, len(rows))
	for _, row := range rows {
		if row == nil {
			continue
		}

		actorID := uint64(0)
		if row.ActorUserId.Valid && row.ActorUserId.Int64 > 0 {
			actorID = uint64(row.ActorUserId.Int64)
		}
		resp = append(resp, types.NotificationResponse{
			Id:          formatID(row.Id),
			ActorUserId: formatID(actorID),
			Actor:       buildAccountSummary(accountByID[actorID], profiles[actorID], avatarURLs[actorID]),
			EventType:   row.EventType,
			TargetType:  row.TargetType,
			TargetId:    formatID(row.TargetId),
			Title:       row.Title,
			Content:     nullStringValue(row.Content),
			IsRead:      row.ReadAt.Valid,
			CreatedAt:   formatTime(row.CreatedAt),
		})
	}
	return resp, nil
}

func buildAccountSummary(account *model.UserAccount, profile *model.UserProfile, avatarURL string) types.AccountSummary {
	if account == nil {
		return types.AccountSummary{}
	}

	nickname := account.Username
	bio := ""
	if profile != nil {
		if strings.TrimSpace(nullStringValue(profile.Nickname)) != "" {
			nickname = nullStringValue(profile.Nickname)
		}
		bio = nullStringValue(profile.Bio)
	}

	return types.AccountSummary{
		Id:        formatID(account.Id),
		Username:  account.Username,
		Email:     "",
		Nickname:  nickname,
		AvatarUrl: avatarURL,
		Bio:       bio,
		Status:    account.Status,
		Role:      strings.TrimSpace(account.Role),
	}
}
