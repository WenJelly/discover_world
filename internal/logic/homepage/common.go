package homepage

import (
	"context"
	mediamodel "discover_world/model/media"
	"encoding/json"
	"github.com/zeromicro/go-zero/core/stores/sqlx"
	"strconv"
	"strings"

	commonresponse "discover_world/internal/common/response"
	mediaLogic "discover_world/internal/logic/media"
	"discover_world/internal/svc"
	"discover_world/internal/types"
)

const (
	// OwnerTypeSite / OwnerIDSite scope asset_link rows to the site as a whole
	// (a singleton owner), reusing the same generic relation table that powers
	// per-profile featured media.
	OwnerTypeSite = "site"
	OwnerIDSite   = uint64(0)

	// LinkRoleHomepageFeatured is the asset_link role for the homepage featured
	// image stream.
	LinkRoleHomepageFeatured = "homepage_featured"

	// SiteConfigKeyHero is the site_config key holding the homepage hero
	// selection (asset id + focal point) as JSON.
	SiteConfigKeyHero = "homepage_hero"

	// MaxHomepageFeaturedCount caps how many works the featured stream may hold.
	MaxHomepageFeaturedCount = 20
)

// heroConfigPayload is the JSON shape persisted in site_config.config_value for
// the homepage hero. FocalX/FocalY are object-position percentages in [0,100].
type heroConfigPayload struct {
	AssetId uint64  `json:"assetId"`
	FocalX  float64 `json:"focalX"`
	FocalY  float64 `json:"focalY"`
}

// BuildHomepageConfigResponse assembles the public homepage configuration:
// the resolved hero (only if still public+approved) and the ordered featured
// stream. It is shared by the public read handler and the admin write handlers
// so every mutation returns the freshly resolved state.
func BuildHomepageConfigResponse(ctx context.Context, svcCtx *svc.ServiceContext, variant types.MediaVariantRequest) (*types.HomepageConfigResponse, error) {
	hero, err := buildHeroConfig(ctx, svcCtx, variant)
	if err != nil {
		return nil, err
	}

	featured, err := buildFeaturedList(ctx, svcCtx, variant)
	if err != nil {
		return nil, err
	}

	return &types.HomepageConfigResponse{
		Hero:     hero,
		Featured: featured,
	}, nil
}

func buildHeroConfig(ctx context.Context, svcCtx *svc.ServiceContext, variant types.MediaVariantRequest) (types.HomepageHeroConfig, error) {
	hero := types.HomepageHeroConfig{FocalX: 50, FocalY: 50}

	payload, err := loadHeroPayload(ctx, svcCtx)
	if err != nil {
		return hero, err
	}
	if payload == nil || payload.AssetId == 0 {
		return hero, nil
	}

	hero.FocalX = payload.FocalX
	hero.FocalY = payload.FocalY

	assetsByID, err := svcCtx.MediaAssetModel.FindPublicApprovedByIDs(ctx, []uint64{payload.AssetId})
	if err != nil {
		return hero, commonresponse.InternalServerError("查询 Hero 图失败")
	}
	asset := assetsByID[payload.AssetId]
	if asset == nil {
		// The configured hero is no longer public/approved; report it as unset
		// so the homepage falls back to its default behaviour.
		return types.HomepageHeroConfig{FocalX: 50, FocalY: 50}, nil
	}

	list, err := mediaLogic.BuildMediaAssetListResponse(ctx, svcCtx, []*mediamodel.MediaAsset{asset}, nil, variant)
	if err != nil {
		return hero, commonresponse.InternalServerError("构造 Hero 图响应失败")
	}
	if len(list) > 0 {
		hero.AssetId = strconv.FormatUint(payload.AssetId, 10)
		hero.Media = list[0]
	}
	return hero, nil
}

func buildFeaturedList(ctx context.Context, svcCtx *svc.ServiceContext, variant types.MediaVariantRequest) ([]types.MediaAssetResponse, error) {
	assetIDs, err := svcCtx.AssetLinkModel.FindActiveAssetIDsByOwner(ctx, OwnerTypeSite, OwnerIDSite, LinkRoleHomepageFeatured, MaxHomepageFeaturedCount)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询首页精选失败")
	}
	if len(assetIDs) == 0 {
		return []types.MediaAssetResponse{}, nil
	}

	assetsByID, err := svcCtx.MediaAssetModel.FindPublicApprovedByIDs(ctx, assetIDs)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询媒体资源失败")
	}

	assets := make([]*mediamodel.MediaAsset, 0, len(assetIDs))
	for _, id := range assetIDs {
		if asset := assetsByID[id]; asset != nil {
			assets = append(assets, asset)
		}
	}

	list, err := mediaLogic.BuildMediaAssetListResponse(ctx, svcCtx, assets, nil, variant)
	if err != nil {
		return nil, commonresponse.InternalServerError("构造媒体资源响应失败")
	}
	if list == nil {
		list = []types.MediaAssetResponse{}
	}
	return list, nil
}

// loadHeroPayload reads and parses the stored hero config, returning nil when
// nothing is configured yet.
func loadHeroPayload(ctx context.Context, svcCtx *svc.ServiceContext) (*heroConfigPayload, error) {
	config, err := svcCtx.SiteConfigModel.GetByKey(ctx, SiteConfigKeyHero)
	if err != nil {
		if err == sqlx.ErrNotFound {
			return nil, nil
		}
		return nil, commonresponse.InternalServerError("查询站点配置失败")
	}
	if !config.ConfigValue.Valid || strings.TrimSpace(config.ConfigValue.String) == "" {
		return nil, nil
	}

	var payload heroConfigPayload
	if err := json.Unmarshal([]byte(config.ConfigValue.String), &payload); err != nil {
		// Corrupt/legacy value: treat as unset rather than failing the homepage.
		return nil, nil
	}
	return &payload, nil
}

// parseAssetID parses a required positive numeric id from a string field.
func ParseAssetID(raw, field string) (uint64, error) {
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

// ClampFocal constrains a focal-point percentage to [0,100].
func ClampFocal(v float64) float64 {
	if v < 0 {
		return 0
	}
	if v > 100 {
		return 100
	}
	return v
}

// MarshalHeroConfig serialises a hero selection into the JSON value persisted in
// site_config.config_value. A zero assetID represents "no hero configured".
func MarshalHeroConfig(assetID uint64, focalX, focalY float64) (string, error) {
	payload := heroConfigPayload{
		AssetId: assetID,
		FocalX:  ClampFocal(focalX),
		FocalY:  ClampFocal(focalY),
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return "", commonresponse.InternalServerError("序列化 Hero 配置失败")
	}
	return string(raw), nil
}

// ParseFeaturedAssetIDs parses, trims, dedupes and caps the raw featured id list
// submitted by the admin.
func ParseFeaturedAssetIDs(raw []string) ([]uint64, error) {
	if len(raw) > MaxHomepageFeaturedCount {
		return nil, commonresponse.BadRequest("首页精选不能超过 20 张")
	}

	ids := make([]uint64, 0, len(raw))
	seen := make(map[uint64]struct{}, len(raw))
	for _, item := range raw {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		id, err := ParseAssetID(item, "mediaAssetIds")
		if err != nil {
			return nil, err
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	return ids, nil
}
