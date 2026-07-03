// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package account

import (
	"net/http"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/logic/account"
	"discover_world/internal/svc"
	"github.com/zeromicro/go-zero/rest/httpx"
)

func UploadAccountAvatarHandler(svcCtx *svc.ServiceContext) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseMultipartForm(32 << 20); err != nil {
			httpx.ErrorCtx(r.Context(), w, commonresponse.BadRequest("上传表单无效"))
			return
		}

		file, header, err := r.FormFile("file")
		if err != nil {
			httpx.ErrorCtx(r.Context(), w, commonresponse.BadRequest("上传文件不能为空"))
			return
		}
		defer file.Close()

		l := account.NewSetAccountAvatarLogic(r.Context(), svcCtx)
		resp, err := l.SetAccountAvatar(file, header, r.Header.Get("Authorization"))
		if err != nil {
			httpx.ErrorCtx(r.Context(), w, err)
		} else {
			httpx.OkJsonCtx(r.Context(), w, resp)
		}
	}
}
