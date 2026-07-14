// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package svc

import (
	"context"
	accountmodel "discover_world/model/account"
	adminmodel "discover_world/model/admin"
	followmodel "discover_world/model/follow"
	forummodel "discover_world/model/forum"
	homepagemodel "discover_world/model/homepage"
	interactionmodel "discover_world/model/interaction"
	mediamodel "discover_world/model/media"
	moderationmodel "discover_world/model/moderation"
	notificationmodel "discover_world/model/notification"
	postmodel "discover_world/model/post"
	profilemodel "discover_world/model/profile"
	searchmodel "discover_world/model/search"
	statisticsmodel "discover_world/model/statistics"
	taxonomymodel "discover_world/model/taxonomy"
	"errors"
	"strings"
	"time"

	commonipgeo "discover_world/internal/common/ipgeo"
	"discover_world/internal/config"
	"discover_world/internal/middleware"
	"discover_world/internal/redisx"
	"github.com/zeromicro/go-zero/core/logx"
	"github.com/zeromicro/go-zero/core/stores/sqlx"
	"github.com/zeromicro/go-zero/rest"
)

type databasePool interface {
	SetMaxOpenConns(int)
	SetMaxIdleConns(int)
	SetConnMaxLifetime(time.Duration)
	SetConnMaxIdleTime(time.Duration)
}

type ServiceContext struct {
	Config config.Config
	Redis  *redisx.Client

	AdminCheck        rest.Middleware
	LoginRateLimit    rest.Middleware
	RegisterRateLimit rest.Middleware
	SearchRateLimit   rest.Middleware
	TokenRevocation   rest.Middleware
	dbConn            sqlx.SqlConn

	UserAccountModel          accountmodel.UserAccountModel
	UserProfileModel          profilemodel.UserProfileModel
	StorageProviderModel      mediamodel.StorageProviderModel
	StorageBucketModel        mediamodel.StorageBucketModel
	MediaAssetModel           mediamodel.MediaAssetModel
	MediaObjectModel          mediamodel.MediaObjectModel
	MediaUploadSessionModel   mediamodel.MediaUploadSessionModel
	EntityStatModel           statisticsmodel.EntityStatModel
	EntityStatHourlyModel     statisticsmodel.EntityStatHourlyModel
	EntityRankingModel        statisticsmodel.EntityRankingModel
	TagModel                  taxonomymodel.TagModel
	TaggingModel              taxonomymodel.TaggingModel
	AssetLinkModel            mediamodel.AssetLinkModel
	PostModel                 postmodel.PostModel
	ForumBoardModel           forummodel.ForumBoardModel
	PostDiscussionModel       postmodel.PostDiscussionModel
	ModerationReportModel     moderationmodel.ModerationReportModel
	NotificationModel         notificationmodel.NotificationModel
	ContentIpAttributionModel moderationmodel.ContentIpAttributionModel
	AdminOperationLogModel    adminmodel.AdminOperationLogModel
	AdminRolePolicyModel      adminmodel.AdminRolePolicyModel
	AlbumModel                profilemodel.AlbumModel
	UserFollowModel           followmodel.UserFollowModel
	ReactionModel             interactionmodel.ReactionModel
	FavoriteModel             interactionmodel.FavoriteModel
	CommentRecordModel        postmodel.CommentRecordModel
	SiteStatsModel            statisticsmodel.SiteStatsModel
	SiteConfigModel           homepagemodel.SiteConfigModel
	SearchModel               searchmodel.SearchModel
	IpGeoResolver             commonipgeo.Resolver
}

func NewServiceContext(c config.Config) *ServiceContext {
	c.Normalize()

	conn := sqlx.NewMysql(c.Mysql.DataSource)
	db, err := conn.RawDB()
	logx.Must(err)
	applyDatabasePoolSettings(db, c.Mysql)
	redisClient, err := redisx.NewConfiguredClient(c.Redis.Nodes, c.Redis.KeyPrefix)
	logx.Must(err)
	if redisClient == nil {
		logx.Must(redisx.ErrUnavailable)
	}

	svcCtx := &ServiceContext{
		Config: c,
		Redis:  redisClient,
		dbConn: conn,

		UserAccountModel:          accountmodel.NewUserAccountModel(conn),
		UserProfileModel:          profilemodel.NewUserProfileModel(conn),
		StorageProviderModel:      mediamodel.NewStorageProviderModel(conn),
		StorageBucketModel:        mediamodel.NewStorageBucketModel(conn),
		MediaAssetModel:           mediamodel.NewMediaAssetModel(conn),
		MediaObjectModel:          mediamodel.NewMediaObjectModel(conn),
		MediaUploadSessionModel:   mediamodel.NewMediaUploadSessionModel(conn),
		EntityStatModel:           statisticsmodel.NewEntityStatModel(conn),
		EntityStatHourlyModel:     statisticsmodel.NewEntityStatHourlyModel(conn),
		EntityRankingModel:        statisticsmodel.NewEntityRankingModel(conn),
		TagModel:                  taxonomymodel.NewTagModel(conn),
		TaggingModel:              taxonomymodel.NewTaggingModel(conn),
		AssetLinkModel:            mediamodel.NewAssetLinkModel(conn),
		PostModel:                 postmodel.NewPostModel(conn),
		ForumBoardModel:           forummodel.NewForumBoardModel(conn),
		PostDiscussionModel:       postmodel.NewPostDiscussionModel(conn),
		ModerationReportModel:     moderationmodel.NewModerationReportModel(conn),
		NotificationModel:         notificationmodel.NewNotificationModel(conn),
		ContentIpAttributionModel: moderationmodel.NewContentIpAttributionModel(conn),
		AdminOperationLogModel:    adminmodel.NewAdminOperationLogModel(conn),
		AdminRolePolicyModel:      adminmodel.NewAdminRolePolicyModel(conn),
		AlbumModel:                profilemodel.NewAlbumModel(conn),
		UserFollowModel:           followmodel.NewUserFollowModel(conn),
		ReactionModel:             interactionmodel.NewReactionModel(conn),
		FavoriteModel:             interactionmodel.NewFavoriteModel(conn),
		CommentRecordModel:        postmodel.NewCommentRecordModel(conn),
		SiteStatsModel:            statisticsmodel.NewSiteStatsModel(conn),
		SiteConfigModel:           homepagemodel.NewSiteConfigModel(conn),
		SearchModel:               searchmodel.NewSearchModel(conn),
		IpGeoResolver:             commonipgeo.NewResolver(c.IpGeo),
	}
	svcCtx.AdminCheck = middleware.NewAdminCheckMiddleware(svcCtx).Handle
	svcCtx.LoginRateLimit = middleware.NewLoginRateLimitMiddleware(redisClient, c.Auth.AccessSecret, c.Redis.RateLimit.LoginIPLimit).Handle
	svcCtx.RegisterRateLimit = middleware.NewRegisterRateLimitMiddleware(redisClient, c.Auth.AccessSecret, c.Redis.RateLimit.RegisterIPLimit).Handle
	svcCtx.SearchRateLimit = middleware.NewSearchRateLimitMiddleware(redisClient, c.Auth.AccessSecret, c.Redis.RateLimit.SearchIPLimit).Handle
	svcCtx.TokenRevocation = middleware.NewTokenRevocationMiddleware(redisClient, c.Auth.AccessSecret).Handle

	return svcCtx
}

