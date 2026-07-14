package admin

import (
	"context"
	adminmodel "discover_world/model/admin"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/logic/adminsupport"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"github.com/zeromicro/go-zero/core/logx"
)

type GetAdminOperationLogListLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewGetAdminOperationLogListLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetAdminOperationLogListLogic {
	return &GetAdminOperationLogListLogic{Logger: logx.WithContext(ctx), ctx: ctx, svcCtx: svcCtx}
}

func (l *GetAdminOperationLogListLogic) GetAdminOperationLogList(req *types.AdminOperationLogQueryRequest) (*types.AdminOperationLogPageResponse, error) {
	if req == nil {
		req = &types.AdminOperationLogQueryRequest{}
	}
	if _, err := adminsupport.RequireAdminCapability(l.ctx, l.svcCtx, adminsupport.CapabilityAuditRead); err != nil {
		return nil, err
	}
	pageNum, pageSize := adminsupport.NormalizePage(req.PageNum, req.PageSize)
	filter, err := buildOperationLogFilter(req)
	if err != nil {
		return nil, err
	}
	total, err := l.svcCtx.Models.Admin.AdminOperationLog.CountByFilter(l.ctx, filter)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询操作日志数量失败")
	}
	rows, err := l.svcCtx.Models.Admin.AdminOperationLog.FindByFilter(l.ctx, filter, pageNum, pageSize)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询操作日志失败")
	}
	list := make([]types.AdminOperationLogResponse, 0, len(rows))
	for _, row := range rows {
		list = append(list, buildAdminOperationLogResponse(row))
	}
	return &types.AdminOperationLogPageResponse{PageNum: pageNum, PageSize: pageSize, Total: total, List: list}, nil
}

func buildOperationLogFilter(req *types.AdminOperationLogQueryRequest) (adminmodel.AdminOperationLogFilter, error) {
	operatorID, err := parseOptionalID(req.OperatorUserId, "operatorUserId")
	if err != nil {
		return adminmodel.AdminOperationLogFilter{}, err
	}
	targetID, err := parseOptionalID(req.TargetId, "targetId")
	if err != nil {
		return adminmodel.AdminOperationLogFilter{}, err
	}
	start, err := parseOptionalTime(req.CreatedAtFrom)
	if err != nil {
		return adminmodel.AdminOperationLogFilter{}, err
	}
	end, err := parseOptionalTime(req.CreatedAtTo)
	if err != nil {
		return adminmodel.AdminOperationLogFilter{}, err
	}
	return adminmodel.AdminOperationLogFilter{OperatorUserId: operatorID, Action: req.Action, TargetType: req.TargetType, TargetId: targetID, CreatedAtFrom: start, CreatedAtTo: end}, nil
}
