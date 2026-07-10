package admin

import (
	"database/sql"
	"strconv"
	"strings"
	"time"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/types"
	"discover_world/model"
)

const (
	adminTargetMediaAsset          = "media_asset"
	adminTargetTag                 = "tag"
	adminTargetOperationLog        = "admin_operation_log"
	adminOwnerTypeSite             = "site"
	adminOwnerIDSite        uint64 = 0
	adminLinkRoleFeatured          = "homepage_featured"
)

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
	return value.Format(time.RFC3339)
}

func formatNullTime(value sql.NullTime) string {
	if !value.Valid {
		return ""
	}
	return formatTime(value.Time)
}

func buildAdminAccountSummary(account *model.UserAccount, profile *model.UserProfile) types.AccountSummary {
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
		Nickname: nickname,
		Bio:      bio,
		Status:   account.Status,
		Role:     strings.TrimSpace(account.Role),
	}
}

func buildAdminTagResponse(tag *model.Tag) types.AdminTagResponse {
	if tag == nil {
		return types.AdminTagResponse{}
	}
	return types.AdminTagResponse{
		Id:        formatID(tag.Id),
		Name:      tag.Name,
		Slug:      nullStringValue(tag.Slug),
		TagType:   tag.TagType,
		Status:    tag.Status,
		CreatedAt: formatTime(tag.CreatedAt),
	}
}

func buildAdminOperationLogResponse(row *model.AdminOperationLog) types.AdminOperationLogResponse {
	if row == nil {
		return types.AdminOperationLogResponse{}
	}
	return types.AdminOperationLogResponse{
		Id:             formatID(row.Id),
		OperatorUserId: formatID(row.OperatorUserId),
		Action:         row.Action,
		TargetType:     row.TargetType,
		TargetId:       formatID(row.TargetId),
		Reason:         nullStringValue(row.Reason),
		BeforeJson:     nullStringValue(row.BeforeJson),
		AfterJson:      nullStringValue(row.AfterJson),
		MetadataJson:   nullStringValue(row.MetadataJson),
		ClientIp:       nullStringValue(row.ClientIp),
		CreatedAt:      formatTime(row.CreatedAt),
	}
}
