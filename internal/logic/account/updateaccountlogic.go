// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package account

import (
	"context"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
	"discover_world/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type UpdateAccountLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewUpdateAccountLogic(ctx context.Context, svcCtx *svc.ServiceContext) *UpdateAccountLogic {
	return &UpdateAccountLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *UpdateAccountLogic) UpdateAccount(req *types.UpdateAccountRequest) (resp *types.DetailAccountResponse, err error) {
	if req == nil {
		return nil, commonresponse.BadRequest("请求不能为空")
	}

	loginUser, err := loadLoginAccount(l.ctx, l.svcCtx)
	if err != nil {
		return nil, err
	}
	id, err := parseRequiredID(req.Id, "id")
	if err != nil {
		return nil, err
	}
	if id != loginUser.Id && !l.svcCtx.IsAdminAccount(loginUser) {
		return nil, commonresponse.Forbidden("无权更新该账号")
	}

	account, err := l.svcCtx.UserAccountModel.FindOne(l.ctx, id)
	if err != nil {
		return nil, commonresponse.NotFound("账号不存在")
	}
	if err := applyAccountPatch(l.ctx, l.svcCtx, account, req.Username, req.Email, req.Password, "", false); err != nil {
		return nil, err
	}
	profile, err := ensureUserProfile(l.ctx, l.svcCtx, account)
	if err != nil {
		return nil, err
	}
	if err := applyProfilePatch(profile, req.Nickname, req.Bio); err != nil {
		return nil, err
	}
	if err := l.svcCtx.UserAccountModel.Update(l.ctx, account); err != nil {
		return nil, commonresponse.InternalServerError("更新账号失败")
	}
	if err := l.svcCtx.UserProfileModel.Update(l.ctx, profile); err != nil {
		return nil, commonresponse.InternalServerError("更新用户资料失败")
	}

	return loadDetailAccountResponse(l.ctx, l.svcCtx, account)
}
