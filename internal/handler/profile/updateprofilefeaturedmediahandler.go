// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package profile

import (
	"net/http"

	"discover_world/internal/logic/profile"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"github.com/zeromicro/go-zero/rest/httpx"
)

func UpdateProfileFeaturedMediaHandler(svcCtx *svc.ServiceContext) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req types.UpdateProfileFeaturedMediaRequest
		if err := httpx.Parse(r, &req); err != nil {
			httpx.ErrorCtx(r.Context(), w, err)
			return
		}

		l := profile.NewUpdateProfileFeaturedMediaLogic(r.Context(), svcCtx)
		resp, err := l.UpdateProfileFeaturedMedia(&req)
		if err != nil {
			httpx.ErrorCtx(r.Context(), w, err)
		} else {
			httpx.OkJsonCtx(r.Context(), w, resp)
		}
	}
}
