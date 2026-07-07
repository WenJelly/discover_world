package media

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"

	commonauth "discover_world/internal/common/auth"
	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"discover_world/model"
)

const (
	directUploadType              = "direct"
	directUploadTTL               = 10 * time.Minute
	directUploadMetadataReadBytes = 256 << 10
)

type directUploadInitRequest struct {
	ID            uint64
	FileName      string
	FileSize      int64
	ContentType   string
	Format        string
	Title         string
	Description   string
	Category      string
	Tags          []string
	Visibility    string
	AssetUsage    string
	Width         int64
	Height        int64
	DominantColor string
	BlurHash      string
}

type directUploadSessionExtra struct {
	Width         int64  `json:"width,omitempty"`
	Height        int64  `json:"height,omitempty"`
	DominantColor string `json:"dominantColor,omitempty"`
	BlurHash      string `json:"blurHash,omitempty"`
}

type directUploadCompletePayload struct {
	ETag        string `json:"eTag,omitempty"`
	Size        int64  `json:"size,omitempty"`
	ContentType string `json:"contentType,omitempty"`
}

func initDirectMediaUpload(ctx context.Context, svcCtx *svc.ServiceContext, req *types.MediaAssetDirectUploadInitRequest, authorization string) (*types.MediaAssetDirectUploadInitResponse, error) {
	normalized, err := normalizeDirectUploadInitRequest(req)
	if err != nil {
		return nil, err
	}

	loginUser, err := commonauth.LoadRequiredLoginUser(ctx, svcCtx, authorization)
	if err != nil {
		return nil, err
	}

	target, err := loadStorageTarget(ctx, svcCtx, "media")
	if err != nil {
		return nil, err
	}
	if strings.ToLower(target.Provider.ProviderType) != "cos" {
		return nil, commonresponse.InternalServerError("当前仅支持 COS 上传")
	}
	if !hasCompleteStorageConfig(target) {
		return nil, commonresponse.InternalServerError("COS 配置不完整，请先配置本地密钥")
	}

	expiresAt := time.Now().Add(directUploadTTL)
	var resp *types.MediaAssetDirectUploadInitResponse

	if err := svcCtx.Transact(ctx, func(txCtx context.Context, txSvc *svc.ServiceContext) error {
		asset, err := prepareDirectUploadAsset(txCtx, txSvc, normalized, loginUser)
		if err != nil {
			return err
		}

		objectKey, err := buildMediaObjectKey(nullStringValue(target.Bucket.BasePath), "image", asset.Id, normalized.Format)
		if err != nil {
			return err
		}

		session := &model.MediaUploadSession{
			UserId:           loginUser.Id,
			AssetId:          sql.NullInt64{Int64: uint64ToInt64(asset.Id), Valid: true},
			ProviderId:       sql.NullInt64{Int64: uint64ToInt64(target.Provider.Id), Valid: true},
			BucketId:         sql.NullInt64{Int64: uint64ToInt64(target.Bucket.Id), Valid: true},
			UploadType:       directUploadType,
			ObjectKey:        objectKey,
			OriginalFilename: optionalString(normalized.FileName),
			MimeType:         optionalString(normalized.ContentType),
			FileSize:         optionalInt64(normalized.FileSize),
			Status:           "created",
			ExpireAt:         sql.NullTime{Time: expiresAt, Valid: true},
			ExtraJson:        directUploadExtraJSON(normalized),
		}
		result, err := txSvc.MediaUploadSessionModel.Insert(txCtx, session)
		if err != nil {
			return commonresponse.InternalServerError("创建上传会话失败")
		}
		id, err := result.LastInsertId()
		if err != nil || id <= 0 {
			return commonresponse.InternalServerError("读取上传会话ID失败")
		}
		session.Id = uint64(id)

		uploadURL := buildObjectURL(target.UploadURL, objectKey)
		parsedURL, err := url.Parse(uploadURL)
		if err != nil || parsedURL.Scheme == "" || parsedURL.Host == "" {
			return commonresponse.InternalServerError("生成 COS 上传地址失败")
		}

		resp = &types.MediaAssetDirectUploadInitResponse{
			SessionId:    formatID(session.Id),
			AssetId:      formatID(asset.Id),
			ObjectKey:    objectKey,
			UploadUrl:    uploadURL,
			UploadMethod: http.MethodPut,
			UploadHeaders: map[string]string{
				"Authorization": buildCOSAuthorization(target.Secret.SecretId, target.Secret.SecretKey, parsedURL, http.MethodPut),
				"Content-Type":  normalized.ContentType,
			},
			ExpiresAt: formatTime(expiresAt),
		}
		return nil
	}); err != nil {
		return nil, err
	}

	return resp, nil
}

