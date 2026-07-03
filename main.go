// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package main

import (
	"flag"
	"fmt"
	"log"

	"discover_world/internal/common/response"
	"discover_world/internal/config"
	"discover_world/internal/handler"
	"discover_world/internal/svc"

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
		return statusCode, body
	})

	server := rest.MustNewServer(c.RestConf, rest.WithCors())
	defer server.Stop()

	ctx := svc.NewServiceContext(c)
	handler.RegisterHandlers(server, ctx)

	fmt.Printf("Starting server at %s:%d...\n", c.Host, c.Port)
	server.Start()
}
