// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package post

import (
	"net/http"

	postlogic "discover_world/internal/logic/post"
	"discover_world/internal/svc"
	"discover_world/internal/types"

	"github.com/zeromicro/go-zero/rest/httpx"
)

func PinPostHandler(svcCtx *svc.ServiceContext) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req types.PinPostRequest
		if err := httpx.Parse(r, &req); err != nil {
			httpx.ErrorCtx(r.Context(), w, err)
			return
		}

		l := postlogic.NewPinPostLogic(r.Context(), svcCtx)
		resp, err := l.PinPost(&req)
		if err != nil {
			httpx.ErrorCtx(r.Context(), w, err)
		} else {
			httpx.OkJsonCtx(r.Context(), w, resp)
		}
	}
}
