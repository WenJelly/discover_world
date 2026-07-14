package media

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha1"
	mediamodel "discover_world/model/media"
	"encoding/hex"
	"errors"
	"fmt"
	"github.com/zeromicro/go-zero/core/stores/sqlx"
	"io"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"
	"time"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/config"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"github.com/zeromicro/go-zero/core/logx"
)

type storageTarget struct {
	Bucket    *mediamodel.StorageBucket
	Provider  *mediamodel.StorageProvider
	Secret    config.StorageSecretConfig
	UploadURL string
}

type objectStorageMetadata struct {
	Size        int64
	ContentType string
	ETag        string
}

var cosHTTPClient = &http.Client{Timeout: 30 * time.Second}

func loadStorageTarget(ctx context.Context, svcCtx *svc.ServiceContext, usageType string) (*storageTarget, error) {
	var bucket *mediamodel.StorageBucket
	var err error
	for _, candidate := range storageUsageCandidates(usageType) {
		bucket, err = svcCtx.Models.Media.StorageBucket.FindDefaultActiveByUsage(ctx, candidate)
		if err == nil {
			break
		}
		if !errors.Is(err, sqlx.ErrNotFound) {
			return nil, commonresponse.InternalServerError("查询存储桶失败")
		}
	}
	if bucket == nil {
		return nil, commonresponse.InternalServerError("未配置可用存储桶")
	}

	provider, err := svcCtx.Models.Media.StorageProvider.FindOne(ctx, bucket.ProviderId)
	if err != nil || provider.Status != 1 {
		if errors.Is(err, sqlx.ErrNotFound) {
			return nil, commonresponse.InternalServerError("存储服务商不存在")
		}
		return nil, commonresponse.InternalServerError("查询存储服务商失败")
	}

	uploadURL := strings.TrimSpace(nullStringValue(bucket.Endpoint))
	if uploadURL == "" {
		uploadURL = strings.TrimSpace(nullStringValue(provider.Endpoint))
	}

	secretRef := nullStringValue(provider.SecretRef)
	if secretRef == "" {
		secretRef = "default"
	}

	return &storageTarget{
		Bucket:    bucket,
		Provider:  provider,
		Secret:    svcCtx.StorageSecret(secretRef),
		UploadURL: uploadURL,
	}, nil
}

func loadStorageTargetByIDs(ctx context.Context, svcCtx *svc.ServiceContext, providerID, bucketID uint64) (*storageTarget, error) {
	if providerID == 0 || bucketID == 0 {
		return nil, commonresponse.InternalServerError("上传会话存储配置不完整")
	}

	bucket, err := svcCtx.Models.Media.StorageBucket.FindOne(ctx, bucketID)
	if err != nil || bucket.ProviderId != providerID || bucket.Status != 1 {
		if errors.Is(err, sqlx.ErrNotFound) {
			return nil, commonresponse.InternalServerError("存储桶不存在")
		}
		return nil, commonresponse.InternalServerError("查询存储桶失败")
	}

	provider, err := svcCtx.Models.Media.StorageProvider.FindOne(ctx, providerID)
	if err != nil || provider.Status != 1 {
		if errors.Is(err, sqlx.ErrNotFound) {
			return nil, commonresponse.InternalServerError("存储服务商不存在")
		}
		return nil, commonresponse.InternalServerError("查询存储服务商失败")
	}

	uploadURL := strings.TrimSpace(nullStringValue(bucket.Endpoint))
	if uploadURL == "" {
		uploadURL = strings.TrimSpace(nullStringValue(provider.Endpoint))
	}

	secretRef := nullStringValue(provider.SecretRef)
	if secretRef == "" {
		secretRef = "default"
	}

	return &storageTarget{
		Bucket:    bucket,
		Provider:  provider,
		Secret:    svcCtx.StorageSecret(secretRef),
		UploadURL: uploadURL,
	}, nil
}

func storageUsageCandidates(usageType string) []string {
	return []string{normalizeUsageType(usageType)}
}

