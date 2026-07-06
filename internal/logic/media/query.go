package media

import (
	"fmt"
	"strings"
	"time"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/types"
)

type mediaListFilter struct {
	Id            string
	Title         string
	Category      string
	AuditStatus   string
	Tags          []string
	FileSize      int64
	Width         int64
	Height        int64
	AspectRatio   float64
	FileExt       string
	OwnerUserId   string
	SearchText    string
	CreatedAtFrom string
	CreatedAtTo   string
}

func queryRequestToFilter(req *types.QueryMediaAssetRequest) mediaListFilter {
	if req == nil {
		return mediaListFilter{}
	}
	return mediaListFilter{
		Id:            req.Id,
		Title:         req.Title,
		Category:      req.Category,
		AuditStatus:   req.AuditStatus,
		Tags:          req.Tags,
		FileSize:      req.FileSize,
		Width:         req.Width,
		Height:        req.Height,
		AspectRatio:   req.AspectRatio,
		FileExt:       req.FileExt,
		OwnerUserId:   req.OwnerUserId,
		SearchText:    req.SearchText,
		CreatedAtFrom: req.CreatedAtFrom,
		CreatedAtTo:   req.CreatedAtTo,
	}
}

func cursorRequestToFilter(req *types.CursorQueryMediaAssetRequest) mediaListFilter {
	if req == nil {
		return mediaListFilter{}
	}
	return mediaListFilter{
		Id:            req.Id,
		Title:         req.Title,
		Category:      req.Category,
		AuditStatus:   req.AuditStatus,
		Tags:          req.Tags,
		FileSize:      req.FileSize,
		Width:         req.Width,
		Height:        req.Height,
		AspectRatio:   req.AspectRatio,
		FileExt:       req.FileExt,
		OwnerUserId:   req.OwnerUserId,
		SearchText:    req.SearchText,
		CreatedAtFrom: req.CreatedAtFrom,
		CreatedAtTo:   req.CreatedAtTo,
	}
}

func adminRequestToFilter(req *types.AdminQueryMediaAssetRequest) mediaListFilter {
	if req == nil {
		return mediaListFilter{}
	}
	return mediaListFilter{
		Id:            req.Id,
		Title:         req.Title,
		Category:      req.Category,
		AuditStatus:   req.AuditStatus,
		Tags:          req.Tags,
		FileSize:      req.FileSize,
		Width:         req.Width,
		Height:        req.Height,
		AspectRatio:   req.AspectRatio,
		FileExt:       req.FileExt,
		OwnerUserId:   req.OwnerUserId,
		SearchText:    req.SearchText,
		CreatedAtFrom: req.CreatedAtFrom,
		CreatedAtTo:   req.CreatedAtTo,
	}
}

func buildPublicMediaAssetListWhere(filter mediaListFilter) (string, []any, error) {
	if strings.TrimSpace(filter.AuditStatus) == "" {
		filter.AuditStatus = "approved"
	}
	return buildMediaAssetListWhere(filter, true)
}

func buildAdminMediaAssetListWhere(filter mediaListFilter) (string, []any, error) {
	if strings.TrimSpace(filter.AuditStatus) == "" {
		filter.AuditStatus = "pending"
	}
	return buildMediaAssetListWhere(filter, false)
}

func NormalizeAdminMediaPage(pageNum, pageSize int64) (int64, int64, error) {
	return normalizeMediaPage(pageNum, pageSize)
}

func BuildAdminMediaAssetListWhere(req *types.AdminQueryMediaAssetRequest) (string, []any, error) {
	return buildAdminMediaAssetListWhere(adminRequestToFilter(req))
}

