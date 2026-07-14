package admin

import (
	"context"
	taxonomymodel "discover_world/model/taxonomy"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/logic/adminsupport"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"github.com/zeromicro/go-zero/core/logx"
)

type GetAdminTagListLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewGetAdminTagListLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetAdminTagListLogic {
	return &GetAdminTagListLogic{Logger: logx.WithContext(ctx), ctx: ctx, svcCtx: svcCtx}
}

func (l *GetAdminTagListLogic) GetAdminTagList(req *types.AdminTagQueryRequest) (*types.AdminTagPageResponse, error) {
	if req == nil {
		req = &types.AdminTagQueryRequest{}
	}
	if _, err := adminsupport.RequireAdminCapability(l.ctx, l.svcCtx, adminsupport.CapabilityOperationManage); err != nil {
		return nil, err
	}
	pageNum, pageSize := adminsupport.NormalizePage(req.PageNum, req.PageSize)
	filter := taxonomymodel.TagFilter{Name: req.Name, TagType: req.TagType, Status: req.Status}
	total, err := l.svcCtx.Models.Taxonomy.Tag.CountByFilter(l.ctx, filter)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询标签数量失败")
	}
	rows, err := l.svcCtx.Models.Taxonomy.Tag.FindByFilter(l.ctx, filter, pageNum, pageSize)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询标签列表失败")
	}
	list := make([]types.AdminTagResponse, 0, len(rows))
	for _, row := range rows {
		list = append(list, buildAdminTagResponse(row))
	}
	return &types.AdminTagPageResponse{PageNum: pageNum, PageSize: pageSize, Total: total, List: list}, nil
}
