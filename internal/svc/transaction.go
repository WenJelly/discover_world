package svc

import (
	"context"
	"errors"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

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
		Models:            newModelSet(conn),
		AdminCheck:        s.AdminCheck,
		LoginRateLimit:    s.LoginRateLimit,
		RegisterRateLimit: s.RegisterRateLimit,
		SearchRateLimit:   s.SearchRateLimit,
		TokenRevocation:   s.TokenRevocation,
		dbConn:            conn,
		IpGeoResolver:     s.IpGeoResolver,
	}
}