func buildPublicObjectURL(bucket *mediamodel.StorageBucket, objectKey string) string {
	if bucket == nil {
		return ""
	}

	host := strings.TrimSpace(nullStringValue(bucket.CdnDomain))
	if host == "" {
		host = strings.TrimSpace(nullStringValue(bucket.Endpoint))
	}
	if host == "" {
		return ""
	}
	if !strings.Contains(host, "://") {
		host = "https://" + host
	}
	return buildObjectURL(host, objectKey)
}

func BuildPublicObjectURL(bucket *mediamodel.StorageBucket, objectKey string) string {
	return buildPublicObjectURL(bucket, objectKey)
}

func buildObjectURL(host, objectKey string) string {
	return strings.TrimRight(host, "/") + "/" + escapeObjectKey(objectKey)
}

func escapeObjectKey(objectKey string) string {
	parts := strings.Split(strings.TrimLeft(objectKey, "/"), "/")
	for i, part := range parts {
		parts[i] = url.PathEscape(part)
	}
	return strings.Join(parts, "/")
}

func buildMediaObjectKey(basePath, mediaType string, assetID uint64, format string) (string, error) {
	if assetID == 0 {
		return "", commonresponse.BadRequest("asset id 必须是正整数")
	}

	ext := strings.ToLower(strings.TrimPrefix(strings.TrimSpace(format), "."))
	if ext == "jpeg" {
		ext = "jpg"
	}
	if ext == "" {
		ext = "jpg"
	}

	basePath = strings.Trim(strings.TrimSpace(basePath), "/")
	if basePath == "" {
		basePath = "media/" + mediaTypePath(mediaType)
	}

	return fmt.Sprintf("%s/asset-%d/original.%s", basePath, assetID, ext), nil
}

func mediaTypePath(mediaType string) string {
	switch strings.ToLower(strings.TrimSpace(mediaType)) {
	case "video":
		return "videos"
	case "audio":
		return "audios"
	case "document":
		return "documents"
	default:
		return "images"
	}
}

func buildVariantURL(baseURL string, size, width, height int64, option types.MediaVariantRequest) (string, error) {
	switch option.CompressType {
	case 0:
		return baseURL, nil
	case 1:
		if strings.TrimSpace(baseURL) == "" {
			return "", nil
		}
		if shouldCompressImage(size, width, height) {
			maxEdge, quality := compressedThumbnailProfile(size)
			return fmt.Sprintf("%s?imageMogr2/auto-orient/strip/thumbnail/%dx%d>/format/webp/quality/%d!/minsize/1/ignore-error/1", baseURL, maxEdge, maxEdge, quality), nil
		}
		return baseURL, nil
	case 2:
		if strings.TrimSpace(baseURL) == "" {
			return "", nil
		}
		return fmt.Sprintf("%s?imageMogr2/auto-orient/strip/thumbnail/1200x1200>/format/webp/quality/70!/minsize/1/ignore-error/1", baseURL), nil
	case 3:
		if option.CutWidth <= 0 || option.CutHeight <= 0 {
			return "", commonresponse.BadRequest("compressType=3 时 cutWidth 和 cutHeight 必须为正整数")
		}
		if option.CutWidth > maxVariantCropDimension || option.CutHeight > maxVariantCropDimension {
			return "", commonresponse.BadRequest("compressType=3 裁剪尺寸不能超过 4096")
		}
		if strings.TrimSpace(baseURL) == "" {
			return "", nil
		}
		return fmt.Sprintf("%s?imageMogr2/auto-orient/strip/thumbnail/%dx%d^>/gravity/center/crop/%dx%d/format/webp/ignore-error/1", baseURL, option.CutWidth, option.CutHeight, option.CutWidth, option.CutHeight), nil
	default:
		return "", commonresponse.BadRequest("compressType 只能是 0、1、2、3")
	}
}

func shouldCompressImage(size, width, height int64) bool {
	if size > compressedImageThreshold {
		return true
	}
	return width > compressedImageMaxEdge || height > compressedImageMaxEdge
}

func compressedThumbnailProfile(size int64) (maxEdge int, quality int) {
	switch {
	case size >= largeCompressedThreshold:
		return 1600, 75
	case size > mediumCompressedThreshold:
		return 1920, 80
	default:
		return 2560, 85
	}
}

