// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package homepage

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"time"

	"discover_world/internal/svc"
	"discover_world/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type GetHomepageConfigLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewGetHomepageConfigLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetHomepageConfigLogic {
	return &GetHomepageConfigLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *GetHomepageConfigLogic) GetHomepageConfig(req *types.GetHomepageConfigRequest) (resp *types.HomepageConfigResponse, err error) {
	if req == nil {
		req = &types.GetHomepageConfigRequest{}
	}

	if l.svcCtx.Redis == nil {
		return BuildHomepageConfigResponse(l.ctx, l.svcCtx, req.Variant)
	}
	version, cacheErr := l.svcCtx.Redis.Version(l.ctx, "homepage")
	if cacheErr != nil {
		l.Errorf("read homepage cache version failed: %v", cacheErr)
		return BuildHomepageConfigResponse(l.ctx, l.svcCtx, req.Variant)
	}
	key := homepageCacheKey(version, req.Variant)
	var cached types.HomepageConfigResponse
	if found, err := l.svcCtx.Redis.GetJSON(l.ctx, key, &cached); err != nil {
		l.Errorf("read homepage cache failed: %v", err)
	} else if found {
		return &cached, nil
	}

	resp, err = BuildHomepageConfigResponse(l.ctx, l.svcCtx, req.Variant)
	if err != nil {
		return nil, err
	}
	if err := l.svcCtx.Redis.SetJSON(l.ctx, key, resp, time.Duration(l.svcCtx.Config.Redis.HomepageTTLSeconds)*time.Second); err != nil {
		l.Errorf("write homepage cache failed: %v", err)
	}
	return resp, nil
}

func homepageCacheKey(version string, variant types.MediaVariantRequest) string {
	data, _ := json.Marshal(variant)
	sum := sha256.Sum256(data)
	return "cache:homepage:" + version + ":" + hex.EncodeToString(sum[:8])
}
