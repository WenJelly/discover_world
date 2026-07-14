// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package admin

import (
	"context"

	"discover_world/internal/common/adminsupport"
	commonresponse "discover_world/internal/common/response"
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
	if req == nil {
		return nil, commonresponse.BadRequest("请求不能为空")
	}
	adminUser, err := adminsupport.RequireAdminCapability(l.ctx, l.svcCtx, adminsupport.CapabilityAccountManage)
	if err != nil {
		return nil, err
	}
	targetID, err := parseRequiredID(req.Id, "id")
	if err != nil {
		return nil, err
	}

	after := &types.DetailAccountResponse{}
	if err := adminsupport.TransactOperation(l.ctx, l.svcCtx, adminsupport.OperationLogInput{
		OperatorUserID: adminUser.Id,
		Action:         "account.update",
		TargetType:     "user_account",
		TargetID:       targetID,
		Before:         map[string]any{"id": req.Id},
		After:          after,
		Metadata:       map[string]any{"request": req},
	}, func(ctx context.Context, txSvcCtx *svc.ServiceContext) error {
		updated, err := accountLogic.UpdateAccountByAdmin(ctx, txSvcCtx, req)
		if err != nil {
			return err
		}
		*after = *updated
		return nil
	}); err != nil {
		return nil, err
	}
	return after, nil
}
