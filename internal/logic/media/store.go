package media

import (
	"context"
	"errors"
	"mime/multipart"
	"strings"

	commonauth "discover_world/internal/common/auth"
	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"discover_world/model"

	"github.com/zeromicro/go-zero/core/logx"
)

type mediaWriteRequest struct {
	ID          uint64
	Title       string
	Description string
	Category    string
	Tags        []string
	Visibility  string
	UsageType   string
	AssetUsage  string
}

type MediaWriteRequest = mediaWriteRequest

func storeMultipartMediaAsset(ctx context.Context, svcCtx *svc.ServiceContext, file multipart.File, header *multipart.FileHeader, req mediaWriteRequest, authorization string) (*types.MediaAssetResponse, error) {
	tempPath, originalFilename, cleanup, err := saveMultipartFileToTemp(file, header)
	if err != nil {
		return nil, err
	}
	defer cleanup()

	loginUser, err := commonauth.LoadRequiredLoginUser(ctx, svcCtx, authorization)
	if err != nil {
		return nil, err
	}

	return storeMediaAsset(ctx, svcCtx, tempPath, originalFilename, req, loginUser)
}

func StoreMultipartMediaAsset(ctx context.Context, svcCtx *svc.ServiceContext, file multipart.File, header *multipart.FileHeader, req MediaWriteRequest, authorization string) (*types.MediaAssetResponse, error) {
	return storeMultipartMediaAsset(ctx, svcCtx, file, header, req, authorization)
}

func storeRemoteMediaAsset(ctx context.Context, svcCtx *svc.ServiceContext, req *types.MediaAssetUploadByUrlRequest, authorization string) (*types.MediaAssetResponse, error) {
	if req == nil {
		return nil, commonresponse.BadRequest("请求不能为空")
	}

	tempPath, originalFilename, cleanup, err := downloadRemoteImageToTemp(ctx, req.FileUrl)
	if err != nil {
		return nil, err
	}
	defer cleanup()

	loginUser, err := commonauth.LoadRequiredLoginUser(ctx, svcCtx, authorization)
	if err != nil {
		return nil, err
	}

	id, err := parseOptionalID(req.Id, "id")
	if err != nil {
		return nil, err
	}

	return storeMediaAsset(ctx, svcCtx, tempPath, originalFilename, mediaWriteRequest{
		ID:          id,
		Title:       req.Title,
		Description: req.Description,
		Category:    req.Category,
		Tags:        req.Tags,
		Visibility:  req.Visibility,
		UsageType:   "media",
		AssetUsage:  req.AssetUsage,
	}, loginUser)
}

