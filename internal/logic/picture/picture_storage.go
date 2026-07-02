package picture

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	commonresponse "photo-album/internal/common/response"
	"strings"
	"time"

	"photo-album/internal/svc"
	"photo-album/internal/types"
)

func buildPictureThumbnailURL(baseURL string, size int64, option types.CompressPictureType) (string, error) {
	switch option.CompressType {
	case 0:
		return baseURL, nil
	case 1:
		return buildCurrentCompressedPictureURL(baseURL, size), nil
	case 2:
		return buildStrongCompressedPictureURL(baseURL), nil
	case 3:
		return buildCenteredCropPictureURL(baseURL, option.CutWidth, option.CutHeight)
	default:
		return "", commonresponse.BadRequest("compressType 只能是 0、1、2、3")
	}
}

func buildCurrentCompressedPictureURL(baseURL string, size int64) string {
	if size > compressedImageThreshold {
		return buildCompressedThumbnailURL(baseURL, size)
	}

	return baseURL
}

func buildCompressedThumbnailURL(baseURL string, size int64) string {
	maxEdge, quality := compressedThumbnailProfile(size)
	return fmt.Sprintf(
		"%s?imageMogr2/thumbnail/%dx%d>/format/webp/quality/%d!/minsize/1/ignore-error/1",
		baseURL,
		maxEdge,
		maxEdge,
		quality,
	)
}

func buildStrongCompressedPictureURL(baseURL string) string {
	return fmt.Sprintf(
		"%s?imageMogr2/thumbnail/1200x1200>/format/webp/quality/70!/minsize/1/ignore-error/1",
		baseURL,
	)
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

func buildCenteredCropPictureURL(baseURL string, width, height int64) (string, error) {
	if width <= 0 || height <= 0 {
		return "", commonresponse.BadRequest("compressType=3 时 cutWidth 和 CutHeight 必须为正整数")
	}

	return fmt.Sprintf(
		"%s?imageMogr2/thumbnail/%dx%d^>/gravity/center/crop/%dx%d/format/webp/ignore-error/1",
		baseURL,
		width,
		height,
		width,
		height,
	), nil
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

func buildPictureObjectKey(userID int64, format string) (string, error) {
	randomBytes := make([]byte, 8)
	if _, err := rand.Read(randomBytes); err != nil {
		return "", err
	}

	ext := format
	if ext == "jpeg" {
		ext = "jpg"
	}
	if ext == "" {
		ext = "jpg"
	}

	return fmt.Sprintf("public/%d/%s_%s.%s", userID, time.Now().Format("2006-01-02"), hex.EncodeToString(randomBytes), ext), nil
}

func contentTypeForFormat(format string) string {
	switch format {
	case "jpg", "jpeg":
		return "image/jpeg"
	case "png":
		return "image/png"
	case "webp":
		return "image/webp"
	default:
		return "application/octet-stream"
	}
}

func uploadFileToCOS(ctx context.Context, svcCtx *svc.ServiceContext, localPath, objectKey, contentType string) error {
	if !hasCompleteCOSConfig(svcCtx) {
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

	targetURL := buildObjectURL(svcCtx.Config.Cos.Host, objectKey)
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
	req.Header.Set("Authorization", buildCOSAuthorization(svcCtx.Config.Cos.SecretId, svcCtx.Config.Cos.SecretKey, parsedURL, http.MethodPut))
	req.Host = parsedURL.Host

	resp, err := (&http.Client{Timeout: 60 * time.Second}).Do(req)
	if err != nil {
		return commonresponse.InternalServerError("上传 COS 失败")
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return commonresponse.InternalServerError(fmt.Sprintf("COS 上传失败: %s", strings.TrimSpace(string(body))))
	}

	return nil
}

func deleteFileFromCOS(ctx context.Context, svcCtx *svc.ServiceContext, objectKey string) error {
	if !hasCompleteCOSConfig(svcCtx) {
		return nil
	}

	targetURL := buildObjectURL(svcCtx.Config.Cos.Host, objectKey)
	parsedURL, err := url.Parse(targetURL)
	if err != nil {
		return commonresponse.InternalServerError("生成 COS 地址失败")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, targetURL, nil)
	if err != nil {
		return commonresponse.InternalServerError("创建 COS 删除请求失败")
	}
	req.Header.Set("Authorization", buildCOSAuthorization(svcCtx.Config.Cos.SecretId, svcCtx.Config.Cos.SecretKey, parsedURL, http.MethodDelete))
	req.Host = parsedURL.Host

	resp, err := (&http.Client{Timeout: 30 * time.Second}).Do(req)
	if err != nil {
		return commonresponse.InternalServerError("删除 COS 文件失败")
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil
	}
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return commonresponse.InternalServerError(fmt.Sprintf("COS 删除失败: %s", strings.TrimSpace(string(body))))
	}

	return nil
}

func hasCompleteCOSConfig(svcCtx *svc.ServiceContext) bool {
	return strings.TrimSpace(svcCtx.Config.Cos.Host) != "" &&
		strings.TrimSpace(svcCtx.Config.Cos.SecretId) != "" &&
		strings.TrimSpace(svcCtx.Config.Cos.SecretKey) != "" &&
		!strings.Contains(svcCtx.Config.Cos.SecretId, "[REDACTED") &&
		!strings.Contains(svcCtx.Config.Cos.SecretKey, "[REDACTED")
}

func extractObjectKeyFromURL(host, fileURL string) (string, bool) {
	host = strings.TrimSpace(host)
	fileURL = strings.TrimSpace(fileURL)
	if host == "" || fileURL == "" {
		return "", false
	}

	hostURL, err := url.Parse(strings.TrimRight(host, "/"))
	if err != nil || hostURL.Scheme == "" || hostURL.Host == "" {
		return "", false
	}

	parsedFileURL, err := url.Parse(fileURL)
	if err != nil || parsedFileURL.Scheme == "" || parsedFileURL.Host == "" {
		return "", false
	}

	if !strings.EqualFold(hostURL.Scheme, parsedFileURL.Scheme) || !strings.EqualFold(hostURL.Host, parsedFileURL.Host) {
		return "", false
	}

	basePath := strings.TrimSuffix(hostURL.EscapedPath(), "/")
	objectPath := parsedFileURL.EscapedPath()
	if basePath != "" {
		if objectPath == basePath || !strings.HasPrefix(objectPath, basePath+"/") {
			return "", false
		}
		objectPath = strings.TrimPrefix(objectPath, basePath+"/")
	} else {
		objectPath = strings.TrimPrefix(objectPath, "/")
	}

	if objectPath == "" {
		return "", false
	}

	parts := strings.Split(objectPath, "/")
	for i, part := range parts {
		unescaped, err := url.PathUnescape(part)
		if err != nil {
			return "", false
		}
		parts[i] = unescaped
	}

	return strings.Join(parts, "/"), true
}

func buildCOSAuthorization(secretID, secretKey string, parsedURL *url.URL, method string) string {
	signTime := fmt.Sprintf("%d;%d", time.Now().Unix()-60, time.Now().Add(10*time.Minute).Unix())
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
