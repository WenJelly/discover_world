package svc

import (
	adminmodel "discover_world/model/admin"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

type AdminModels struct {
	AdminOperationLog adminmodel.AdminOperationLogModel
	AdminRolePolicy   adminmodel.AdminRolePolicyModel
}

func newAdminModels(conn sqlx.SqlConn) AdminModels {
	return AdminModels{
		AdminOperationLog: adminmodel.NewAdminOperationLogModel(conn),
		AdminRolePolicy:   adminmodel.NewAdminRolePolicyModel(conn),
	}
}