func storeMediaAsset(ctx context.Context, svcCtx *svc.ServiceContext, tempPath, originalFilename string, req mediaWriteRequest, loginUser *model.UserAccount) (*types.MediaAssetResponse, error) {
	if loginUser == nil {
		return nil, commonresponse.Unauthorized("请先登录")
	}

	fileMetadata, err := extractMediaMetadata(tempPath, originalFilename)
	if err != nil {
		return nil, err
	}

	usageType := strings.TrimSpace(req.UsageType)
	if usageType == "" {
		usageType = "media"
	}
	assetUsage := normalizeAssetUsage(req.AssetUsage)
	target, err := loadStorageTarget(ctx, svcCtx, usageType)
	if err != nil {
		return nil, err
	}

	var existing *model.MediaAsset
	if req.ID > 0 {
		existing, err = svcCtx.MediaAssetModel.FindOneActive(ctx, req.ID)
		if err != nil {
			if errors.Is(err, model.ErrNotFound) {
				return nil, commonresponse.NotFound("媒体资源不存在")
			}
			return nil, commonresponse.InternalServerError("查询媒体资源失败")
		}
		if !canManageMediaAsset(existing, loginUser, svcCtx) {
			return nil, commonresponse.Forbidden("无权修改该媒体资源")
		}
	}

	metadata := mediaMetadata{
		UsageType:     normalizeUsageType(usageType),
		Category:      req.Category,
		Tags:          req.Tags,
		DominantColor: fileMetadata.DominantColor,
		BlurHash:      fileMetadata.BlurHash,
	}

	asset := existing
	createdAsset := false
	if asset == nil {
		asset = &model.MediaAsset{
			OwnerUserId:      loginUser.Id,
			MediaType:        "image",
			AssetUsage:       assetUsage,
			Title:            optionalString(resolveMediaTitle(req.Title, originalFilename)),
			Description:      optionalString(req.Description),
			OriginalFilename: optionalString(originalFilename),
			Visibility:       normalizeVisibility(req.Visibility),
			Status:           "uploading",
			AuditStatus:      initialUploadAuditStatus(),
			MetadataJson:     metadataJSON(metadata),
		}
		result, err := svcCtx.MediaAssetModel.Insert(ctx, asset)
		if err != nil {
			return nil, commonresponse.InternalServerError("保存媒体资源失败")
		}
		id, err := result.LastInsertId()
		if err != nil || id <= 0 {
			return nil, commonresponse.InternalServerError("读取媒体资源ID失败")
		}
		asset.Id = uint64(id)
		createdAsset = true
	} else {
		asset.AssetUsage = assetUsage
		asset.Title = optionalString(resolveMediaTitle(req.Title, originalFilename))
		asset.Description = optionalString(req.Description)
		asset.OriginalFilename = optionalString(originalFilename)
		asset.Visibility = normalizeVisibility(req.Visibility)
		asset.Status = "uploading"
		asset.AuditStatus = initialUploadAuditStatus()
		asset.MetadataJson = metadataJSON(metadata)
	}

	failUpload := func(err error) error {
		if !createdAsset {
			return err
		}
		return markMediaAssetUploadFailed(ctx, asset, err, svcCtx.MediaAssetModel.Update)
	}

	objectKey, err := buildMediaObjectKey(nullStringValue(target.Bucket.BasePath), "image", asset.Id, fileMetadata.Format)
	if err != nil {
		return nil, failUpload(err)
	}
	if err := uploadFileToObjectStorage(ctx, target, tempPath, objectKey, contentTypeForFormat(fileMetadata.Format)); err != nil {
		return nil, failUpload(err)
	}

	if existing != nil {
		if err := svcCtx.MediaObjectModel.MarkDeletedByAssetID(ctx, asset.Id); err != nil {
			return nil, commonresponse.InternalServerError("更新历史媒体对象失败")
		}
	}

	object := &model.MediaObject{
		AssetId:    asset.Id,
		BucketId:   target.Bucket.Id,
		ObjectRole: "original",
		ObjectKey:  objectKey,
		StorageUri: buildStorageURI(target.Provider, target.Bucket, objectKey),
		MimeType:   optionalString(contentTypeForFormat(fileMetadata.Format)),
		FileExt:    optionalString(fileMetadata.Format),
		FileSize:   optionalInt64(fileMetadata.Size),
		Width:      optionalInt64(fileMetadata.Width),
		Height:     optionalInt64(fileMetadata.Height),
		AccessType: target.Bucket.AccessType,
		Status:     "active",
	}
	if _, err := svcCtx.MediaObjectModel.Insert(ctx, object); err != nil {
		return nil, commonresponse.InternalServerError("保存媒体对象失败")
	}

	asset.Status = "active"
	if err := svcCtx.MediaAssetModel.Update(ctx, asset); err != nil {
		return nil, commonresponse.InternalServerError("更新媒体资源失败")
	}

	if err := replaceAssetTags(ctx, svcCtx, asset.Id, req.Tags); err != nil {
		return nil, commonresponse.InternalServerError("保存媒体标签失败")
	}
	ensureEntityStat(ctx, svcCtx, asset.Id)

	profile, _ := svcCtx.UserProfileModel.FindOneByUserId(ctx, loginUser.Id)
	return buildMediaAssetResponse(ctx, svcCtx, asset, object, loginUser, profile, nil, normalizeTags(req.Tags), loginUser, types.MediaVariantRequest{})
}

func markMediaAssetUploadFailed(ctx context.Context, asset *model.MediaAsset, cause error, update func(context.Context, *model.MediaAsset) error) error {
	if cause == nil {
		cause = commonresponse.InternalServerError("media asset upload failed")
	}
	if asset == nil || asset.Id == 0 || update == nil {
		return cause
	}

	asset.Status = "failed"
	if err := update(ctx, asset); err != nil {
		logx.WithContext(ctx).Errorf("mark media asset upload failed status error: assetId=%d cause=%v err=%v", asset.Id, cause, err)
	}
	return cause
}

func replaceAssetTags(ctx context.Context, svcCtx *svc.ServiceContext, assetID uint64, tags []string) error {
	tags = normalizeTags(tags)
	tagIDs := make([]uint64, 0, len(tags))
	for _, name := range tags {
		tag, err := svcCtx.TagModel.EnsureByName(ctx, name)
		if err != nil {
			return err
		}
		tagIDs = append(tagIDs, tag.Id)
	}
	return svcCtx.TaggingModel.ReplaceTargetTags(ctx, targetTypeMediaAsset, assetID, tagIDs)
}

func ensureEntityStat(ctx context.Context, svcCtx *svc.ServiceContext, assetID uint64) {
	_, err := svcCtx.EntityStatModel.FindOneByTargetTypeTargetId(ctx, targetTypeMediaAsset, assetID)
	if errors.Is(err, model.ErrNotFound) {
		_, _ = svcCtx.EntityStatModel.Insert(ctx, &model.EntityStat{
			TargetType: targetTypeMediaAsset,
			TargetId:   assetID,
		})
	}
}

func resolveMediaTitle(title, originalFilename string) string {
	title = strings.TrimSpace(title)
	if title != "" {
		return title
	}
	name := strings.TrimSpace(originalFilename)
	if name == "" {
		return "未命名媒体"
	}
	if dot := strings.LastIndex(name, "."); dot > 0 {
		name = name[:dot]
	}
	if name == "" {
		return "未命名媒体"
	}
	return name
}
