package svc

import (
	accountmodel "discover_world/model/account"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

type AccountModels struct {
	UserAccount accountmodel.UserAccountModel
}

func newAccountModels(conn sqlx.SqlConn) AccountModels {
	return AccountModels{UserAccount: accountmodel.NewUserAccountModel(conn)}
}
