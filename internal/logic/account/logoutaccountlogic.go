package account

import (
	"context"
	"time"

	commonauth "discover_world/internal/common/auth"
	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"

	"github.com/zeromicro/go-zero/core/logx"
)

type LogoutAccountLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewLogoutAccountLogic(ctx context.Context, svcCtx *svc.ServiceContext) *LogoutAccountLogic {
	return &LogoutAccountLogic{Logger: logx.WithContext(ctx), ctx: ctx, svcCtx: svcCtx}
}

func (l *LogoutAccountLogic) LogoutAccount(authorization string) error {
	metadata, err := commonauth.ExtractTokenMetadataFromBearerToken(authorization, l.svcCtx.Config.Auth.AccessSecret)
	if err != nil {
		return commonresponse.Unauthorized("无效的登录令牌")
	}
	ttl := time.Until(metadata.ExpiresAt)
	if ttl <= 0 {
		return nil
	}
	if l.svcCtx.Redis == nil {
		return commonresponse.InternalServerError("注销服务不可用")
	}
	if err := l.svcCtx.Redis.RevokeToken(l.ctx, metadata.ID, ttl); err != nil {
		return commonresponse.InternalServerError("注销失败")
	}
	return nil
}
