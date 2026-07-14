// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package media

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	commonauth "discover_world/internal/common/auth"
	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"discover_world/model"

	"github.com/zeromicro/go-zero/core/logx"
)

type DownloadMediaAssetLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewDownloadMediaAssetLogic(ctx context.Context, svcCtx *svc.ServiceContext) *DownloadMediaAssetLogic {
	return &DownloadMediaAssetLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *DownloadMediaAssetLogic) DownloadMediaAsset(req *types.DownloadMediaAssetRequest) (*types.MediaAssetDownloadResponse, error) {
	if req == nil {
		return nil, commonresponse.BadRequest("请求不能为空")
	}

	assetID, err := parseRequiredID(req.Id, "id")
	if err != nil {
		return nil, err
	}

	loginUser, err := commonauth.LoadRequiredLoginUser(l.ctx, l.svcCtx, "")
	if err != nil {
		return nil, err
	}
	if l.svcCtx.Redis != nil {
		decision, limitErr := l.svcCtx.Redis.Allow(l.ctx, "download:user", formatID(loginUser.Id), l.svcCtx.Config.Redis.RateLimit.DownloadUserLimit, time.Minute)
		if limitErr != nil {
			l.Errorf("redis download rate limit failed open: %v", limitErr)
		} else if !decision.Allowed {
			return nil, commonresponse.TooManyRequests("下载请求过于频繁，请稍后重试")
		}
	}

	asset, err := l.svcCtx.MediaAssetModel.FindOneActive(l.ctx, assetID)
	if err != nil {
		if errors.Is(err, model.ErrNotFound) {
			return nil, commonresponse.NotFound("媒体资源不存在")
		}
		return nil, commonresponse.InternalServerError("查询媒体资源失败")
	}
	if !canViewMediaAsset(l.ctx, asset, loginUser, l.svcCtx) {
		return nil, commonresponse.Forbidden("无权查看该媒体资源")
	}
	if !canViewOriginal(l.ctx, asset, loginUser, l.svcCtx) {
		return nil, commonresponse.Forbidden("无权下载原图")
	}

	object, err := l.svcCtx.MediaObjectModel.FindOriginalByAssetID(l.ctx, asset.Id)
	if err != nil {
		if errors.Is(err, model.ErrNotFound) {
			return nil, commonresponse.NotFound("原图不存在")
		}
		return nil, commonresponse.InternalServerError("查询原图失败")
	}

	bucket, err := l.svcCtx.StorageBucketModel.FindOne(l.ctx, object.BucketId)
	if err != nil {
		if errors.Is(err, model.ErrNotFound) {
			return nil, commonresponse.NotFound("原图存储桶不存在")
		}
		return nil, commonresponse.InternalServerError("查询原图存储桶失败")
	}

	url := buildPublicObjectURL(bucket, object.ObjectKey)
	if strings.TrimSpace(url) == "" {
		return nil, commonresponse.InternalServerError("原图访问地址不可用")
	}

	if err := l.svcCtx.EntityStatModel.IncrementCounter(l.ctx, targetTypeMediaAsset, asset.Id, "download_count", 1); err != nil {
		return nil, commonresponse.InternalServerError("更新下载量失败")
	}
	if l.svcCtx.EntityStatHourlyModel != nil {
		if err := l.svcCtx.EntityStatHourlyModel.IncrementCounter(l.ctx, targetTypeMediaAsset, asset.Id, "download_count", 1); err != nil {
			logx.WithContext(l.ctx).Errorf("record media hourly download stat failed: assetId=%d err=%v", asset.Id, err)
		}
	}
	refreshMediaRanking(l.ctx, l.svcCtx, asset.Id)

	stat, err := l.svcCtx.EntityStatModel.FindOneByTargetTypeTargetId(l.ctx, targetTypeMediaAsset, asset.Id)
	if err != nil && !errors.Is(err, model.ErrNotFound) {
		return nil, commonresponse.InternalServerError("查询下载量失败")
	}

	return &types.MediaAssetDownloadResponse{
		Url:      url,
		Filename: mediaDownloadFilename(asset, object),
		FileSize: nullInt64Value(object.FileSize),
		Stats:    buildMediaStats(stat),
	}, nil
}

func mediaDownloadFilename(asset *model.MediaAsset, object *model.MediaObject) string {
	if asset != nil {
		if name := strings.TrimSpace(nullStringValue(asset.OriginalFilename)); name != "" {
			return name
		}
		if title := strings.TrimSpace(nullStringValue(asset.Title)); title != "" {
			return title
		}
	}

	ext := ""
	if object != nil {
		ext = strings.Trim(strings.TrimSpace(nullStringValue(object.FileExt)), ".")
	}
	if ext != "" {
		return fmt.Sprintf("photo.%s", ext)
	}
	return "photo"
}
