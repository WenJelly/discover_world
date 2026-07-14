// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package account

import (
	"context"
	"database/sql"
	"errors"
	"github.com/zeromicro/go-zero/core/stores/sqlx"
	"time"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/redisx"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"github.com/zeromicro/go-zero/core/logx"
	"golang.org/x/crypto/bcrypt"
)

type LoginAccountLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewLoginAccountLogic(ctx context.Context, svcCtx *svc.ServiceContext) *LoginAccountLogic {
	return &LoginAccountLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *LoginAccountLogic) LoginAccount(req *types.LoginRequest) (resp *types.LoginResponse, err error) {
	if req == nil {
		return nil, commonresponse.BadRequest("请求不能为空")
	}

	email, err := normalizeLoginEmail(req.Email)
	if err != nil {
		return nil, err
	}
	subject := redisx.HashSubject(l.svcCtx.Config.Auth.AccessSecret, email)
	if l.svcCtx.Redis != nil {
		decision, limitErr := l.svcCtx.Redis.Allow(l.ctx, "login:account", subject, l.svcCtx.Config.Redis.RateLimit.LoginAccountLimit, 15*time.Minute)
		if limitErr != nil {
			l.Errorf("redis account login rate limit failed open: %v", limitErr)
		} else if !decision.Allowed {
			return nil, commonresponse.TooManyRequests("登录失败次数过多，请稍后重试")
		}
	}

	account, err := l.svcCtx.UserAccountModel.FindOneByEmailCaseSensitive(l.ctx, sql.NullString{String: email, Valid: true})
	if err != nil {
		if errors.Is(err, sqlx.ErrNotFound) {
			return nil, commonresponse.Unauthorized("邮箱或密码错误")
		}
		return nil, commonresponse.InternalServerError("查询账号失败")
	}
	if account.Status != "active" || account.DeletedAt.Valid || !account.PasswordHash.Valid {
		return nil, commonresponse.Unauthorized("账号不可用")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(account.PasswordHash.String), []byte(req.Password)); err != nil {
		return nil, commonresponse.Unauthorized("邮箱或密码错误")
	}

	token, err := createToken(l.svcCtx, account)
	if err != nil {
		return nil, commonresponse.InternalServerError("生成登录令牌失败")
	}
	_ = l.svcCtx.UserAccountModel.UpdateLastLogin(l.ctx, account.Id, time.Now())

	detail, err := loadDetailAccountResponse(l.ctx, l.svcCtx, account)
	if err != nil {
		return nil, err
	}
	if l.svcCtx.Redis != nil {
		if err := l.svcCtx.Redis.Delete(l.ctx, "ratelimit:login:account:"+subject); err != nil {
			l.Errorf("clear account login rate limit failed: %v", err)
		}
	}

	return buildLoginResponse(token, detail), nil
}