func completeDirectMediaUpload(ctx context.Context, svcCtx *svc.ServiceContext, req *types.MediaAssetDirectUploadCompleteRequest, authorization string) (*types.MediaAssetResponse, error) {
	sessionID, err := parseRequiredID(req.SessionId, "sessionId")
	if err != nil {
		return nil, err
	}

	loginUser, err := commonauth.LoadRequiredLoginUser(ctx, svcCtx, authorization)
	if err != nil {
		return nil, err
	}

	session, err := svcCtx.MediaUploadSessionModel.FindOne(ctx, sessionID)
	if err != nil {
		if errors.Is(err, model.ErrNotFound) {
			return nil, commonresponse.NotFound("上传会话不存在")
		}
		return nil, commonresponse.InternalServerError("查询上传会话失败")
	}
	if session.UserId != loginUser.Id {
		return nil, commonresponse.Forbidden("无权完成该上传会话")
	}
	if session.Status == "completed" {
		return buildDirectUploadAssetResponse(ctx, svcCtx, session, loginUser)
	}
	if session.Status == "failed" || session.Status == "expired" {
		return nil, commonresponse.BadRequest("上传会话不可用")
	}
	if session.ExpireAt.Valid && time.Now().After(session.ExpireAt.Time) {
		session.Status = "expired"
		_ = svcCtx.MediaUploadSessionModel.Update(ctx, session)
		return nil, commonresponse.BadRequest("上传会话已过期")
	}

	assetID := uint64(0)
	if session.AssetId.Valid && session.AssetId.Int64 > 0 {
		assetID = uint64(session.AssetId.Int64)
	}
	if assetID == 0 {
		return nil, commonresponse.InternalServerError("上传会话缺少媒体资源")
	}

	providerID, bucketID := uint64(0), uint64(0)
	if session.ProviderId.Valid && session.ProviderId.Int64 > 0 {
		providerID = uint64(session.ProviderId.Int64)
	}
	if session.BucketId.Valid && session.BucketId.Int64 > 0 {
		bucketID = uint64(session.BucketId.Int64)
	}

	target, err := loadStorageTargetByIDs(ctx, svcCtx, providerID, bucketID)
	if err != nil {
		return nil, err
	}

	objectMeta, err := headObjectStorage(ctx, target, session.ObjectKey)
	if err != nil {
		return nil, err
	}
	if session.FileSize.Valid && objectMeta.Size >= 0 && session.FileSize.Int64 != objectMeta.Size {
		return nil, commonresponse.BadRequest("上传对象大小与会话不一致")
	}
	objectHeader, err := readObjectHeaderStorage(ctx, target, session.ObjectKey, directUploadMetadataReadBytes)
	if err != nil {
		return nil, err
	}
	if err := validateDirectUploadObjectHeader(objectHeader, session.ObjectKey); err != nil {
		return nil, err
	}
	objectExif := extractExifMetadataFromImageBytes(objectHeader, normalizeExtension(session.ObjectKey))

	sessionExtra := parseDirectUploadSessionExtra(session.ExtraJson)
	width, height := resolveDirectUploadDimensions(req.Width, req.Height, sessionExtra)
	contentType := resolveDirectUploadContentType(objectMeta.ContentType, nullStringValue(session.MimeType), session.ObjectKey)
	if !strings.HasPrefix(strings.ToLower(contentType), "image/") {
		return nil, commonresponse.BadRequest("上传对象不是图片")
	}

	etag := cleanETag(objectMeta.ETag)
	if etag == "" {
		etag = cleanETag(req.ETag)
	}

	var asset *model.MediaAsset
	var object *model.MediaObject
	if err := svcCtx.Transact(ctx, func(txCtx context.Context, txSvc *svc.ServiceContext) error {
		loaded, err := txSvc.MediaAssetModel.FindOneActive(txCtx, assetID)
		if err != nil {
			if errors.Is(err, model.ErrNotFound) {
				return commonresponse.NotFound("媒体资源不存在")
			}
			return commonresponse.InternalServerError("查询媒体资源失败")
		}
		if loaded.OwnerUserId != loginUser.Id && !txSvc.IsAdminAccount(loginUser) {
			return commonresponse.Forbidden("无权完成该媒体资源")
		}

		if err := txSvc.MediaObjectModel.MarkDeletedByAssetID(txCtx, loaded.Id); err != nil {
			return commonresponse.InternalServerError("更新历史媒体对象失败")
		}

		object = &model.MediaObject{
			AssetId:    loaded.Id,
			BucketId:   target.Bucket.Id,
			ObjectRole: "original",
			ObjectKey:  session.ObjectKey,
			StorageUri: buildStorageURI(target.Provider, target.Bucket, session.ObjectKey),
			MimeType:   optionalString(contentType),
			FileExt:    optionalString(normalizeExtension(session.ObjectKey)),
			FileSize:   optionalInt64(objectMeta.Size),
			Width:      optionalInt64(width),
			Height:     optionalInt64(height),
			Etag:       optionalString(etag),
			AccessType: target.Bucket.AccessType,
			Status:     "active",
		}
		if _, err := txSvc.MediaObjectModel.Insert(txCtx, object); err != nil {
			return commonresponse.InternalServerError("保存媒体对象失败")
		}

		metadata := parseMediaMetadata(loaded.MetadataJson)
		if req.DominantColor != "" {
			metadata.DominantColor = req.DominantColor
		}
		if req.BlurHash != "" {
			metadata.BlurHash = req.BlurHash
		}
		if objectExif != nil {
			metadata.Exif = objectExif
		}
		loaded.MetadataJson = metadataJSON(metadata)
		loaded.Status = "active"
		if err := txSvc.MediaAssetModel.Update(txCtx, loaded); err != nil {
			return commonresponse.InternalServerError("更新媒体资源失败")
		}
		if err := replaceAssetTags(txCtx, txSvc, loaded.Id, metadata.Tags); err != nil {
			return commonresponse.InternalServerError("保存媒体标签失败")
		}
		ensureEntityStat(txCtx, txSvc, loaded.Id)

		session.Status = "completed"
		session.CallbackPayload = directUploadCompleteJSON(objectMeta, etag)
		if err := txSvc.MediaUploadSessionModel.Update(txCtx, session); err != nil {
			return commonresponse.InternalServerError("更新上传会话失败")
		}

		asset = loaded
		return nil
	}); err != nil {
		return nil, err
	}

	profile, _ := svcCtx.UserProfileModel.FindOneByUserId(ctx, loginUser.Id)
	tags := parseMediaMetadata(asset.MetadataJson).Tags
	return buildMediaAssetResponse(ctx, svcCtx, asset, object, loginUser, profile, nil, tags, loginUser, types.MediaVariantRequest{})
}

