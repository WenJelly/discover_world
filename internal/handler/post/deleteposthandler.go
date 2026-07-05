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

func DeletePostHandler(svcCtx *svc.ServiceContext) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req types.DeletePostRequest
		if err := httpx.Parse(r, &req); err != nil {
			httpx.ErrorCtx(r.Context(), w, err)
			return
		}

		l := postlogic.NewDeletePostLogic(r.Context(), svcCtx)
		err := l.DeletePost(&req)
		if err != nil {
			httpx.ErrorCtx(r.Context(), w, err)
		} else {
			httpx.Ok(w)
		}
	}
}
