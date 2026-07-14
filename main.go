// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package main

import (
	"context"
	"flag"
	"fmt"
	"log"

	"discover_world/internal/common/clientip"
	"discover_world/internal/common/response"
	"discover_world/internal/config"
	"discover_world/internal/handler"
	"discover_world/internal/ranking"
	"discover_world/internal/svc"

	"github.com/zeromicro/go-zero/core/logx"
	"github.com/zeromicro/go-zero/rest"
	"github.com/zeromicro/go-zero/rest/httpx"
)

var configFile = flag.String("f", config.DefaultConfigPath, "the config file")

func main() {
	flag.Parse()

	c, err := config.Load(*configFile)
	if err != nil {
		log.Fatalf("error: config file %s, %s", *configFile, err.Error())
	}

	httpx.SetErrorHandler(func(err error) (int, interface{}) {
		statusCode, body := response.ErrorBody(err)
		if statusCode >= 500 {
			logx.Errorw("http request failed",
				logx.Field("statusCode", statusCode),
				logx.Field("error", err),
			)
		}
		return statusCode, body
	})

	server := rest.MustNewServer(c.RestConf, rest.WithCors())
	defer server.Stop()
	server.Use(clientip.Middleware(c.IpGeo.TrustedProxies))

	ctx := svc.NewServiceContext(c)
	defer ctx.Close()
	cancelRankingRefresh, rankingRefreshDone := ranking.StartMediaRankingRefresher(
		context.Background(),
		ctx.EntityRankingModel,
		c.Ranking.RefreshIntervalSeconds,
		c.Ranking.BatchSize,
	)
	defer func() {
		cancelRankingRefresh()
		<-rankingRefreshDone
	}()
	handler.RegisterHandlers(server, ctx)

	fmt.Printf("Starting server at %s:%d...\n", c.Host, c.Port)
	server.Start()
}
