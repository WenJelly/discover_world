// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package media

import (
	"net/http"
	"strconv"
	"strings"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/logic/media"
	"discover_world/internal/svc"
	"github.com/zeromicro/go-zero/rest/httpx"
)

func UploadMediaAssetHandler(svcCtx *svc.ServiceContext) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseMultipartForm(media.MaxMultipartMemory); err != nil {
			httpx.ErrorCtx(r.Context(), w, commonresponse.BadRequest("上传表单无效"))
			return
		}

		file, header, err := r.FormFile("file")
		if err != nil {
			httpx.ErrorCtx(r.Context(), w, commonresponse.BadRequest("上传文件不能为空"))
			return
		}
		defer file.Close()

		var id uint64
		if raw := strings.TrimSpace(r.FormValue("id")); raw != "" {
			parsed, err := strconv.ParseUint(raw, 10, 64)
			if err != nil || parsed == 0 {
				httpx.ErrorCtx(r.Context(), w, commonresponse.BadRequest("id 必须是正整数"))
				return
			}
			id = parsed
		}

		tags, err := media.ParseTagsInput(r.FormValue("tags"))
		if err != nil {
			httpx.ErrorCtx(r.Context(), w, commonresponse.BadRequest("tags 格式无效"))
			return
		}

		l := media.NewUploadMediaAssetLogic(r.Context(), svcCtx)
		resp, err := l.UploadMediaAsset(file, header, media.MediaWriteRequest{
			ID:          id,
			Title:       r.FormValue("title"),
			Description: r.FormValue("description"),
			Category:    r.FormValue("category"),
			Tags:        tags,
			Visibility:  r.FormValue("visibility"),
			UsageType:   "media",
			AssetUsage:  r.FormValue("assetUsage"),
		}, r.Header.Get("Authorization"))
		if err != nil {
			httpx.ErrorCtx(r.Context(), w, err)
		} else {
			httpx.OkJsonCtx(r.Context(), w, resp)
		}
	}
}
