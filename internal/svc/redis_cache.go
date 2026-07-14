package svc

import (
	"context"
	"strconv"
)

func NotificationUnreadCacheKey(userID uint64) string {
	return "cache:notification:unread:" + strconv.FormatUint(userID, 10)
}

func (s *ServiceContext) InvalidateNotificationUnread(ctx context.Context, userID uint64) error {
	if s == nil || s.Redis == nil || userID == 0 {
		return nil
	}
	return s.Redis.Delete(ctx, NotificationUnreadCacheKey(userID))
}

func (s *ServiceContext) InvalidateHomepageCache(ctx context.Context) error {
	if s == nil || s.Redis == nil {
		return nil
	}
	_, err := s.Redis.BumpVersion(ctx, "homepage")
	return err
}
