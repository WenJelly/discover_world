// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package svc

import (
	"context"
	"errors"
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
	dbConn     sqlx.SqlConn

	UserAccountModel        model.UserAccountModel
	UserProfileModel        model.UserProfileModel
	StorageProviderModel    model.StorageProviderModel
	StorageBucketModel      model.StorageBucketModel
	MediaAssetModel         model.MediaAssetModel
	MediaObjectModel        model.MediaObjectModel
	MediaUploadSessionModel model.MediaUploadSessionModel
	EntityStatModel         model.EntityStatModel
	EntityStatHourlyModel   model.EntityStatHourlyModel
	TagModel                model.TagModel
	TaggingModel            model.TaggingModel
	AssetLinkModel          model.AssetLinkModel
	PostModel               model.PostModel
	AlbumModel              model.AlbumModel
	UserFollowModel         model.UserFollowModel
	ReactionModel           model.ReactionModel
	FavoriteModel           model.FavoriteModel
	CommentRecordModel      model.CommentRecordModel
	SiteStatsModel          model.SiteStatsModel
	SiteConfigModel         model.SiteConfigModel
	SearchModel             model.SearchModel
}

func NewServiceContext(c config.Config) *ServiceContext {

	conn := sqlx.NewMysql(c.Mysql.DataSource)

	svcCtx := &ServiceContext{
		Config: c,
		dbConn: conn,

		UserAccountModel:        model.NewUserAccountModel(conn),
		UserProfileModel:        model.NewUserProfileModel(conn),
		StorageProviderModel:    model.NewStorageProviderModel(conn),
		StorageBucketModel:      model.NewStorageBucketModel(conn),
		MediaAssetModel:         model.NewMediaAssetModel(conn),
		MediaObjectModel:        model.NewMediaObjectModel(conn),
		MediaUploadSessionModel: model.NewMediaUploadSessionModel(conn),
		EntityStatModel:         model.NewEntityStatModel(conn),
		EntityStatHourlyModel:   model.NewEntityStatHourlyModel(conn),
		TagModel:                model.NewTagModel(conn),
		TaggingModel:            model.NewTaggingModel(conn),
		AssetLinkModel:          model.NewAssetLinkModel(conn),
		PostModel:               model.NewPostModel(conn),
		AlbumModel:              model.NewAlbumModel(conn),
		UserFollowModel:         model.NewUserFollowModel(conn),
		ReactionModel:           model.NewReactionModel(conn),
		FavoriteModel:           model.NewFavoriteModel(conn),
		CommentRecordModel:      model.NewCommentRecordModel(conn),
		SiteStatsModel:          model.NewSiteStatsModel(conn),
		SiteConfigModel:         model.NewSiteConfigModel(conn),
		SearchModel:             model.NewSearchModel(conn),
	}
	svcCtx.AdminCheck = middleware.NewAdminCheckMiddleware(svcCtx).Handle

	return svcCtx
}

func (s *ServiceContext) Transact(ctx context.Context, fn func(context.Context, *ServiceContext) error) error {
	if s == nil || s.dbConn == nil {
		return errors.New("service context database connection is nil")
	}
	return s.dbConn.TransactCtx(ctx, func(ctx context.Context, session sqlx.Session) error {
		return fn(ctx, s.withSession(session))
	})
}

func (s *ServiceContext) withSession(session sqlx.Session) *ServiceContext {
	conn := sqlx.NewSqlConnFromSession(session)
	return &ServiceContext{
		Config:     s.Config,
		AdminCheck: s.AdminCheck,
		dbConn:     conn,

		UserAccountModel:        model.NewUserAccountModel(conn),
		UserProfileModel:        model.NewUserProfileModel(conn),
		StorageProviderModel:    model.NewStorageProviderModel(conn),
		StorageBucketModel:      model.NewStorageBucketModel(conn),
		MediaAssetModel:         model.NewMediaAssetModel(conn),
		MediaObjectModel:        model.NewMediaObjectModel(conn),
		MediaUploadSessionModel: model.NewMediaUploadSessionModel(conn),
		EntityStatModel:         model.NewEntityStatModel(conn),
		EntityStatHourlyModel:   model.NewEntityStatHourlyModel(conn),
		TagModel:                model.NewTagModel(conn),
		TaggingModel:            model.NewTaggingModel(conn),
		AssetLinkModel:          model.NewAssetLinkModel(conn),
		PostModel:               model.NewPostModel(conn),
		AlbumModel:              model.NewAlbumModel(conn),
		UserFollowModel:         model.NewUserFollowModel(conn),
		ReactionModel:           model.NewReactionModel(conn),
		FavoriteModel:           model.NewFavoriteModel(conn),
		CommentRecordModel:      model.NewCommentRecordModel(conn),
		SiteStatsModel:          model.NewSiteStatsModel(conn),
		SiteConfigModel:         model.NewSiteConfigModel(conn),
		SearchModel:             model.NewSearchModel(conn),
	}
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

	return strings.EqualFold(strings.TrimSpace(account.Role), "admin")
}

func (s *ServiceContext) StorageSecret(ref string) config.StorageSecretConfig {
	ref = strings.TrimSpace(ref)
	if ref == "" {
		ref = "default"
	}
	if s.Config.StorageSecrets != nil {
		if secret, ok := s.Config.StorageSecrets[ref]; ok {
			return secret
		}
	}
	secret, err := config.LoadStorageSecretFile(ref)
	if err != nil {
		return config.StorageSecretConfig{}
	}
	return secret
}
