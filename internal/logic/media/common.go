package media

import (
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"strconv"
	"strings"
	"time"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/types"
)

const (
	MaxMultipartMemory   = 32 << 20
	MaxFileUploadSize    = 30 << 20
	UploadRequestTimeout = 60 * time.Second

	defaultMediaPageNum        = 1
	defaultMediaPageSize       = 10
	maxMediaPageSize           = 300
	defaultMediaCursorPageSize = 30
	maxMediaCursorPageSize     = 60

	maxURLUploadSize          = 10 << 20
	compressedImageThreshold  = 2 << 20
	mediumCompressedThreshold = 5 << 20
	largeCompressedThreshold  = 10 << 20
	compressedImageMaxEdge    = 2560
	maxVariantCropDimension   = 4096

	targetTypeMediaAsset = "media_asset"
	assetUsageWork       = "work"
	assetUsagePost       = "post"
	assetUsageAvatar     = "avatar"
	assetUsageTemp       = "temp"
)

type mediaCursorPayload struct {
	ID uint64 `json:"id"`
}

type mediaMetadata struct {
	UsageType     string   `json:"usageType,omitempty"`
	Category      string   `json:"category,omitempty"`
	Tags          []string `json:"tags,omitempty"`
	DominantColor string   `json:"dominantColor,omitempty"`
	BlurHash      string   `json:"blurHash,omitempty"`
	ReviewMessage string   `json:"reviewMessage,omitempty"`
	ReviewerId    string   `json:"reviewerId,omitempty"`
	ReviewTime    string   `json:"reviewTime,omitempty"`
}

func formatID(id uint64) string {
	if id == 0 {
		return ""
	}
	return strconv.FormatUint(id, 10)
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

func normalizeMediaPage(pageNum, pageSize int64) (int64, int64, error) {
	if pageNum <= 0 {
		pageNum = defaultMediaPageNum
	}
	if pageSize <= 0 {
		pageSize = defaultMediaPageSize
	}
	if pageSize > maxMediaPageSize {
		return 0, 0, commonresponse.BadRequest("pageSize 不能超过 300")
	}
	return pageNum, pageSize, nil
}

func normalizeMediaCursorPage(pageSize int64) (int64, error) {
	if pageSize <= 0 {
		return defaultMediaCursorPageSize, nil
	}
	if pageSize > maxMediaCursorPageSize {
		return 0, commonresponse.BadRequest("pageSize 不能超过 60")
	}
	return pageSize, nil
}

func encodeMediaCursor(id uint64) (string, error) {
	data, err := json.Marshal(mediaCursorPayload{ID: id})
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(data), nil
}

func decodeMediaCursor(raw string) (uint64, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return 0, nil
	}

	data, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		return 0, commonresponse.BadRequest("cursor 无效")
	}

	var payload mediaCursorPayload
	if err := json.Unmarshal(data, &payload); err != nil || payload.ID == 0 {
		return 0, commonresponse.BadRequest("cursor 无效")
	}
	return payload.ID, nil
}

func normalizeTags(tags []string) []string {
	if len(tags) == 0 {
		return nil
	}

	seen := make(map[string]struct{}, len(tags))
	normalized := make([]string, 0, len(tags))
	for _, tag := range tags {
		tag = strings.TrimSpace(tag)
		if tag == "" {
			continue
		}
		if _, ok := seen[tag]; ok {
			continue
		}
		seen[tag] = struct{}{}
		normalized = append(normalized, tag)
	}
	if len(normalized) == 0 {
		return nil
	}
	return normalized
}

func ParseTagsInput(raw string) ([]string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}
	if strings.HasPrefix(raw, "[") {
		var tags []string
		if err := json.Unmarshal([]byte(raw), &tags); err != nil {
			return nil, err
		}
		return normalizeTags(tags), nil
	}
	return normalizeTags(strings.Split(raw, ",")), nil
}

func parseMediaMetadata(raw sql.NullString) mediaMetadata {
	if !raw.Valid || strings.TrimSpace(raw.String) == "" {
		return mediaMetadata{}
	}

	var metadata mediaMetadata
	if err := json.Unmarshal([]byte(raw.String), &metadata); err != nil {
		return mediaMetadata{}
	}
	metadata.Tags = normalizeTags(metadata.Tags)
	return metadata
}

