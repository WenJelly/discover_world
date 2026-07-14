package svc

import (
	notificationmodel "discover_world/model/notification"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

type NotificationModels struct {
	Notification notificationmodel.NotificationModel
}

func newNotificationModels(conn sqlx.SqlConn) NotificationModels {
	return NotificationModels{Notification: notificationmodel.NewNotificationModel(conn)}
}