func normalizeDirectUploadInitRequest(req *types.MediaAssetDirectUploadInitRequest) (directUploadInitRequest, error) {
	if req == nil {
		return directUploadInitRequest{}, commonresponse.BadRequest("请求不能为空")
	}

	fileName := strings.TrimSpace(req.FileName)
	if fileName == "" {
		return directUploadInitRequest{}, commonresponse.BadRequest("fileName 不能为空")
	}
	if !isAllowedMediaFilename(fileName) {
		return directUploadInitRequest{}, commonresponse.BadRequest("仅支持 jpg、jpeg、png、webp 图片")
	}
	if req.FileSize <= 0 {
		return directUploadInitRequest{}, commonresponse.BadRequest("fileSize 必须是正整数")
	}
	if req.FileSize > MaxFileUploadSize {
		return directUploadInitRequest{}, commonresponse.BadRequest("图片大小不能超过 30MB")
	}
	if req.Width < 0 || req.Height < 0 {
		return directUploadInitRequest{}, commonresponse.BadRequest("图片宽高不能为负数")
	}

	id, err := parseOptionalID(req.Id, "id")
	if err != nil {
		return directUploadInitRequest{}, err
	}

	format := normalizeExtension(fileName)
	if format == "jpeg" {
		format = "jpg"
	}
	contentType := strings.ToLower(strings.TrimSpace(req.ContentType))
	if contentType == "" {
		contentType = contentTypeForFormat(format)
	}
	if !strings.HasPrefix(contentType, "image/") {
		return directUploadInitRequest{}, commonresponse.BadRequest("contentType 必须是图片类型")
	}

	return directUploadInitRequest{
		ID:            id,
		FileName:      fileName,
		FileSize:      req.FileSize,
		ContentType:   contentType,
		Format:        format,
		Title:         strings.TrimSpace(req.Title),
		Description:   strings.TrimSpace(req.Description),
		Category:      strings.TrimSpace(req.Category),
		Tags:          normalizeTags(req.Tags),
		Visibility:    normalizeVisibility(req.Visibility),
		AssetUsage:    normalizeAssetUsage(req.AssetUsage),
		Width:         req.Width,
		Height:        req.Height,
		DominantColor: strings.TrimSpace(req.DominantColor),
		BlurHash:      strings.TrimSpace(req.BlurHash),
	}, nil
}