func isAllowedMediaFilename(filename string) bool {
	switch normalizeExtension(filename) {
	case "jpg", "jpeg", "png", "webp":
		return true
	default:
		return false
	}
}

func normalizeExtension(filename string) string {
	return strings.ToLower(strings.TrimPrefix(filepath.Ext(filename), "."))
}

func detectMediaFormat(header []byte, originalFilename string) string {
	switch {
	case len(header) >= 3 && bytes.Equal(header[:3], []byte{0xFF, 0xD8, 0xFF}):
		return "jpg"
	case len(header) >= 8 && bytes.Equal(header[:8], []byte{0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A}):
		return "png"
	case len(header) >= 12 && bytes.Equal(header[:4], []byte("RIFF")) && bytes.Equal(header[8:12], []byte("WEBP")):
		return "webp"
	default:
		ext := normalizeExtension(originalFilename)
		if ext == "jpeg" {
			return "jpeg"
		}
		if ext == "jpg" || ext == "png" || ext == "webp" {
			return ext
		}
		return ""
	}
}

func headObjectStorage(ctx context.Context, target *storageTarget, objectKey string) (objectStorageMetadata, error) {
	if target == nil || target.Provider == nil {
		return objectStorageMetadata{}, commonresponse.InternalServerError("存储配置不存在")
	}
	if strings.ToLower(target.Provider.ProviderType) != "cos" {
		return objectStorageMetadata{}, commonresponse.InternalServerError("当前仅支持 COS 上传")
	}
	if !hasCompleteStorageConfig(target) {
		return objectStorageMetadata{}, commonresponse.InternalServerError("COS 配置不完整，请先配置本地密钥")
	}

	targetURL := buildObjectURL(target.UploadURL, objectKey)
	parsedURL, err := url.Parse(targetURL)
	if err != nil {
		return objectStorageMetadata{}, commonresponse.InternalServerError("生成 COS 地址失败")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodHead, targetURL, nil)
	if err != nil {
		return objectStorageMetadata{}, commonresponse.InternalServerError("创建 COS 校验请求失败")
	}
	req.Header.Set("Authorization", buildCOSAuthorization(target.Secret.SecretId, target.Secret.SecretKey, parsedURL, http.MethodHead))
	req.Host = parsedURL.Host

	startedAt := time.Now()
	resp, err := cosHTTPClient.Do(req)
	if err != nil {
		observeCOSRequest(http.MethodHead, startedAt, 0, err)
		logx.WithContext(ctx).Errorf("COS head request failed: objectKey=%s url=%s err=%v", objectKey, targetURL, err)
		return objectStorageMetadata{}, commonresponse.InternalServerError("校验 COS 对象失败")
	}
	observeCOSRequest(http.MethodHead, startedAt, resp.StatusCode, nil)
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return objectStorageMetadata{}, commonresponse.BadRequest("未找到已上传对象")
	}
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		logx.WithContext(ctx).Errorf("COS head rejected: objectKey=%s url=%s status=%d requestId=%s", objectKey, targetURL, resp.StatusCode, resp.Header.Get("x-cos-request-id"))
		return objectStorageMetadata{}, commonresponse.InternalServerError("校验 COS 对象失败")
	}

	return objectStorageMetadata{
		Size:        resp.ContentLength,
		ContentType: strings.TrimSpace(resp.Header.Get("Content-Type")),
		ETag:        strings.Trim(strings.TrimSpace(resp.Header.Get("ETag")), "\""),
	}, nil
}

