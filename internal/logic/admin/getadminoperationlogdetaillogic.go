package admin

import (
	"context"
	"errors"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/logic/adminsupport"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"discover_world/model"

	"github.com/zeromicro/go-zero/core/logx"
)

type GetAdminOperationLogDetailLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewGetAdminOperationLogDetailLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetAdminOperationLogDetailLogic {
	return &GetAdminOperationLogDetailLogic{Logger: logx.WithContext(ctx), ctx: ctx, svcCtx: svcCtx}
}

func (l *GetAdminOperationLogDetailLogic) GetAdminOperationLogDetail(req *types.AdminOperationLogDetailRequest) (*types.AdminOperationLogResponse, error) {
	if req == nil {
		return nil, commonresponse.BadRequest("请求不能为空")
	}
	if _, err := adminsupport.RequireAdminCapability(l.ctx, l.svcCtx, adminsupport.CapabilityAuditRead); err != nil {
		return nil, err
	}
	id, err := parseRequiredID(req.Id, "id")
	if err != nil {
		return nil, err
	}
	row, err := l.svcCtx.AdminOperationLogModel.FindByID(l.ctx, id)
	if err != nil {
		if errors.Is(err, model.ErrNotFound) {
			return nil, commonresponse.NotFound("操作日志不存在")
		}
		return nil, commonresponse.InternalServerError("查询操作日志失败")
	}
	resp := buildAdminOperationLogResponse(row)
	return &resp, nil
}
