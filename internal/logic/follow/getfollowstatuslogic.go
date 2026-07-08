package follow

import (
	"context"

	"discover_world/internal/svc"
	"discover_world/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type GetFollowStatusLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewGetFollowStatusLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetFollowStatusLogic {
	return &GetFollowStatusLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *GetFollowStatusLogic) GetFollowStatus(req *types.FollowTargetRequest) (*types.FollowStatusResponse, error) {
	loginUser, err := loadLoginUser(l.ctx, l.svcCtx)
	if err != nil {
		return nil, err
	}
	targetID, err := parseRequiredID(req.TargetUserId, "targetUserId")
	if err != nil {
		return nil, err
	}
	target, err := loadFollowTarget(l.ctx, l.svcCtx, targetID)
	if err != nil {
		return nil, err
	}
	return buildFollowStatus(l.ctx, l.svcCtx, loginUser, target)
}
