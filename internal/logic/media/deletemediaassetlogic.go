// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package media

import (
	"context"
	"database/sql"
	"errors"
	"time"

	commonauth "discover_world/internal/common/auth"
	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"discover_world/model"

	"github.com/zeromicro/go-zero/core/logx"
)

type DeleteMediaAssetLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewDeleteMediaAssetLogic(ctx context.Context, svcCtx *svc.ServiceContext) *DeleteMediaAssetLogic {
	return &DeleteMediaAssetLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *DeleteMediaAssetLogic) DeleteMediaAsset(req *types.DeleteMediaAssetRequest) error {
	if req == nil {
		return commonresponse.BadRequest("请求不能为空")
	}

	id, err := parseRequiredID(req.Id, "id")
	if err != nil {
		return err
	}

	loginUser, err := commonauth.LoadRequiredLoginUser(l.ctx, l.svcCtx, "")
	if err != nil {
		return err
	}

	asset, err := l.svcCtx.MediaAssetModel.FindOneActive(l.ctx, id)
	if err != nil {
		if errors.Is(err, model.ErrNotFound) {
			return commonresponse.NotFound("媒体资源不存在")
		}
		return commonresponse.InternalServerError("查询媒体资源失败")
	}
	if !canManageMediaAsset(asset, loginUser, l.svcCtx) {
		return commonresponse.Forbidden("无权删除该媒体资源")
	}

	asset.Status = "deleted"
	asset.DeletedAt = sql.NullTime{Time: time.Now(), Valid: true}
	if err := l.svcCtx.MediaAssetModel.Update(l.ctx, asset); err != nil {
		return commonresponse.InternalServerError("删除媒体资源失败")
	}
	if err := l.svcCtx.MediaObjectModel.MarkDeletedByAssetID(l.ctx, asset.Id); err != nil {
		return commonresponse.InternalServerError("删除媒体对象失败")
	}

	return nil
}
