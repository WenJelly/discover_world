package media

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/config"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"discover_world/model"

	"github.com/zeromicro/go-zero/core/logx"
)

type storageTarget struct {
	Bucket    *model.StorageBucket
	Provider  *model.StorageProvider
	Secret    config.StorageSecretConfig
	UploadURL string
}

type mediaFileMetadata struct {
	Size          int64
	Width         int64
	Height        int64
	Format        string
	DominantColor string
	BlurHash      string
}

type objectStorageMetadata struct {
	Size        int64
	ContentType string
	ETag        string
}

func loadStorageTarget(ctx context.Context, svcCtx *svc.ServiceContext, usageType string) (*storageTarget, error) {
	var bucket *model.StorageBucket
	var err error
	for _, candidate := range storageUsageCandidates(usageType) {
		bucket, err = svcCtx.StorageBucketModel.FindDefaultActiveByUsage(ctx, candidate)
		if err == nil {
			break
		}
		if !errors.Is(err, model.ErrNotFound) {
			return nil, commonresponse.InternalServerError("查询存储桶失败")
		}
	}
	if bucket == nil {
		return nil, commonresponse.InternalServerError("未配置可用存储桶")
	}

	provider, err := svcCtx.StorageProviderModel.FindOne(ctx, bucket.ProviderId)
	if err != nil || provider.Status != 1 {
		if errors.Is(err, model.ErrNotFound) {
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

	bucket, err := svcCtx.StorageBucketModel.FindOne(ctx, bucketID)
	if err != nil || bucket.ProviderId != providerID || bucket.Status != 1 {
		if errors.Is(err, model.ErrNotFound) {
			return nil, commonresponse.InternalServerError("存储桶不存在")
		}
		return nil, commonresponse.InternalServerError("查询存储桶失败")
	}

	provider, err := svcCtx.StorageProviderModel.FindOne(ctx, providerID)
	if err != nil || provider.Status != 1 {
		if errors.Is(err, model.ErrNotFound) {
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

func buildPublicObjectURL(bucket *model.StorageBucket, objectKey string) string {
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

func BuildPublicObjectURL(bucket *model.StorageBucket, objectKey string) string {
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

func buildTempObjectKey(basePath, mediaType string, userID uint64, format string) (string, error) {
	randomBytes := make([]byte, 8)
	if _, err := rand.Read(randomBytes); err != nil {
		return "", err
	}

	ext := strings.ToLower(strings.TrimPrefix(format, "."))
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
	return fmt.Sprintf("%s/temp/%d/%s_%s.%s", basePath, userID, time.Now().Format("2006-01-02"), hex.EncodeToString(randomBytes), ext), nil
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

func saveMultipartFileToTemp(file multipart.File, header *multipart.FileHeader) (string, string, func(), error) {
	if header == nil || header.Filename == "" {
		return "", "", nil, commonresponse.BadRequest("上传文件不能为空")
	}
	if !isAllowedMediaFilename(header.Filename) {
		return "", "", nil, commonresponse.BadRequest("仅支持 jpg、jpeg、png、webp 图片")
	}
	if header.Size > MaxFileUploadSize {
		return "", "", nil, commonresponse.BadRequest("图片大小不能超过 30MB")
	}

	tmpFile, err := os.CreateTemp("", "media-upload-*"+filepath.Ext(header.Filename))
	if err != nil {
		return "", "", nil, commonresponse.InternalServerError("创建临时文件失败")
	}

	cleanup := func() {
		_ = os.Remove(tmpFile.Name())
	}

	written, copyErr := io.Copy(tmpFile, io.LimitReader(file, MaxFileUploadSize+1))
	closeErr := tmpFile.Close()
	if copyErr != nil {
		cleanup()
		return "", "", nil, commonresponse.InternalServerError("写入临时文件失败")
	}
	if closeErr != nil {
		cleanup()
		return "", "", nil, commonresponse.InternalServerError("关闭临时文件失败")
	}
	if written > MaxFileUploadSize {
		cleanup()
		return "", "", nil, commonresponse.BadRequest("图片大小不能超过 30MB")
	}

	return tmpFile.Name(), header.Filename, cleanup, nil
}

func downloadRemoteImageToTemp(ctx context.Context, fileURL string) (string, string, func(), error) {
	parsedURL, err := url.Parse(fileURL)
	if err != nil || parsedURL.Scheme == "" || parsedURL.Host == "" {
		return "", "", nil, commonresponse.BadRequest("fileUrl 必须是合法 URL")
	}
	if parsedURL.Scheme != "http" && parsedURL.Scheme != "https" {
		return "", "", nil, commonresponse.BadRequest("fileUrl 仅支持 http 或 https")
	}

	client := &http.Client{Timeout: 30 * time.Second}
	getReq, _ := http.NewRequestWithContext(ctx, http.MethodGet, fileURL, nil)
	getResp, err := client.Do(getReq)
	if err != nil {
		return "", "", nil, commonresponse.BadRequest("下载远程图片失败")
	}
	defer getResp.Body.Close()

	if getResp.StatusCode != http.StatusOK {
		return "", "", nil, commonresponse.BadRequest("下载远程图片失败")
	}
	if contentType := strings.ToLower(getResp.Header.Get("Content-Type")); contentType != "" && !strings.HasPrefix(contentType, "image/") {
		return "", "", nil, commonresponse.BadRequest("远程文件不是图片")
	}

	originalFilename := deriveRemoteFilename(parsedURL)
	if !isAllowedMediaFilename(originalFilename) {
		originalFilename += ".jpg"
	}

	tmpFile, err := os.CreateTemp("", "media-url-*"+filepath.Ext(originalFilename))
	if err != nil {
		return "", "", nil, commonresponse.InternalServerError("创建临时文件失败")
	}

	cleanup := func() {
		_ = os.Remove(tmpFile.Name())
	}

	written, copyErr := io.Copy(tmpFile, io.LimitReader(getResp.Body, maxURLUploadSize+1))
	closeErr := tmpFile.Close()
	if copyErr != nil {
		cleanup()
		return "", "", nil, commonresponse.InternalServerError("保存远程图片失败")
	}
	if closeErr != nil {
		cleanup()
		return "", "", nil, commonresponse.InternalServerError("关闭临时文件失败")
	}
	if written > maxURLUploadSize {
		cleanup()
		return "", "", nil, commonresponse.BadRequest("URL 图片大小不能超过 10MB")
	}

	return tmpFile.Name(), originalFilename, cleanup, nil
}

func deriveRemoteFilename(parsedURL *url.URL) string {
	name := path.Base(parsedURL.Path)
	name, _ = url.PathUnescape(name)
	if name == "" || name == "." || name == "/" {
		return "remote-image.jpg"
	}
	return name
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

func extractMediaMetadata(filePath, originalFilename string) (mediaFileMetadata, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return mediaFileMetadata{}, commonresponse.InternalServerError("读取图片失败")
	}
	defer file.Close()

	info, err := file.Stat()
	if err != nil {
		return mediaFileMetadata{}, commonresponse.InternalServerError("读取图片信息失败")
	}

	header := make([]byte, 64)
	n, _ := file.Read(header)
	header = header[:n]

	format := detectMediaFormat(header, originalFilename)
	if format == "" {
		return mediaFileMetadata{}, commonresponse.BadRequest("仅支持 jpg、jpeg、png、webp 图片")
	}

	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return mediaFileMetadata{}, commonresponse.InternalServerError("读取图片失败")
	}

	metadata := mediaFileMetadata{
		Size:   info.Size(),
		Format: format,
	}

	switch format {
	case "jpg", "jpeg", "png":
		cfg, _, err := image.DecodeConfig(file)
		if err != nil {
			return mediaFileMetadata{}, commonresponse.BadRequest("无法解析图片尺寸")
		}
		metadata.Width = int64(cfg.Width)
		metadata.Height = int64(cfg.Height)
		if colorValue, err := extractDominantColor(filePath); err == nil {
			metadata.DominantColor = colorValue
			metadata.BlurHash = buildSolidBlurHash(colorValue)
		}
	case "webp":
		width, height, err := extractWebPDimensions(header)
		if err != nil {
			return mediaFileMetadata{}, commonresponse.BadRequest("无法解析 webp 图片尺寸")
		}
		metadata.Width = width
		metadata.Height = height
	}

	return metadata, nil
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

func extractDominantColor(filePath string) (string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	img, _, err := image.Decode(file)
	if err != nil {
		return "", err
	}

	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()
	if width == 0 || height == 0 {
		return "", errors.New("invalid image bounds")
	}

	stepX := maxInt(width/32, 1)
	stepY := maxInt(height/32, 1)

	var totalR, totalG, totalB, count uint64
	for y := bounds.Min.Y; y < bounds.Max.Y; y += stepY {
		for x := bounds.Min.X; x < bounds.Max.X; x += stepX {
			r, g, b, _ := img.At(x, y).RGBA()
			totalR += uint64(r >> 8)
			totalG += uint64(g >> 8)
			totalB += uint64(b >> 8)
			count++
		}
	}

	if count == 0 {
		return "", errors.New("empty color sample")
	}

	return fmt.Sprintf("#%02X%02X%02X", totalR/count, totalG/count, totalB/count), nil
}

func extractWebPDimensions(header []byte) (int64, int64, error) {
	if len(header) < 30 {
		return 0, 0, errors.New("webp header too short")
	}

	switch string(header[12:16]) {
	case "VP8 ":
		if header[23] != 0x9D || header[24] != 0x01 || header[25] != 0x2A {
			return 0, 0, errors.New("invalid vp8 header")
		}
		width := int64(binary.LittleEndian.Uint16(header[26:28]) & 0x3FFF)
		height := int64(binary.LittleEndian.Uint16(header[28:30]) & 0x3FFF)
		return width, height, nil
	case "VP8L":
		if header[20] != 0x2F {
			return 0, 0, errors.New("invalid vp8l header")
		}
		bits := binary.LittleEndian.Uint32(header[21:25])
		width := int64(bits&0x3FFF) + 1
		height := int64((bits>>14)&0x3FFF) + 1
		return width, height, nil
	case "VP8X":
		width := int64(uint32(header[24])|uint32(header[25])<<8|uint32(header[26])<<16) + 1
		height := int64(uint32(header[27])|uint32(header[28])<<8|uint32(header[29])<<16) + 1
		return width, height, nil
	default:
		return 0, 0, errors.New("unsupported webp chunk")
	}
}

func buildSolidBlurHash(hexColor string) string {
	hexColor = strings.TrimSpace(hexColor)
	hexColor = strings.TrimPrefix(hexColor, "#")
	if len(hexColor) != 6 {
		return ""
	}

	color, err := strconvParseHexColor(hexColor)
	if err != nil {
		return ""
	}

	return encodeBlurHashBase83(0, 1) + encodeBlurHashBase83(0, 1) + encodeBlurHashBase83(color, 4)
}

func strconvParseHexColor(hexColor string) (int, error) {
	value, err := strconv.ParseInt(hexColor, 16, 32)
	return int(value), err
}

const blurHashBase83Alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~"

func encodeBlurHashBase83(value, length int) string {
	if length <= 0 {
		return ""
	}

	result := make([]byte, length)
	for i := length - 1; i >= 0; i-- {
		digit := value % 83
		result[i] = blurHashBase83Alphabet[digit]
		value /= 83
	}
	return string(result)
}

func maxInt(left, right int) int {
	if left > right {
		return left
	}
	return right
}

func uploadFileToObjectStorage(ctx context.Context, target *storageTarget, localPath, objectKey, contentType string) error {
	if target == nil || target.Provider == nil {
		return commonresponse.InternalServerError("存储配置不存在")
	}
	if strings.ToLower(target.Provider.ProviderType) != "cos" {
		return commonresponse.InternalServerError("当前仅支持 COS 上传")
	}
	if !hasCompleteStorageConfig(target) {
		return commonresponse.InternalServerError("COS 配置不完整，请先配置本地密钥")
	}

	file, err := os.Open(localPath)
	if err != nil {
		return commonresponse.InternalServerError("读取上传文件失败")
	}
	defer file.Close()

	info, err := file.Stat()
	if err != nil {
		return commonresponse.InternalServerError("读取文件信息失败")
	}

	targetURL := buildObjectURL(target.UploadURL, objectKey)
	parsedURL, err := url.Parse(targetURL)
	if err != nil {
		return commonresponse.InternalServerError("生成 COS 地址失败")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPut, targetURL, file)
	if err != nil {
		return commonresponse.InternalServerError("创建 COS 请求失败")
	}
	req.ContentLength = info.Size()
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("Authorization", buildCOSAuthorization(target.Secret.SecretId, target.Secret.SecretKey, parsedURL, http.MethodPut))
	req.Host = parsedURL.Host

	resp, err := (&http.Client{Timeout: 60 * time.Second}).Do(req)
	if err != nil {
		logx.WithContext(ctx).Errorf("COS upload request failed: objectKey=%s url=%s size=%d err=%v", objectKey, targetURL, info.Size(), err)
		return commonresponse.InternalServerError("上传 COS 失败")
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		bodyText := strings.TrimSpace(string(body))
		logx.WithContext(ctx).Errorf("COS upload rejected: objectKey=%s url=%s status=%d requestId=%s response=%q", objectKey, targetURL, resp.StatusCode, resp.Header.Get("x-cos-request-id"), bodyText)
		return commonresponse.InternalServerError(fmt.Sprintf("COS 上传失败: %s", strings.TrimSpace(string(body))))
	}
	return nil
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

	resp, err := (&http.Client{Timeout: 30 * time.Second}).Do(req)
	if err != nil {
		logx.WithContext(ctx).Errorf("COS head request failed: objectKey=%s url=%s err=%v", objectKey, targetURL, err)
		return objectStorageMetadata{}, commonresponse.InternalServerError("校验 COS 对象失败")
	}
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

	resp, err := (&http.Client{Timeout: 30 * time.Second}).Do(req)
	if err != nil {
		logx.WithContext(ctx).Errorf("COS header read request failed: objectKey=%s url=%s err=%v", objectKey, targetURL, err)
		return nil, commonresponse.InternalServerError("校验 COS 对象内容失败")
	}
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

func buildStorageURI(provider *model.StorageProvider, bucket *model.StorageBucket, objectKey string) string {
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