func readObjectHeaderStorage(ctx context.Context, target *storageTarget, objectKey string, maxBytes int64) ([]byte, error) {
	if maxBytes <= 0 {
		maxBytes = 64
	}
	if target == nil || target.Provider == nil {
		return nil, commonresponse.InternalServerError("存储配置不存在")
	}
	if strings.ToLower(target.Provider.ProviderType) != "cos" {
		return nil, commonresponse.InternalServerError("当前仅支持 COS 上传")
	}
	if !hasCompleteStorageConfig(target) {
		return nil, commonresponse.InternalServerError("COS 配置不完整，请先配置本地密钥")
	}

	targetURL := buildObjectURL(target.UploadURL, objectKey)
	parsedURL, err := url.Parse(targetURL)
	if err != nil {
		return nil, commonresponse.InternalServerError("生成 COS 地址失败")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		return nil, commonresponse.InternalServerError("创建 COS 内容校验请求失败")
	}
	req.Header.Set("Authorization", buildCOSAuthorization(target.Secret.SecretId, target.Secret.SecretKey, parsedURL, http.MethodGet))
	req.Header.Set("Range", fmt.Sprintf("bytes=0-%d", maxBytes-1))
	req.Host = parsedURL.Host

	startedAt := time.Now()
	resp, err := cosHTTPClient.Do(req)
	if err != nil {
		observeCOSRequest(http.MethodGet, startedAt, 0, err)
		logx.WithContext(ctx).Errorf("COS header read request failed: objectKey=%s url=%s err=%v", objectKey, targetURL, err)
		return nil, commonresponse.InternalServerError("校验 COS 对象内容失败")
	}
	observeCOSRequest(http.MethodGet, startedAt, resp.StatusCode, nil)
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, commonresponse.BadRequest("未找到已上传对象")
	}
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusPartialContent {
		logx.WithContext(ctx).Errorf("COS header read rejected: objectKey=%s url=%s status=%d requestId=%s", objectKey, targetURL, resp.StatusCode, resp.Header.Get("x-cos-request-id"))
		return nil, commonresponse.InternalServerError("校验 COS 对象内容失败")
	}

	data, err := io.ReadAll(io.LimitReader(resp.Body, maxBytes))
	if err != nil {
		return nil, commonresponse.InternalServerError("读取 COS 对象内容失败")
	}
	return data, nil
}

func hasCompleteStorageConfig(target *storageTarget) bool {
	return target != nil &&
		strings.TrimSpace(target.UploadURL) != "" &&
		strings.TrimSpace(target.Secret.SecretId) != "" &&
		strings.TrimSpace(target.Secret.SecretKey) != ""
}

func buildStorageURI(provider *mediamodel.StorageProvider, bucket *mediamodel.StorageBucket, objectKey string) string {
	if provider == nil || bucket == nil {
		return objectKey
	}
	code := strings.TrimSpace(provider.Code)
	if code == "" {
		code = strings.TrimSpace(provider.ProviderType)
	}
	return fmt.Sprintf("%s://%s/%s", code, bucket.BucketName, strings.TrimLeft(objectKey, "/"))
}

func buildCOSAuthorization(secretID, secretKey string, parsedURL *url.URL, method string) string {
	return buildCOSAuthorizationAt(secretID, secretKey, parsedURL, method, time.Now(), 10*time.Minute)
}

func buildCOSAuthorizationAt(secretID, secretKey string, parsedURL *url.URL, method string, now time.Time, ttl time.Duration) string {
	if ttl <= 0 {
		ttl = 10 * time.Minute
	}
	signTime := fmt.Sprintf("%d;%d", now.Add(-60*time.Second).Unix(), now.Add(ttl).Unix())
	httpString := fmt.Sprintf("%s\n%s\n\nhost=%s\n", strings.ToLower(method), parsedURL.EscapedPath(), strings.ToLower(parsedURL.Host))
	stringToSign := fmt.Sprintf("sha1\n%s\n%s\n", signTime, sha1Hex(httpString))
	signKey := hmacSha1Hex(secretKey, signTime)
	signature := hmacSha1Hex(signKey, stringToSign)

	return fmt.Sprintf(
		"q-sign-algorithm=sha1&q-ak=%s&q-sign-time=%s&q-key-time=%s&q-header-list=host&q-url-param-list=&q-signature=%s",
		secretID,
		signTime,
		signTime,
		signature,
	)
}

func sha1Hex(value string) string {
	sum := sha1.Sum([]byte(value))
	return hex.EncodeToString(sum[:])
}

func hmacSha1Hex(key, value string) string {
	mac := hmac.New(sha1.New, []byte(key))
	_, _ = mac.Write([]byte(value))
	return hex.EncodeToString(mac.Sum(nil))
}
