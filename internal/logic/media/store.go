package media

import (
	"context"
	statisticsmodel "discover_world/model/statistics"
	"errors"
	"github.com/zeromicro/go-zero/core/stores/sqlx"
	"strings"

	"discover_world/internal/svc"
)

func replaceAssetTags(ctx context.Context, svcCtx *svc.ServiceContext, assetID uint64, tags []string) error {
	tags = normalizeTags(tags)
	tagIDs := make([]uint64, 0, len(tags))
	for _, name := range tags {
		tag, err := svcCtx.Models.Taxonomy.Tag.EnsureByName(ctx, name)
		if err != nil {
			return err
		}
		tagIDs = append(tagIDs, tag.Id)
	}
	return svcCtx.Models.Taxonomy.Tagging.ReplaceTargetTags(ctx, targetTypeMediaAsset, assetID, tagIDs)
}

func ensureEntityStat(ctx context.Context, svcCtx *svc.ServiceContext, assetID uint64) {
	_, err := svcCtx.Models.Statistics.EntityStat.FindOneByTargetTypeTargetId(ctx, targetTypeMediaAsset, assetID)
	if errors.Is(err, sqlx.ErrNotFound) {
		_, _ = svcCtx.Models.Statistics.EntityStat.Insert(ctx, &statisticsmodel.EntityStat{
			TargetType: targetTypeMediaAsset,
			TargetId:   assetID,
		})
	}
}

func resolveMediaTitle(title, originalFilename string) string {
	title = strings.TrimSpace(title)
	if title != "" {
		return title
	}
	name := strings.TrimSpace(originalFilename)
	if name == "" {
		return "未命名媒体"
	}
	if dot := strings.LastIndex(name, "."); dot > 0 {
		name = name[:dot]
	}
	if name == "" {
		return "未命名媒体"
	}
	return name
}