func buildMediaAssetListWhere(filter mediaListFilter, publicOnly bool) (string, []any, error) {
	conditions := []string{"`status` <> 'deleted'", "`deleted_at` is null"}
	args := make([]any, 0)

	if publicOnly {
		conditions = append(conditions, "`status` = 'active'", "`visibility` = 'public'")
		conditions = append(conditions, "`asset_usage` = ?")
		args = append(args, assetUsageWork)
	}

	auditStatus, err := normalizeAuditStatus(filter.AuditStatus, "")
	if err != nil {
		return "", nil, err
	}
	if publicOnly && auditStatus == "" {
		auditStatus = "approved"
	}
	if auditStatus != "" && auditStatus != "all" {
		conditions = append(conditions, "`audit_status` = ?")
		args = append(args, auditStatus)
	}

	if id, err := parseOptionalID(filter.Id, "id"); err != nil {
		return "", nil, err
	} else if id > 0 {
		conditions = append(conditions, "`id` = ?")
		args = append(args, id)
	}

	if ownerID, err := parseOptionalID(filter.OwnerUserId, "ownerUserId"); err != nil {
		return "", nil, err
	} else if ownerID > 0 {
		conditions = append(conditions, "`owner_user_id` = ?")
		args = append(args, ownerID)
	}

	if value := strings.TrimSpace(filter.Title); value != "" {
		conditions = append(conditions, "`title` like ?")
		args = append(args, "%"+value+"%")
	}
	if value := strings.TrimSpace(filter.SearchText); value != "" {
		conditions = append(conditions, "(`title` like ? or `description` like ? or `original_filename` like ?)")
		like := "%" + value + "%"
		args = append(args, like, like, like)
	}
	if value := strings.TrimSpace(filter.Category); value != "" {
		conditions = append(conditions, "json_unquote(json_extract(`metadata_json`, '$.category')) = ?")
		args = append(args, value)
	}
	for _, tag := range normalizeTags(filter.Tags) {
		conditions = append(conditions, "exists (select 1 from `tagging` tg join `tag` t on t.`id` = tg.`tag_id` where tg.`target_type` = 'media_asset' and tg.`target_id` = `media_asset`.`id` and t.`name` = ? and t.`status` = 1)")
		args = append(args, tag)
	}

	objectFilters := make([]string, 0)
	if filter.FileSize > 0 {
		objectFilters = append(objectFilters, "mo.`file_size` = ?")
		args = append(args, filter.FileSize)
	}
	if filter.Width > 0 {
		objectFilters = append(objectFilters, "mo.`width` = ?")
		args = append(args, filter.Width)
	}
	if filter.Height > 0 {
		objectFilters = append(objectFilters, "mo.`height` = ?")
		args = append(args, filter.Height)
	}
	if filter.AspectRatio > 0 {
		objectFilters = append(objectFilters, "mo.`height` > 0 and abs((mo.`width` / mo.`height`) - ?) < 0.01")
		args = append(args, filter.AspectRatio)
	}
	if value := strings.TrimSpace(filter.FileExt); value != "" {
		objectFilters = append(objectFilters, "mo.`file_ext` = ?")
		args = append(args, strings.TrimPrefix(strings.ToLower(value), "."))
	}
	if len(objectFilters) > 0 {
		conditions = append(conditions, fmt.Sprintf("exists (select 1 from `media_object` mo where mo.`asset_id` = `media_asset`.`id` and mo.`object_role` = 'original' and mo.`status` = 'active' and %s)", strings.Join(objectFilters, " and ")))
	}

	if start, err := parseMediaTime(filter.CreatedAtFrom, false); err != nil {
		return "", nil, err
	} else if !start.IsZero() {
		conditions = append(conditions, "`created_at` >= ?")
		args = append(args, start)
	}
	if end, err := parseMediaTime(filter.CreatedAtTo, true); err != nil {
		return "", nil, err
	} else if !end.IsZero() {
		conditions = append(conditions, "`created_at` <= ?")
		args = append(args, end)
	}

	return strings.Join(conditions, " and "), args, nil
}

func parseMediaTime(raw string, endOfDay bool) (time.Time, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return time.Time{}, nil
	}

	for _, layout := range []string{"2006-01-02 15:04:05", time.RFC3339, "2006-01-02"} {
		parsed, err := time.ParseInLocation(layout, raw, time.Local)
		if err == nil {
			if layout == "2006-01-02" && endOfDay {
				parsed = parsed.Add(24*time.Hour - time.Nanosecond)
			}
			return parsed, nil
		}
	}

	return time.Time{}, commonresponse.BadRequest("时间格式必须是 yyyy-MM-dd 或 yyyy-MM-dd HH:mm:ss")
}
