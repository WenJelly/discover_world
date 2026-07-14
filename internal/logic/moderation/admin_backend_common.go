package moderation

import (
	"context"
	"database/sql"
	accountmodel "discover_world/model/account"
	moderationmodel "discover_world/model/moderation"
	postmodel "discover_world/model/post"
	profilemodel "discover_world/model/profile"
	"strings"
	"time"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
	"discover_world/internal/types"
)

const (
	adminActionReportResolve = "moderation.report.resolve"
	adminTargetReport        = "moderation_report"
	adminTargetPost          = "post"
	adminTargetComment       = "comment_record"
	adminTargetForumPost     = "forum_post"
)

func buildAdminModerationReportResponse(row *moderationmodel.ModerationReport) types.AdminModerationReportResponse {
	if row == nil {
		return types.AdminModerationReportResponse{}
	}
	return types.AdminModerationReportResponse{
		Id:             formatID(row.Id),
		ReporterUserId: formatID(row.ReporterUserId),
		TargetType:     row.TargetType,
		TargetId:       formatID(row.TargetId),
		Reason:         row.Reason,
		Description:    nullStringValue(row.Description),
		Status:         row.Status,
		HandlerUserId:  formatNullableID(row.HandlerUserId),
		Resolution:     nullStringValue(row.Resolution),
		ResolutionNote: nullStringValue(row.ResolutionNote),
		CreatedAt:      formatTime(row.CreatedAt),
		UpdatedAt:      formatTime(row.UpdatedAt),
		ResolvedAt:     formatNullTime(row.ResolvedAt),
	}
}

func buildAdminAccountSummary(account *accountmodel.UserAccount, profile *profilemodel.UserProfile) types.AccountSummary {
	if account == nil {
		return types.AccountSummary{}
	}
	nickname := account.Username
	bio := ""
	if profile != nil {
		if value := strings.TrimSpace(nullStringValue(profile.Nickname)); value != "" {
			nickname = value
		}
		bio = nullStringValue(profile.Bio)
	}
	return types.AccountSummary{
		Id:       formatID(account.Id),
		Username: account.Username,
		Email:    nullStringValue(account.Email),
		Nickname: nickname,
		Bio:      bio,
		Status:   account.Status,
		Role:     strings.TrimSpace(account.Role),
	}
}

func buildAdminPostContentResponse(post *postmodel.Post, account *accountmodel.UserAccount, profile *profilemodel.UserProfile) types.AdminContentResponse {
	if post == nil {
		return types.AdminContentResponse{}
	}
	return types.AdminContentResponse{
		Id:         formatID(post.Id),
		TargetType: adminTargetPost,
		Author:     buildAdminAccountSummary(account, profile),
		Title:      post.PostType,
		Content:    nullStringValue(post.Content),
		Status:     post.Status,
		CreatedAt:  formatTime(post.CreatedAt),
	}
}

func buildAdminCommentContentResponse(comment *postmodel.CommentRecord, account *accountmodel.UserAccount, profile *profilemodel.UserProfile) types.AdminContentResponse {
	if comment == nil {
		return types.AdminContentResponse{}
	}
	return types.AdminContentResponse{
		Id:         formatID(comment.Id),
		TargetType: adminTargetComment,
		Author:     buildAdminAccountSummary(account, profile),
		Title:      comment.TargetType + ":" + formatID(comment.TargetId),
		Content:    comment.Content,
		Status:     comment.Status,
		CreatedAt:  formatTime(comment.CreatedAt),
	}
}

func parseOptionalID(raw, field string) (uint64, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return 0, nil
	}
	return parseRequiredID(raw, field)
}

func parseOptionalTime(raw string) (time.Time, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return time.Time{}, nil
	}
	for _, layout := range []string{"2006-01-02 15:04:05", time.RFC3339, "2006-01-02"} {
		parsed, err := time.ParseInLocation(layout, raw, time.Local)
		if err == nil {
			return parsed, nil
		}
	}
	return time.Time{}, commonresponse.BadRequest("时间格式必须是 yyyy-MM-dd、yyyy-MM-dd HH:mm:ss 或 RFC3339")
}

func buildModerationReportFilter(req *types.AdminModerationReportQueryRequest) (moderationmodel.ModerationReportFilter, error) {
	targetID, err := parseOptionalID(req.TargetId, "targetId")
	if err != nil {
		return moderationmodel.ModerationReportFilter{}, err
	}
	reporterID, err := parseOptionalID(req.ReporterUserId, "reporterUserId")
	if err != nil {
		return moderationmodel.ModerationReportFilter{}, err
	}
	start, err := parseOptionalTime(req.CreatedAtFrom)
	if err != nil {
		return moderationmodel.ModerationReportFilter{}, err
	}
	end, err := parseOptionalTime(req.CreatedAtTo)
	if err != nil {
		return moderationmodel.ModerationReportFilter{}, err
	}
	return moderationmodel.ModerationReportFilter{
		Status:         req.Status,
		TargetType:     req.TargetType,
		TargetId:       targetID,
		ReporterUserId: reporterID,
		CreatedAtFrom:  start,
		CreatedAtTo:    end,
	}, nil
}

func resolveStatusAndResolution(raw string) (string, string, error) {
	value := strings.ToLower(strings.TrimSpace(raw))
	switch value {
	case "accepted":
		return "accepted", "accepted", nil
	case "rejected":
		return "rejected", "rejected", nil
	case "resolved", "":
		return "resolved", "resolved", nil
	default:
		return "", "", commonresponse.BadRequest("resolution must be accepted, rejected or resolved")
	}
}

func applyModerationAction(ctx context.Context, svcCtx *svc.ServiceContext, action, targetType string, targetID uint64) error {
	action = strings.ToLower(strings.TrimSpace(action))
	if action == "" {
		return nil
	}
	switch action {
	case "hide_post":
		return svcCtx.PostModel.SetStatus(ctx, targetID, "hidden")
	case "restore_post":
		return svcCtx.PostModel.SetStatus(ctx, targetID, "active")
	case "hide_comment":
		return svcCtx.CommentRecordModel.SetStatus(ctx, targetID, "hidden")
	case "restore_comment":
		return svcCtx.CommentRecordModel.SetStatus(ctx, targetID, "active")
	case "lock_forum_post":
		return svcCtx.PostDiscussionModel.SetLocked(ctx, targetID, true)
	case "unlock_forum_post":
		return svcCtx.PostDiscussionModel.SetLocked(ctx, targetID, false)
	default:
		if strings.TrimSpace(targetType) == "" {
			return commonresponse.BadRequest("unknown moderation action")
		}
		return commonresponse.BadRequest("unknown moderation action")
	}
}

func optionalSQLString(value string) sql.NullString {
	value = strings.TrimSpace(value)
	return sql.NullString{String: value, Valid: value != ""}
}