func applyDatabasePoolSettings(pool databasePool, c config.MysqlConfig) {
	if pool == nil {
		return
	}
	pool.SetMaxOpenConns(c.MaxOpenConns)
	pool.SetMaxIdleConns(c.MaxIdleConns)
	pool.SetConnMaxLifetime(time.Duration(c.ConnMaxLifetimeSeconds) * time.Second)
	pool.SetConnMaxIdleTime(time.Duration(c.ConnMaxIdleTimeSeconds) * time.Second)
}

func (s *ServiceContext) Close() {
	if s == nil || s.IpGeoResolver == nil {
		return
	}
	if closer, ok := s.IpGeoResolver.(interface{ Close() }); ok {
		closer.Close()
	}
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
		Config:            s.Config,
		Redis:             s.Redis,
		AdminCheck:        s.AdminCheck,
		LoginRateLimit:    s.LoginRateLimit,
		RegisterRateLimit: s.RegisterRateLimit,
		SearchRateLimit:   s.SearchRateLimit,
		TokenRevocation:   s.TokenRevocation,
		dbConn:            conn,

		UserAccountModel:          accountmodel.NewUserAccountModel(conn),
		UserProfileModel:          profilemodel.NewUserProfileModel(conn),
		StorageProviderModel:      mediamodel.NewStorageProviderModel(conn),
		StorageBucketModel:        mediamodel.NewStorageBucketModel(conn),
		MediaAssetModel:           mediamodel.NewMediaAssetModel(conn),
		MediaObjectModel:          mediamodel.NewMediaObjectModel(conn),
		MediaUploadSessionModel:   mediamodel.NewMediaUploadSessionModel(conn),
		EntityStatModel:           statisticsmodel.NewEntityStatModel(conn),
		EntityStatHourlyModel:     statisticsmodel.NewEntityStatHourlyModel(conn),
		EntityRankingModel:        statisticsmodel.NewEntityRankingModel(conn),
		TagModel:                  taxonomymodel.NewTagModel(conn),
		TaggingModel:              taxonomymodel.NewTaggingModel(conn),
		AssetLinkModel:            mediamodel.NewAssetLinkModel(conn),
		PostModel:                 postmodel.NewPostModel(conn),
		ForumBoardModel:           forummodel.NewForumBoardModel(conn),
		PostDiscussionModel:       postmodel.NewPostDiscussionModel(conn),
		ModerationReportModel:     moderationmodel.NewModerationReportModel(conn),
		NotificationModel:         notificationmodel.NewNotificationModel(conn),
		ContentIpAttributionModel: moderationmodel.NewContentIpAttributionModel(conn),
		AdminOperationLogModel:    adminmodel.NewAdminOperationLogModel(conn),
		AdminRolePolicyModel:      adminmodel.NewAdminRolePolicyModel(conn),
		AlbumModel:                profilemodel.NewAlbumModel(conn),
		UserFollowModel:           followmodel.NewUserFollowModel(conn),
		ReactionModel:             interactionmodel.NewReactionModel(conn),
		FavoriteModel:             interactionmodel.NewFavoriteModel(conn),
		CommentRecordModel:        postmodel.NewCommentRecordModel(conn),
		SiteStatsModel:            statisticsmodel.NewSiteStatsModel(conn),
		SiteConfigModel:           homepagemodel.NewSiteConfigModel(conn),
		SearchModel:               searchmodel.NewSearchModel(conn),
		IpGeoResolver:             s.IpGeoResolver,
	}
}

func (s *ServiceContext) AuthSecret() string {
	return s.Config.Auth.AccessSecret
}

func (s *ServiceContext) FindActiveAccount(ctx context.Context, id uint64) (*accountmodel.UserAccount, error) {
	return s.UserAccountModel.FindOneActive(ctx, id)
}

func (s *ServiceContext) IsAdminAccount(account *accountmodel.UserAccount) bool {
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
