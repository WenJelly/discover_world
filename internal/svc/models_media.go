package svc

import (
	mediamodel "discover_world/model/media"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

type MediaModels struct {
	StorageProvider    mediamodel.StorageProviderModel
	StorageBucket      mediamodel.StorageBucketModel
	MediaAsset         mediamodel.MediaAssetModel
	MediaObject        mediamodel.MediaObjectModel
	MediaUploadSession mediamodel.MediaUploadSessionModel
	MediaVariantRule   mediamodel.MediaVariantRuleModel
	AssetLink          mediamodel.AssetLinkModel
	ShareLink          mediamodel.ShareLinkModel
}

func newMediaModels(conn sqlx.SqlConn) MediaModels {
	return MediaModels{
		StorageProvider:    mediamodel.NewStorageProviderModel(conn),
		StorageBucket:      mediamodel.NewStorageBucketModel(conn),
		MediaAsset:         mediamodel.NewMediaAssetModel(conn),
		MediaObject:        mediamodel.NewMediaObjectModel(conn),
		MediaUploadSession: mediamodel.NewMediaUploadSessionModel(conn),
		MediaVariantRule:   mediamodel.NewMediaVariantRuleModel(conn),
		AssetLink:          mediamodel.NewAssetLinkModel(conn),
		ShareLink:          mediamodel.NewShareLinkModel(conn),
	}
}
