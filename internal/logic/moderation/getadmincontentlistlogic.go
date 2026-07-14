package moderation

import (
	"context"
	accountmodel "discover_world/model/account"
	postmodel "discover_world/model/post"
	profilemodel "discover_world/model/profile"
	"sort"
	"strings"

	"discover_world/internal/common/adminsupport"
	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"github.com/zeromicro/go-zero/core/logx"
)

type GetAdminContentListLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewGetAdminContentListLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetAdminContentListLogic {
	return &GetAdminContentListLogic{Logger: logx.WithContext(ctx), ctx: ctx, svcCtx: svcCtx}
}

func (l *GetAdminContentListLogic) GetAdminContentList(req *types.AdminContentQueryRequest) (*types.AdminContentPageResponse, error) {
	if req == nil {
		req = &types.AdminContentQueryRequest{}
	}
	if _, err := adminsupport.RequireAdminCapability(l.ctx, l.svcCtx, adminsupport.CapabilityContentModerate); err != nil {
		return nil, err
	}
	pageNum, pageSize := adminsupport.NormalizePage(req.PageNum, req.PageSize)
	targetType, err := normalizeAdminContentTargetType(req.TargetType)
	if err != nil {
		return nil, err
	}
	userID, err := parseOptionalID(req.UserId, "userId")
	if err != nil {
		return nil, err
	}

	switch targetType {
	case adminTargetPost:
		return l.listAdminPostContent(req, userID, pageNum, pageSize)
	case adminTargetComment:
		return l.listAdminCommentContent(req, userID, pageNum, pageSize)
	default:
		return l.listMixedAdminContent(req, userID, pageNum, pageSize)
	}
}

func normalizeAdminContentTargetType(raw string) (string, error) {
	value := strings.ToLower(strings.TrimSpace(raw))
	switch value {
	case "", "all":
		return "", nil
	case adminTargetPost:
		return adminTargetPost, nil
	case adminTargetComment, "comment":
		return adminTargetComment, nil
	default:
		return "", commonresponse.BadRequest("targetType must be post or comment_record")
	}
}

func (l *GetAdminContentListLogic) listAdminPostContent(req *types.AdminContentQueryRequest, userID uint64, pageNum, pageSize int64) (*types.AdminContentPageResponse, error) {
	filter := postmodel.PostAdminFilter{
		Status:     req.Status,
		UserId:     userID,
		SearchText: req.SearchText,
	}
	total, err := l.svcCtx.Models.Post.Post.CountAdminByFilter(l.ctx, filter)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询内容总数失败")
	}
	rows, err := l.svcCtx.Models.Post.Post.FindAdminByFilter(l.ctx, filter, pageNum, pageSize)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询内容列表失败")
	}
	accounts, profiles, err := l.loadAdminContentAuthors(collectPostAuthorIDs(rows))
	if err != nil {
		return nil, err
	}
	list := make([]types.AdminContentResponse, 0, len(rows))
	for _, row := range rows {
		if row == nil {
			continue
		}
		list = append(list, buildAdminPostContentResponse(row, accounts[row.UserId], profiles[row.UserId]))
	}
	return &types.AdminContentPageResponse{PageNum: pageNum, PageSize: pageSize, Total: total, List: list}, nil
}

func (l *GetAdminContentListLogic) listAdminCommentContent(req *types.AdminContentQueryRequest, userID uint64, pageNum, pageSize int64) (*types.AdminContentPageResponse, error) {
	filter := postmodel.CommentRecordFilter{
		Status:     req.Status,
		UserId:     userID,
		SearchText: req.SearchText,
	}
	total, err := l.svcCtx.Models.Post.CommentRecord.CountByFilter(l.ctx, filter)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询内容总数失败")
	}
	rows, err := l.svcCtx.Models.Post.CommentRecord.FindByFilter(l.ctx, filter, pageNum, pageSize)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询内容列表失败")
	}
	accounts, profiles, err := l.loadAdminContentAuthors(collectCommentAuthorIDs(rows))
	if err != nil {
		return nil, err
	}
	list := make([]types.AdminContentResponse, 0, len(rows))
	for _, row := range rows {
		if row == nil {
			continue
		}
		list = append(list, buildAdminCommentContentResponse(row, accounts[row.UserId], profiles[row.UserId]))
	}
	return &types.AdminContentPageResponse{PageNum: pageNum, PageSize: pageSize, Total: total, List: list}, nil
}

