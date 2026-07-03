// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package admin

import (
	"context"

	commonauth "discover_world/internal/common/auth"
	accountLogic "discover_world/internal/logic/account"
	"discover_world/internal/svc"
	"discover_world/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type AdminUpdateAccountLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewAdminUpdateAccountLogic(ctx context.Context, svcCtx *svc.ServiceContext) *AdminUpdateAccountLogic {
	return &AdminUpdateAccountLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *AdminUpdateAccountLogic) AdminUpdateAccount(req *types.AdminUpdateAccountRequest) (resp *types.DetailAccountResponse, err error) {
	if _, err := commonauth.LoadRequiredAdminUser(l.ctx, l.svcCtx, ""); err != nil {
		return nil, err
	}

	return accountLogic.UpdateAccountByAdmin(l.ctx, l.svcCtx, req)
}
