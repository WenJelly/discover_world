// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package svc

import (
	"context"
	"database/sql"
	"strings"

	"discover_world/internal/config"
	"discover_world/internal/middleware"
	"discover_world/model"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
	"github.com/zeromicro/go-zero/rest"
)

type ServiceContext struct {
	Config config.Config

	AdminCheck rest.Middleware

	UserAccountModel     model.UserAccountModel
	UserProfileModel     model.UserProfileModel
	StorageProviderModel model.StorageProviderModel
	StorageBucketModel   model.StorageBucketModel
	MediaAssetModel      model.MediaAssetModel
	MediaObjectModel     model.MediaObjectModel
	EntityStatModel      model.EntityStatModel
	TagModel             model.TagModel
	TaggingModel         model.TaggingModel
	AssetLinkModel       model.AssetLinkModel
	PostModel            model.PostModel
	AlbumModel           model.AlbumModel
	SiteStatsModel       model.SiteStatsModel
}

func NewServiceContext(c config.Config) *ServiceContext {

	conn := sqlx.NewMysql(c.Mysql.DataSource)

	svcCtx := &ServiceContext{
		Config: c,

		UserAccountModel:     model.NewUserAccountModel(conn),
		UserProfileModel:     model.NewUserProfileModel(conn),
		StorageProviderModel: model.NewStorageProviderModel(conn),
		StorageBucketModel:   model.NewStorageBucketModel(conn),
		MediaAssetModel:      model.NewMediaAssetModel(conn),
		MediaObjectModel:     model.NewMediaObjectModel(conn),
		EntityStatModel:      model.NewEntityStatModel(conn),
		TagModel:             model.NewTagModel(conn),
		TaggingModel:         model.NewTaggingModel(conn),
		AssetLinkModel:       model.NewAssetLinkModel(conn),
		PostModel:            model.NewPostModel(conn),
		AlbumModel:           model.NewAlbumModel(conn),
		SiteStatsModel:       model.NewSiteStatsModel(conn),
	}
	svcCtx.AdminCheck = middleware.NewAdminCheckMiddleware(svcCtx).Handle

	return svcCtx
}

func (s *ServiceContext) AuthSecret() string {
	return s.Config.Auth.AccessSecret
}

func (s *ServiceContext) FindActiveAccount(ctx context.Context, id uint64) (*model.UserAccount, error) {
	return s.UserAccountModel.FindOneActive(ctx, id)
}

func (s *ServiceContext) IsAdminAccount(account *model.UserAccount) bool {
	if account == nil {
		return false
	}

	username := strings.TrimSpace(account.Username)
	email := nullStringValue(account.Email)

	for _, configured := range s.Config.Admin.Usernames {
		if strings.EqualFold(strings.TrimSpace(configured), username) {
			return true
		}
	}
	for _, configured := range s.Config.Admin.Emails {
		if strings.EqualFold(strings.TrimSpace(configured), email) {
			return true
		}
	}

	return strings.EqualFold(username, "admin")
}

func (s *ServiceContext) StorageSecret(ref string) config.StorageSecretConfig {
	ref = strings.TrimSpace(ref)
	if ref == "" {
		ref = "default"
	}
	if s.Config.StorageSecrets == nil {
		return config.StorageSecretConfig{}
	}
	return s.Config.StorageSecrets[ref]
}

func nullStringValue(value sql.NullString) string {
	if !value.Valid {
		return ""
	}
	return strings.TrimSpace(value.String)
}
