package follow

import (
	"context"

	"discover_world/internal/svc"
	"discover_world/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type CreateFollowLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewCreateFollowLogic(ctx context.Context, svcCtx *svc.ServiceContext) *CreateFollowLogic {
	return &CreateFollowLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *CreateFollowLogic) CreateFollow(req *types.FollowTargetRequest) (*types.FollowStatusResponse, error) {
	loginUser, err := loadLoginUser(l.ctx, l.svcCtx)
	if err != nil {
		return nil, err
	}
	targetID, err := parseRequiredID(req.TargetUserId, "targetUserId")
	if err != nil {
		return nil, err
	}
	target, err := validateFollowTarget(l.ctx, l.svcCtx, loginUser, targetID)
	if err != nil {
		return nil, err
	}
	if err := l.svcCtx.UserFollowModel.Follow(l.ctx, loginUser.Id, target.Id); err != nil {
		return nil, err
	}
	return buildFollowStatus(l.ctx, l.svcCtx, loginUser, target)
}
