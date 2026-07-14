package admin

import (
	"context"
	"database/sql"
	"errors"
	"github.com/zeromicro/go-zero/core/stores/sqlx"
	"strings"

	"discover_world/internal/common/adminsupport"
	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"github.com/zeromicro/go-zero/core/logx"
)

type UpdateAdminTagLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewUpdateAdminTagLogic(ctx context.Context, svcCtx *svc.ServiceContext) *UpdateAdminTagLogic {
	return &UpdateAdminTagLogic{Logger: logx.WithContext(ctx), ctx: ctx, svcCtx: svcCtx}
}

func (l *UpdateAdminTagLogic) UpdateAdminTag(req *types.AdminTagUpdateRequest) (*types.AdminTagResponse, error) {
	if req == nil {
		return nil, commonresponse.BadRequest("请求不能为空")
	}
	adminUser, err := adminsupport.RequireAdminCapability(l.ctx, l.svcCtx, adminsupport.CapabilityOperationManage)
	if err != nil {
		return nil, err
	}
	id, err := parseRequiredID(req.Id, "id")
	if err != nil {
		return nil, err
	}
	tag, err := l.svcCtx.Models.Taxonomy.Tag.FindOne(l.ctx, id)
	if err != nil {
		if errors.Is(err, sqlx.ErrNotFound) {
			return nil, commonresponse.NotFound("标签不存在")
		}
		return nil, commonresponse.InternalServerError("查询标签失败")
	}
	before := buildAdminTagResponse(tag)
	if value := strings.TrimSpace(req.Name); value != "" {
		tag.Name = value
	}
	if value := strings.TrimSpace(req.Slug); value != "" {
		tag.Slug = sql.NullString{String: value, Valid: true}
	}
	if value := strings.TrimSpace(req.TagType); value != "" {
		tag.TagType = value
	}
	if req.Status == 0 || req.Status == 1 {
		tag.Status = req.Status
	}
	after := buildAdminTagResponse(tag)
	if err := adminsupport.TransactOperation(l.ctx, l.svcCtx, adminsupport.OperationLogInput{
		OperatorUserID: adminUser.Id,
		Action:         "tag.update",
		TargetType:     adminTargetTag,
		TargetID:       tag.Id,
		Reason:         req.Reason,
		Before:         before,
		After:          after,
	}, func(ctx context.Context, txSvcCtx *svc.ServiceContext) error {
		if err := txSvcCtx.Models.Taxonomy.Tag.Update(ctx, tag); err != nil {
			return commonresponse.InternalServerError("更新标签失败")
		}
		return nil
	}); err != nil {
		return nil, err
	}
	return &after, nil
}
