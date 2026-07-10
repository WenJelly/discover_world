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

type MergeAdminTagLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewMergeAdminTagLogic(ctx context.Context, svcCtx *svc.ServiceContext) *MergeAdminTagLogic {
	return &MergeAdminTagLogic{Logger: logx.WithContext(ctx), ctx: ctx, svcCtx: svcCtx}
}

func (l *MergeAdminTagLogic) MergeAdminTag(req *types.AdminTagMergeRequest) (*types.AdminTagResponse, error) {
	if req == nil {
		return nil, commonresponse.BadRequest("请求不能为空")
	}
	adminUser, err := adminsupport.RequireAdminCapability(l.ctx, l.svcCtx, adminsupport.CapabilityOperationManage)
	if err != nil {
		return nil, err
	}
	sourceID, err := parseRequiredID(req.SourceTagId, "sourceTagId")
	if err != nil {
		return nil, err
	}
	targetID, err := parseRequiredID(req.TargetTagId, "targetTagId")
	if err != nil {
		return nil, err
	}
	if sourceID == targetID {
		return nil, commonresponse.BadRequest("sourceTagId 和 targetTagId 不能相同")
	}
	source, err := l.svcCtx.TagModel.FindOne(l.ctx, sourceID)
	if err != nil {
		if errors.Is(err, model.ErrNotFound) {
			return nil, commonresponse.NotFound("源标签不存在")
		}
		return nil, commonresponse.InternalServerError("查询源标签失败")
	}
	target, err := l.svcCtx.TagModel.FindOne(l.ctx, targetID)
	if err != nil {
		if errors.Is(err, model.ErrNotFound) {
			return nil, commonresponse.NotFound("目标标签不存在")
		}
		return nil, commonresponse.InternalServerError("查询目标标签失败")
	}
	before := map[string]any{"source": buildAdminTagResponse(source), "target": buildAdminTagResponse(target)}
	if err := l.svcCtx.TaggingModel.MoveTaggings(l.ctx, sourceID, targetID); err != nil {
		return nil, commonresponse.InternalServerError("迁移标签关联失败")
	}
	source.Status = 0
	if err := l.svcCtx.TagModel.Update(l.ctx, source); err != nil {
		return nil, commonresponse.InternalServerError("禁用源标签失败")
	}
	resp := buildAdminTagResponse(target)
	if err := adminsupport.RecordOperation(l.ctx, l.svcCtx, adminsupport.OperationLogInput{
		OperatorUserID: adminUser.Id,
		Action:         "tag.merge",
		TargetType:     adminTargetTag,
		TargetID:       targetID,
		Reason:         req.Reason,
		Before:         before,
		After:          map[string]any{"source": buildAdminTagResponse(source), "target": resp},
	}); err != nil {
		return nil, err
	}
	return &resp, nil
}
