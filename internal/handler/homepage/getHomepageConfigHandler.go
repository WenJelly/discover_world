// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package homepage

import (
	"net/http"

	"discover_world/internal/logic/homepage"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"github.com/zeromicro/go-zero/rest/httpx"
)

func GetHomepageConfigHandler(svcCtx *svc.ServiceContext) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req types.GetHomepageConfigRequest
		if err := httpx.Parse(r, &req); err != nil {
			httpx.ErrorCtx(r.Context(), w, err)
			return
		}

		l := homepage.NewGetHomepageConfigLogic(r.Context(), svcCtx)
		resp, err := l.GetHomepageConfig(&req)
		if err != nil {
			httpx.ErrorCtx(r.Context(), w, err)
		} else {
			httpx.OkJsonCtx(r.Context(), w, resp)
		}
	}
}