func (l *GetAdminContentListLogic) listMixedAdminContent(req *types.AdminContentQueryRequest, userID uint64, pageNum, pageSize int64) (*types.AdminContentPageResponse, error) {
	postFilter := postmodel.PostAdminFilter{
		Status:     req.Status,
		UserId:     userID,
		SearchText: req.SearchText,
	}
	commentFilter := postmodel.CommentRecordFilter{
		Status:     req.Status,
		UserId:     userID,
		SearchText: req.SearchText,
	}

	postTotal, err := l.svcCtx.Models.Post.Post.CountAdminByFilter(l.ctx, postFilter)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询内容总数失败")
	}
	commentTotal, err := l.svcCtx.Models.Post.CommentRecord.CountByFilter(l.ctx, commentFilter)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询内容总数失败")
	}

	scanSize := pageNum * pageSize
	postRows, err := l.svcCtx.Models.Post.Post.FindAdminByFilter(l.ctx, postFilter, 1, scanSize)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询内容列表失败")
	}
	commentRows, err := l.svcCtx.Models.Post.CommentRecord.FindByFilter(l.ctx, commentFilter, 1, scanSize)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询内容列表失败")
	}

	accounts, profiles, err := l.loadAdminContentAuthors(append(collectPostAuthorIDs(postRows), collectCommentAuthorIDs(commentRows)...))
	if err != nil {
		return nil, err
	}
	entries := make([]adminContentEntry, 0, len(postRows)+len(commentRows))
	for _, row := range postRows {
		if row == nil {
			continue
		}
		entries = append(entries, adminContentEntry{
			createdAtUnix: row.CreatedAt.UnixNano(),
			id:            row.Id,
			response:      buildAdminPostContentResponse(row, accounts[row.UserId], profiles[row.UserId]),
		})
	}
	for _, row := range commentRows {
		if row == nil {
			continue
		}
		entries = append(entries, adminContentEntry{
			createdAtUnix: row.CreatedAt.UnixNano(),
			id:            row.Id,
			response:      buildAdminCommentContentResponse(row, accounts[row.UserId], profiles[row.UserId]),
		})
	}
	sort.SliceStable(entries, func(i, j int) bool {
		if entries[i].createdAtUnix == entries[j].createdAtUnix {
			return entries[i].id > entries[j].id
		}
		return entries[i].createdAtUnix > entries[j].createdAtUnix
	})

	offset := (pageNum - 1) * pageSize
	end := offset + pageSize
	if offset > int64(len(entries)) {
		offset = int64(len(entries))
	}
	if end > int64(len(entries)) {
		end = int64(len(entries))
	}
	startIdx := int(offset)
	endIdx := int(end)
	list := make([]types.AdminContentResponse, 0, endIdx-startIdx)
	for _, entry := range entries[startIdx:endIdx] {
		list = append(list, entry.response)
	}
	return &types.AdminContentPageResponse{PageNum: pageNum, PageSize: pageSize, Total: postTotal + commentTotal, List: list}, nil
}

type adminContentEntry struct {
	createdAtUnix int64
	id            uint64
	response      types.AdminContentResponse
}

func (l *GetAdminContentListLogic) loadAdminContentAuthors(userIDs []uint64) (map[uint64]*accountmodel.UserAccount, map[uint64]*profilemodel.UserProfile, error) {
	userIDs = uniquePositiveModerationIDs(userIDs)
	accountsByID := make(map[uint64]*accountmodel.UserAccount)
	if len(userIDs) == 0 {
		return accountsByID, map[uint64]*profilemodel.UserProfile{}, nil
	}
	accounts, err := l.svcCtx.Models.Account.UserAccount.FindByIDs(l.ctx, userIDs)
	if err != nil {
		return nil, nil, commonresponse.InternalServerError("查询作者账号失败")
	}
	for _, account := range accounts {
		if account != nil {
			accountsByID[account.Id] = account
		}
	}
	profiles, err := l.svcCtx.Models.Profile.UserProfile.FindByUserIDs(l.ctx, userIDs)
	if err != nil {
		return nil, nil, commonresponse.InternalServerError("查询作者资料失败")
	}
	return accountsByID, profiles, nil
}

func collectPostAuthorIDs(rows []*postmodel.Post) []uint64 {
	ids := make([]uint64, 0, len(rows))
	for _, row := range rows {
		if row != nil {
			ids = append(ids, row.UserId)
		}
	}
	return ids
}

func collectCommentAuthorIDs(rows []*postmodel.CommentRecord) []uint64 {
	ids := make([]uint64, 0, len(rows))
	for _, row := range rows {
		if row != nil {
			ids = append(ids, row.UserId)
		}
	}
	return ids
}

func uniquePositiveModerationIDs(ids []uint64) []uint64 {
	if len(ids) == 0 {
		return []uint64{}
	}
	seen := make(map[uint64]struct{}, len(ids))
	out := make([]uint64, 0, len(ids))
	for _, id := range ids {
		if id == 0 {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	return out
}