func metadataJSON(metadata mediaMetadata) sql.NullString {
	metadata.UsageType = strings.TrimSpace(metadata.UsageType)
	metadata.Category = strings.TrimSpace(metadata.Category)
	metadata.Tags = normalizeTags(metadata.Tags)
	metadata.DominantColor = strings.TrimSpace(metadata.DominantColor)
	metadata.BlurHash = strings.TrimSpace(metadata.BlurHash)
	metadata.ReviewMessage = strings.TrimSpace(metadata.ReviewMessage)
	metadata.ReviewerId = strings.TrimSpace(metadata.ReviewerId)
	metadata.ReviewTime = strings.TrimSpace(metadata.ReviewTime)

	data, err := json.Marshal(metadata)
	if err != nil || string(data) == "{}" {
		return sql.NullString{}
	}
	return sql.NullString{String: string(data), Valid: true}
}

func mergeReviewMetadata(raw sql.NullString, reviewMessage, reviewerID, reviewTime string) sql.NullString {
	metadata := parseMediaMetadata(raw)
	metadata.ReviewMessage = reviewMessage
	metadata.ReviewerId = reviewerID
	metadata.ReviewTime = reviewTime
	return metadataJSON(metadata)
}

func optionalString(value string) sql.NullString {
	value = strings.TrimSpace(value)
	if value == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: value, Valid: true}
}

func optionalInt64(value int64) sql.NullInt64 {
	if value <= 0 {
		return sql.NullInt64{}
	}
	return sql.NullInt64{Int64: value, Valid: true}
}

func nullStringValue(value sql.NullString) string {
	if !value.Valid {
		return ""
	}
	return value.String
}

func nullInt64Value(value sql.NullInt64) int64 {
	if !value.Valid {
		return 0
	}
	return value.Int64
}

func nullTimeValue(value sql.NullTime) string {
	if !value.Valid {
		return ""
	}
	return formatTime(value.Time)
}

func formatTime(value time.Time) string {
	if value.IsZero() {
		return ""
	}
	return value.Format("2006-01-02 15:04:05")
}

func uint64ToInt64(value uint64) int64 {
	if value > uint64(^uint64(0)>>1) {
		return int64(^uint64(0) >> 1)
	}
	return int64(value)
}

func contentTypeForFormat(format string) string {
	switch strings.ToLower(format) {
	case "jpg", "jpeg":
		return "image/jpeg"
	case "png":
		return "image/png"
	case "webp":
		return "image/webp"
	default:
		return "application/octet-stream"
	}
}

func normalizeVisibility(visibility string) string {
	switch strings.ToLower(strings.TrimSpace(visibility)) {
	case "private", "followers", "unlisted":
		return strings.ToLower(strings.TrimSpace(visibility))
	default:
		return "public"
	}
}

func normalizeUsageType(usageType string) string {
	usageType = strings.ToLower(strings.TrimSpace(usageType))
	if usageType == "" {
		return "media"
	}
	return usageType
}

func normalizeAssetUsage(assetUsage string) string {
	switch strings.ToLower(strings.TrimSpace(assetUsage)) {
	case assetUsagePost:
		return assetUsagePost
	case assetUsageAvatar:
		return assetUsageAvatar
	case assetUsageTemp:
		return assetUsageTemp
	default:
		return assetUsageWork
	}
}

func normalizeAuditStatus(status string, fallback string) (string, error) {
	status = strings.ToLower(strings.TrimSpace(status))
	if status == "" {
		status = fallback
	}
	switch status {
	case "pending", "approved", "rejected", "all":
		return status, nil
	default:
		return "", commonresponse.BadRequest("auditStatus 只能是 pending、approved、rejected 或 all")
	}
}

func initialUploadAuditStatus() string {
	return "approved"
}

func variantOrDefault(option types.MediaVariantRequest, fallback int64) types.MediaVariantRequest {
	if option.CompressType == 0 {
		option.CompressType = fallback
	}
	return option
}
