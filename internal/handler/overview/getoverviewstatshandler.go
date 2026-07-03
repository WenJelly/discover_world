// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package overview

import (
	"net/http"

	"discover_world/internal/logic/overview"
	"discover_world/internal/svc"
	"github.com/zeromicro/go-zero/rest/httpx"
)

func GetOverviewStatsHandler(svcCtx *svc.ServiceContext) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		l := overview.NewGetOverviewStatsLogic(r.Context(), svcCtx)
		resp, err := l.GetOverviewStats()
		if err != nil {
			httpx.ErrorCtx(r.Context(), w, err)
		} else {
			httpx.OkJsonCtx(r.Context(), w, resp)
		}
	}
}
