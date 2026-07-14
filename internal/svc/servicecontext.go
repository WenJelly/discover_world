// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package svc

import (
	"context"
	accountmodel "discover_world/model/account"
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
	Models ModelSet

	AdminCheck        rest.Middleware
	LoginRateLimit    rest.Middleware
	RegisterRateLimit rest.Middleware
	SearchRateLimit   rest.Middleware
	TokenRevocation   rest.Middleware
	dbConn            sqlx.SqlConn

	IpGeoResolver commonipgeo.Resolver
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
		Config:        c,
		Redis:         redisClient,
		Models:        newModelSet(conn),
		dbConn:        conn,
		IpGeoResolver: commonipgeo.NewResolver(c.IpGeo),
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

func (s *ServiceContext) AuthSecret() string {
	return s.Config.Auth.AccessSecret
}

func (s *ServiceContext) FindActiveAccount(ctx context.Context, id uint64) (*accountmodel.UserAccount, error) {
	return s.Models.Account.UserAccount.FindOneActive(ctx, id)
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
