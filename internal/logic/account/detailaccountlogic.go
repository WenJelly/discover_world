// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package account

import (
	"context"
	"database/sql"
	"errors"
	"github.com/zeromicro/go-zero/core/stores/sqlx"
	"strings"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"github.com/zeromicro/go-zero/core/logx"
)

type DetailAccountLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewDetailAccountLogic(ctx context.Context, svcCtx *svc.ServiceContext) *DetailAccountLogic {
	return &DetailAccountLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *DetailAccountLogic) DetailAccount(req *types.DetailAccountRequest) (resp *types.DetailAccountResponse, err error) {
	loginUser, err := loadLoginAccount(l.ctx, l.svcCtx)
	if err != nil {
		return nil, err
	}

	target := loginUser
	if req != nil && strings.TrimSpace(req.Id) != "" {
		id, err := parseRequiredID(req.Id, "id")
		if err != nil {
			return nil, err
		}
		target, err = l.svcCtx.Models.Account.UserAccount.FindOne(l.ctx, id)
		if err != nil {
			if errors.Is(err, sqlx.ErrNotFound) {
				return nil, commonresponse.NotFound("账号不存在")
			}
			return nil, commonresponse.InternalServerError("查询账号失败")
		}
		if !canViewAccountDetail(l.svcCtx, loginUser, target) {
			return nil, commonresponse.Forbidden("无权查看该账号")
		}
	} else if req != nil && strings.TrimSpace(req.Email) != "" {
		if !l.svcCtx.IsAdminAccount(loginUser) {
			return nil, commonresponse.Forbidden("无权通过邮箱查询账号")
		}
		email, err := normalizeEmail(req.Email)
		if err != nil {
			return nil, err
		}
		target, err = l.svcCtx.Models.Account.UserAccount.FindOneByEmail(l.ctx, sql.NullString{String: email, Valid: true})
		if err != nil {
			if errors.Is(err, sqlx.ErrNotFound) {
				return nil, commonresponse.NotFound("账号不存在")
			}
			return nil, commonresponse.InternalServerError("查询账号失败")
		}
	}

	resp, err = loadDetailAccountResponse(l.ctx, l.svcCtx, target)
	if err != nil {
		return nil, err
	}
	if loginUser.Id != target.Id {
		isFollowing, err := l.svcCtx.Models.Follow.UserFollow.IsFollowing(l.ctx, loginUser.Id, target.Id)
		if err != nil {
			return nil, commonresponse.InternalServerError("查询关注状态失败")
		}
		resp.IsFollowing = isFollowing
	}
	maskDetailAccountForViewer(l.svcCtx, loginUser, target, resp)
	return resp, nil
}
