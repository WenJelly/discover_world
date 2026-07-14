package search

import (
	"database/sql"
	accountmodel "discover_world/model/account"
	profilemodel "discover_world/model/profile"
	searchmodel "discover_world/model/search"
	statisticsmodel "discover_world/model/statistics"
	"strconv"
	"strings"
	"time"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/types"
)

const (
	defaultSearchPageSize = int64(20)
	maxSearchPageSize     = int64(50)

	searchTypeMedia = "media"
	searchTypePost  = "post"
	searchTypeAlbum = "album"
	searchTypeUser  = "user"

	postTypeDaily       = "daily"
	postTypeTravelShare = "travel_share"
)

var defaultSearchTypes = []string{
	searchTypeMedia,
	searchTypePost,
	searchTypeAlbum,
	searchTypeUser,
}

type normalizedSearchRequest struct {
	Query    string
	Types    []string
	PageSize int64
	Variant  types.MediaVariantRequest
}

func normalizeSearchRequest(req *types.GlobalSearchRequest) (normalizedSearchRequest, error) {
	if req == nil {
		req = &types.GlobalSearchRequest{}
	}

	query := strings.TrimSpace(req.Q)
	if query == "" {
		query = strings.TrimSpace(req.SearchText)
	}

	pageSize := req.PageSize
	if pageSize <= 0 {
		pageSize = defaultSearchPageSize
	}
	if pageSize > maxSearchPageSize {
		pageSize = maxSearchPageSize
	}

	variant := req.Variant
	if variant.CompressType == 0 {
		if req.CompressType > 0 {
			variant.CompressType = req.CompressType
		} else {
			variant.CompressType = 2
		}
	}

	searchTypes, err := normalizeSearchTypes(req.Types)
	if err != nil {
		return normalizedSearchRequest{}, err
	}

	return normalizedSearchRequest{
		Query:    query,
		Types:    searchTypes,
		PageSize: pageSize,
		Variant:  variant,
	}, nil
}

func normalizeSearchTypes(raw []string) ([]string, error) {
	if len(raw) == 0 {
		return append([]string(nil), defaultSearchTypes...), nil
	}

	out := make([]string, 0, len(raw))
	seen := make(map[string]struct{}, len(raw))
	for _, item := range raw {
		searchType := strings.ToLower(strings.TrimSpace(item))
		if searchType == "" {
			continue
		}
		switch searchType {
		case searchTypeMedia, searchTypePost, searchTypeAlbum, searchTypeUser:
		default:
			return nil, commonresponse.BadRequest("search types 只能是 media、post、album 或 user")
		}
		if _, ok := seen[searchType]; ok {
			continue
		}
		seen[searchType] = struct{}{}
		out = append(out, searchType)
	}
	if len(out) == 0 {
		return append([]string(nil), defaultSearchTypes...), nil
	}
	return out, nil
}

func includesSearchType(types []string, target string) bool {
	for _, item := range types {
		if item == target {
			return true
		}
	}
	return false
}

func normalizePostTypeValue(postType string) string {
	switch strings.ToLower(strings.TrimSpace(postType)) {
	case postTypeTravelShare:
		return postTypeTravelShare
	default:
		return postTypeDaily
	}
}

func buildAccountSummary(account *accountmodel.UserAccount, profile *profilemodel.UserProfile, avatarURL string) types.AccountSummary {
	if account == nil {
		return types.AccountSummary{}
	}

	nickname := ""
	bio := ""
	if profile != nil {
		nickname = nullStringValue(profile.Nickname)
		bio = nullStringValue(profile.Bio)
	}
	if nickname == "" {
		nickname = account.Username
	}

	return types.AccountSummary{
		Id:        formatID(account.Id),
		Username:  account.Username,
		Email:     "",
		Nickname:  nickname,
		AvatarUrl: avatarURL,
		Bio:       bio,
		Status:    account.Status,
		Role:      accountRole(account),
	}
}

func buildSearchUserSummary(user *searchmodel.SearchUser, avatarURL string) types.AccountSummary {
	if user == nil {
		return types.AccountSummary{}
	}

	nickname := nullStringValue(user.Nickname)
	if nickname == "" {
		nickname = user.Username
	}

	return types.AccountSummary{
		Id:        formatID(user.Id),
		Username:  user.Username,
		Email:     "",
		Nickname:  nickname,
		AvatarUrl: avatarURL,
		Bio:       nullStringValue(user.Bio),
		Status:    user.Status,
		Role:      accountRoleFromString(user.Role),
	}
}

func buildStats(stat *statisticsmodel.EntityStat) types.MediaAssetStats {
	if stat == nil {
		return types.MediaAssetStats{}
	}
	return types.MediaAssetStats{
		ViewCount:     uint64ToInt64(stat.ViewCount),
		ReactionCount: uint64ToInt64(stat.ReactionCount),
		FavoriteCount: uint64ToInt64(stat.FavoriteCount),
		CommentCount:  uint64ToInt64(stat.CommentCount),
		ShareCount:    uint64ToInt64(stat.ShareCount),
		DownloadCount: uint64ToInt64(stat.DownloadCount),
	}
}

func formatID(id uint64) string {
	if id == 0 {
		return ""
	}
	return strconv.FormatUint(id, 10)
}

func nullStringValue(value sql.NullString) string {
	if value.Valid {
		return value.String
	}
	return ""
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

func accountRole(account *accountmodel.UserAccount) string {
	if account == nil {
		return "user"
	}
	return accountRoleFromString(account.Role)
}

func accountRoleFromString(role string) string {
	role = strings.TrimSpace(role)
	if role == "" {
		return "user"
	}
	return role
}
