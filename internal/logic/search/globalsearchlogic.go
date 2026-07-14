// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package search

import (
	"context"
	mediamodel "discover_world/model/media"
	postmodel "discover_world/model/post"
	profilemodel "discover_world/model/profile"
	"strconv"
	"time"

	"discover_world/internal/common/ipgeo"
	commonresponse "discover_world/internal/common/response"
	mediaLogic "discover_world/internal/logic/media"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"github.com/zeromicro/go-zero/core/logx"
)

type GlobalSearchLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewGlobalSearchLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GlobalSearchLogic {
	return &GlobalSearchLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *GlobalSearchLogic) GlobalSearch(req *types.GlobalSearchRequest) (resp *types.GlobalSearchResponse, err error) {
	normalized, err := normalizeSearchRequest(req)
	if err != nil {
		return nil, err
	}

	resp = &types.GlobalSearchResponse{
		Q:        normalized.Query,
		Types:    normalized.Types,
		PageSize: normalized.PageSize,
		Media:    []types.MediaAssetResponse{},
		Posts:    []types.GlobalSearchPostResponse{},
		Albums:   []types.GlobalSearchAlbumResponse{},
		Users:    []types.AccountSummary{},
	}
	if normalized.Query == "" {
		return resp, nil
	}

	if includesSearchType(normalized.Types, searchTypeMedia) {
		startedAt := time.Now()
		media, err := l.searchMedia(normalized)
		observeSearch(searchTypeMedia, startedAt, err)
		if err != nil {
			return nil, err
		}
		resp.Media = media
	}
	if includesSearchType(normalized.Types, searchTypePost) {
		startedAt := time.Now()
		posts, err := l.searchPosts(normalized)
		observeSearch(searchTypePost, startedAt, err)
		if err != nil {
			return nil, err
		}
		resp.Posts = posts
	}
	if includesSearchType(normalized.Types, searchTypeAlbum) {
		startedAt := time.Now()
		albums, err := l.searchAlbums(normalized)
		observeSearch(searchTypeAlbum, startedAt, err)
		if err != nil {
			return nil, err
		}
		resp.Albums = albums
	}
	if includesSearchType(normalized.Types, searchTypeUser) {
		startedAt := time.Now()
		users, err := l.searchUsers(normalized)
		observeSearch(searchTypeUser, startedAt, err)
		if err != nil {
			return nil, err
		}
		resp.Users = users
	}

	return resp, nil
}

func (l *GlobalSearchLogic) searchMedia(req normalizedSearchRequest) ([]types.MediaAssetResponse, error) {
	assets, err := l.svcCtx.Models.Search.Search.SearchPublicMediaAssets(l.ctx, req.Query, req.PageSize)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询媒体搜索结果失败")
	}
	resp, err := mediaLogic.BuildMediaAssetListResponse(l.ctx, l.svcCtx, assets, nil, req.Variant)
	if err != nil {
		return nil, commonresponse.InternalServerError("构造媒体搜索结果失败")
	}
	if resp == nil {
		resp = []types.MediaAssetResponse{}
	}
	return resp, nil
}

func (l *GlobalSearchLogic) searchPosts(req normalizedSearchRequest) ([]types.GlobalSearchPostResponse, error) {
	posts, err := l.svcCtx.Models.Search.Search.SearchPublicPosts(l.ctx, req.Query, req.PageSize)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询动态搜索结果失败")
	}
	return buildSearchPostResponses(l.ctx, l.svcCtx, posts)
}

func (l *GlobalSearchLogic) searchAlbums(req normalizedSearchRequest) ([]types.GlobalSearchAlbumResponse, error) {
	albums, err := l.svcCtx.Models.Search.Search.SearchPublicAlbums(l.ctx, req.Query, req.PageSize)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询相册搜索结果失败")
	}
	return buildSearchAlbumResponses(l.ctx, l.svcCtx, albums, req.Variant)
}

func (l *GlobalSearchLogic) searchUsers(req normalizedSearchRequest) ([]types.AccountSummary, error) {
	users, err := l.svcCtx.Models.Search.Search.SearchPublicUsers(l.ctx, req.Query, req.PageSize)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询用户搜索结果失败")
	}

	profiles := make(map[uint64]*profilemodel.UserProfile, len(users))
	for _, user := range users {
		if user != nil {
			profiles[user.Id] = &profilemodel.UserProfile{AvatarAssetId: user.AvatarAssetId}
		}
	}
	avatarURLs, err := mediaLogic.LoadAvatarURLsByOwner(l.ctx, l.svcCtx, profiles)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询用户头像失败")
	}

	resp := make([]types.AccountSummary, 0, len(users))
	for _, user := range users {
		if user == nil {
			continue
		}
		resp = append(resp, buildSearchUserSummary(user, avatarURLs[user.Id]))
	}
	return resp, nil
}

