// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package media

import (
	"context"
	"errors"
	"github.com/zeromicro/go-zero/core/stores/sqlx"

	commonauth "discover_world/internal/common/auth"
	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"github.com/zeromicro/go-zero/core/logx"
)

type GetMediaAssetLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewGetMediaAssetLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetMediaAssetLogic {
	return &GetMediaAssetLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *GetMediaAssetLogic) GetMediaAsset(req *types.GetMediaAssetRequest) (resp *types.MediaAssetResponse, err error) {
	if req == nil {
		return nil, commonresponse.BadRequest("请求不能为空")
	}

	id, err := parseRequiredID(req.Id, "id")
	if err != nil {
		return nil, err
	}

	loginUser, err := commonauth.LoadRequiredLoginUser(l.ctx, l.svcCtx, "")
	if err != nil {
		return nil, err
	}

	asset, err := l.svcCtx.Models.Media.MediaAsset.FindOneActive(l.ctx, id)
	if err != nil {
		if errors.Is(err, sqlx.ErrNotFound) {
			return nil, commonresponse.NotFound("媒体资源不存在")
		}
		return nil, commonresponse.InternalServerError("查询媒体资源失败")
	}
	if !canViewMediaAsset(l.ctx, asset, loginUser, l.svcCtx) {
		return nil, commonresponse.Forbidden("无权查看该媒体资源")
	}

	if err := l.svcCtx.Models.Statistics.EntityStat.IncrementViewCount(l.ctx, targetTypeMediaAsset, asset.Id); err != nil {
		return nil, commonresponse.InternalServerError("更新浏览量失败")
	}
	if l.svcCtx.Models.Statistics.EntityStatHourly != nil {
		if err := l.svcCtx.Models.Statistics.EntityStatHourly.IncrementCounter(l.ctx, targetTypeMediaAsset, asset.Id, "view_count", 1); err != nil {
			logx.WithContext(l.ctx).Errorf("record media hourly view stat failed: assetId=%d err=%v", asset.Id, err)
		}
	}
	refreshMediaRanking(l.ctx, l.svcCtx, asset.Id)
	stat, _ := l.svcCtx.Models.Statistics.EntityStat.FindOneByTargetTypeTargetId(l.ctx, targetTypeMediaAsset, asset.Id)
	owner, _ := l.svcCtx.Models.Account.UserAccount.FindOne(l.ctx, asset.OwnerUserId)
	profile, _ := l.svcCtx.Models.Profile.UserProfile.FindOneByUserId(l.ctx, asset.OwnerUserId)
	tags, _ := l.svcCtx.Models.Taxonomy.Tagging.FindNamesByTargetIDs(l.ctx, targetTypeMediaAsset, []uint64{asset.Id})

	return buildMediaAssetResponse(l.ctx, l.svcCtx, asset, nil, owner, profile, stat, tags[asset.Id], loginUser, req.Variant)
}
