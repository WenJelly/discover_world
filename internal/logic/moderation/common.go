package moderation

import (
	"context"
	"database/sql"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	commonauth "discover_world/internal/common/auth"
	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
	"discover_world/model"
)

const (
	moderationTargetPost    = "post"
	moderationTargetComment = "comment_record"
	moderationStatusOpen    = "open"
	maxReportReasonLength   = 80
	maxReportDescriptionLen = 500
)

func loadLoginUser(ctx context.Context, svcCtx *svc.ServiceContext) (*model.UserAccount, error) {
	return commonauth.LoadRequiredLoginUser(ctx, svcCtx, "")
}

func parseRequiredID(raw, field string) (uint64, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return 0, commonresponse.BadRequest(field + " must be a positive integer")
	}
	id, err := strconv.ParseUint(raw, 10, 64)
	if err != nil || id == 0 {
		return 0, commonresponse.BadRequest(field + " must be a positive integer")
	}
	return id, nil
}

func normalizeReportTargetType(targetType string) (string, error) {
	targetType = strings.ToLower(strings.TrimSpace(targetType))
	switch targetType {
	case moderationTargetPost, moderationTargetComment:
		return targetType, nil
	default:
		return "", commonresponse.BadRequest("targetType must be post or comment_record")
	}
}

func normalizeReportReason(reason string) (string, error) {
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return "", commonresponse.BadRequest("reason is required")
	}
	if utf8.RuneCountInString(reason) > maxReportReasonLength {
		return "", commonresponse.BadRequest("reason length cannot exceed 80")
	}
	return reason, nil
}

func normalizeReportDescription(description string) (sql.NullString, error) {
	description = strings.TrimSpace(description)
	if utf8.RuneCountInString(description) > maxReportDescriptionLen {
		return sql.NullString{}, commonresponse.BadRequest("description length cannot exceed 500")
	}
	if description == "" {
		return sql.NullString{}, nil
	}
	return sql.NullString{String: description, Valid: true}, nil
}

func formatID(id uint64) string {
	if id == 0 {
		return ""
	}
	return strconv.FormatUint(id, 10)
}

func formatNullableID(id sql.NullInt64) string {
	if !id.Valid || id.Int64 <= 0 {
		return ""
	}
	return strconv.FormatInt(id.Int64, 10)
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
	return value.Format("2006-01-02 15:04:05")
}

func formatNullTime(value sql.NullTime) string {
	if !value.Valid {
		return ""
	}
	return formatTime(value.Time)
}