func prepareDirectUploadAsset(ctx context.Context, svcCtx *svc.ServiceContext, req directUploadInitRequest, loginUser *model.UserAccount) (*model.MediaAsset, error) {
	var existing *model.MediaAsset
	if req.ID > 0 {
		asset, err := svcCtx.MediaAssetModel.FindOneActive(ctx, req.ID)
		if err != nil {
			if errors.Is(err, model.ErrNotFound) {
				return nil, commonresponse.NotFound("媒体资源不存在")
			}
			return nil, commonresponse.InternalServerError("查询媒体资源失败")
		}
		if !canManageMediaAsset(asset, loginUser, svcCtx) {
			return nil, commonresponse.Forbidden("无权修改该媒体资源")
		}
		existing = asset
	}

	metadata := mediaMetadata{
		UsageType:     "media",
		Category:      req.Category,
		Tags:          req.Tags,
		DominantColor: req.DominantColor,
		BlurHash:      req.BlurHash,
	}
	auditStatus := initialUploadAuditStatus(req.AssetUsage, svcCtx.IsAdminAccount(loginUser))

	if existing == nil {
		asset := &model.MediaAsset{
			OwnerUserId:      loginUser.Id,
			MediaType:        "image",
			AssetUsage:       req.AssetUsage,
			Title:            optionalString(resolveMediaTitle(req.Title, req.FileName)),
			Description:      optionalString(req.Description),
			OriginalFilename: optionalString(req.FileName),
			Visibility:       req.Visibility,
			Status:           "uploading",
			AuditStatus:      auditStatus,
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
		return asset, nil
	}

	existing.AssetUsage = req.AssetUsage
	existing.Title = optionalString(resolveMediaTitle(req.Title, req.FileName))
	existing.Description = optionalString(req.Description)
	existing.OriginalFilename = optionalString(req.FileName)
	existing.Visibility = req.Visibility
	existing.Status = "uploading"
	existing.AuditStatus = auditStatus
	existing.MetadataJson = metadataJSON(metadata)
	if err := svcCtx.MediaAssetModel.Update(ctx, existing); err != nil {
		return nil, commonresponse.InternalServerError("更新媒体资源失败")
	}
	return existing, nil
}

func directUploadExtraJSON(req directUploadInitRequest) sql.NullString {
	extra := directUploadSessionExtra{
		Width:         req.Width,
		Height:        req.Height,
		DominantColor: req.DominantColor,
		BlurHash:      req.BlurHash,
	}
	data, err := json.Marshal(extra)
	if err != nil || string(data) == "{}" {
		return sql.NullString{}
	}
	return sql.NullString{String: string(data), Valid: true}
}

func parseDirectUploadSessionExtra(raw sql.NullString) directUploadSessionExtra {
	if !raw.Valid || strings.TrimSpace(raw.String) == "" {
		return directUploadSessionExtra{}
	}
	var extra directUploadSessionExtra
	if err := json.Unmarshal([]byte(raw.String), &extra); err != nil {
		return directUploadSessionExtra{}
	}
	return extra
}

func resolveDirectUploadDimensions(width, height int64, extra directUploadSessionExtra) (int64, int64) {
	if width <= 0 {
		width = extra.Width
	}
	if height <= 0 {
		height = extra.Height
	}
	if width < 0 {
		width = 0
	}
	if height < 0 {
		height = 0
	}
	return width, height
}

func resolveDirectUploadContentType(headContentType, sessionContentType, objectKey string) string {
	contentType := strings.TrimSpace(headContentType)
	if contentType == "" || strings.EqualFold(contentType, "application/octet-stream") {
		contentType = strings.TrimSpace(sessionContentType)
	}
	if contentType == "" {
		contentType = contentTypeForFormat(normalizeExtension(objectKey))
	}
	return strings.ToLower(contentType)
}

func directUploadCompleteJSON(meta objectStorageMetadata, etag string) sql.NullString {
	payload := directUploadCompletePayload{
		ETag:        etag,
		Size:        meta.Size,
		ContentType: strings.TrimSpace(meta.ContentType),
	}
	data, err := json.Marshal(payload)
	if err != nil || string(data) == "{}" {
		return sql.NullString{}
	}
	return sql.NullString{String: string(data), Valid: true}
}

func cleanETag(value string) string {
	return strings.Trim(strings.TrimSpace(value), "\"")
}

func validateDirectUploadObjectHeader(header []byte, objectKey string) error {
	format := detectMediaFormat(header, "")
	if format == "" {
		return commonresponse.BadRequest("上传对象不是支持的图片格式")
	}
	if format == "jpeg" {
		format = "jpg"
	}

	declared := normalizeExtension(objectKey)
	if declared == "jpeg" {
		declared = "jpg"
	}
	if declared == "" || declared != format {
		return commonresponse.BadRequest("上传对象内容与文件类型不一致")
	}
	return nil
}

func buildDirectUploadAssetResponse(ctx context.Context, svcCtx *svc.ServiceContext, session *model.MediaUploadSession, viewer *model.UserAccount) (*types.MediaAssetResponse, error) {
	if session == nil || !session.AssetId.Valid || session.AssetId.Int64 <= 0 {
		return nil, commonresponse.InternalServerError("上传会话缺少媒体资源")
	}
	asset, err := svcCtx.MediaAssetModel.FindOneActive(ctx, uint64(session.AssetId.Int64))
	if err != nil {
		if errors.Is(err, model.ErrNotFound) {
			return nil, commonresponse.NotFound("媒体资源不存在")
		}
		return nil, commonresponse.InternalServerError("查询媒体资源失败")
	}
	if asset.OwnerUserId != viewer.Id && !svcCtx.IsAdminAccount(viewer) {
		return nil, commonresponse.Forbidden("无权查看该媒体资源")
	}
	object, err := svcCtx.MediaObjectModel.FindOriginalByAssetID(ctx, asset.Id)
	if err != nil {
		if errors.Is(err, model.ErrNotFound) {
			return nil, commonresponse.BadRequest("上传对象尚未完成")
		}
		return nil, commonresponse.InternalServerError("查询媒体对象失败")
	}
	profile, _ := svcCtx.UserProfileModel.FindOneByUserId(ctx, viewer.Id)
	tags := parseMediaMetadata(asset.MetadataJson).Tags
	return buildMediaAssetResponse(ctx, svcCtx, asset, object, viewer, profile, nil, tags, viewer, types.MediaVariantRequest{})
}