func buildSearchPostResponses(ctx context.Context, svcCtx *svc.ServiceContext, posts []*postmodel.Post) ([]types.GlobalSearchPostResponse, error) {
	if len(posts) == 0 {
		return []types.GlobalSearchPostResponse{}, nil
	}

	postIDs := make([]uint64, 0, len(posts))
	authorIDs := make([]uint64, 0, len(posts))
	for _, post := range posts {
		if post == nil {
			continue
		}
		postIDs = append(postIDs, post.Id)
		authorIDs = append(authorIDs, post.UserId)
	}

	authors, err := loadAuthorSummaries(ctx, svcCtx, authorIDs)
	if err != nil {
		return nil, err
	}
	stats, err := svcCtx.Models.Statistics.EntityStat.FindByTargetIDs(ctx, searchTypePost, postIDs)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询动态统计失败")
	}
	ipRegions, err := ipgeo.LoadRegionsByTarget(ctx, svcCtx.Models.Moderation.ContentIpAttribution, ipgeo.TargetTypePost, postIDs)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询动态属地失败")
	}

	resp := make([]types.GlobalSearchPostResponse, 0, len(posts))
	for _, post := range posts {
		if post == nil {
			continue
		}
		resp = append(resp, types.GlobalSearchPostResponse{
			Id:        formatID(post.Id),
			UserId:    formatID(post.UserId),
			Author:    authors[post.UserId],
			Content:   nullStringValue(post.Content),
			PostType:  normalizePostTypeValue(post.PostType),
			Location:  nullStringValue(post.Location),
			IpRegion:  ipRegions[post.Id],
			Stats:     buildStats(stats[post.Id]),
			CreatedAt: formatTime(post.CreatedAt),
			UpdatedAt: formatTime(post.UpdatedAt),
		})
	}
	return resp, nil
}

func buildSearchAlbumResponses(ctx context.Context, svcCtx *svc.ServiceContext, albums []*profilemodel.Album, variant types.MediaVariantRequest) ([]types.GlobalSearchAlbumResponse, error) {
	if len(albums) == 0 {
		return []types.GlobalSearchAlbumResponse{}, nil
	}

	authorIDs := make([]uint64, 0, len(albums))
	coverIDs := make([]uint64, 0, len(albums))
	for _, album := range albums {
		if album == nil {
			continue
		}
		authorIDs = append(authorIDs, album.UserId)
		if album.CoverAssetId.Valid && album.CoverAssetId.Int64 > 0 {
			coverIDs = append(coverIDs, uint64(album.CoverAssetId.Int64))
		}
	}

	authors, err := loadAuthorSummaries(ctx, svcCtx, authorIDs)
	if err != nil {
		return nil, err
	}
	covers, err := loadCoverResponses(ctx, svcCtx, coverIDs, variant)
	if err != nil {
		return nil, err
	}

	resp := make([]types.GlobalSearchAlbumResponse, 0, len(albums))
	for _, album := range albums {
		if album == nil {
			continue
		}
		var cover types.MediaAssetResponse
		if album.CoverAssetId.Valid && album.CoverAssetId.Int64 > 0 {
			cover = covers[uint64(album.CoverAssetId.Int64)]
		}
		resp = append(resp, types.GlobalSearchAlbumResponse{
			Id:          formatID(album.Id),
			UserId:      formatID(album.UserId),
			Author:      authors[album.UserId],
			Name:        album.Name,
			Description: nullStringValue(album.Description),
			Cover:       cover,
			CreatedAt:   formatTime(album.CreatedAt),
			UpdatedAt:   formatTime(album.UpdatedAt),
		})
	}
	return resp, nil
}

func loadAuthorSummaries(ctx context.Context, svcCtx *svc.ServiceContext, userIDs []uint64) (map[uint64]types.AccountSummary, error) {
	userIDs = uniquePositiveIDs(userIDs)
	resp := make(map[uint64]types.AccountSummary, len(userIDs))
	if len(userIDs) == 0 {
		return resp, nil
	}

	accounts, err := svcCtx.Models.Account.UserAccount.FindByIDs(ctx, userIDs)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询作者账号失败")
	}
	profiles, err := svcCtx.Models.Profile.UserProfile.FindByUserIDs(ctx, userIDs)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询作者资料失败")
	}
	avatarURLs, err := mediaLogic.LoadAvatarURLsByOwner(ctx, svcCtx, profiles)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询作者头像失败")
	}

	for _, account := range accounts {
		if account == nil {
			continue
		}
		profile := profiles[account.Id]
		resp[account.Id] = buildAccountSummary(account, profile, avatarURLs[account.Id])
	}
	return resp, nil
}

func loadCoverResponses(ctx context.Context, svcCtx *svc.ServiceContext, coverIDs []uint64, variant types.MediaVariantRequest) (map[uint64]types.MediaAssetResponse, error) {
	coverIDs = uniquePositiveIDs(coverIDs)
	resp := make(map[uint64]types.MediaAssetResponse, len(coverIDs))
	if len(coverIDs) == 0 {
		return resp, nil
	}

	assetsByID, err := svcCtx.Models.Media.MediaAsset.FindPublicApprovedByIDs(ctx, coverIDs)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询相册封面失败")
	}

	assets := make([]*mediamodel.MediaAsset, 0, len(coverIDs))
	for _, id := range coverIDs {
		if asset := assetsByID[id]; asset != nil {
			assets = append(assets, asset)
		}
	}

	list, err := mediaLogic.BuildMediaAssetListResponse(ctx, svcCtx, assets, nil, variant)
	if err != nil {
		return nil, commonresponse.InternalServerError("构造相册封面失败")
	}
	for _, item := range list {
		id, err := strconv.ParseUint(item.Id, 10, 64)
		if err == nil && id > 0 {
			resp[id] = item
		}
	}
	return resp, nil
}

func uniquePositiveIDs(ids []uint64) []uint64 {
	seen := make(map[uint64]struct{}, len(ids))
	resp := make([]uint64, 0, len(ids))
	for _, id := range ids {
		if id == 0 {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		resp = append(resp, id)
	}
	return resp
}
