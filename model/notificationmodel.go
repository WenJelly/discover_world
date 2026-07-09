package model

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

const notificationRows = "`id`,`recipient_user_id`,`actor_user_id`,`event_type`,`target_type`,`target_id`,`title`,`content`,`metadata_json`,`read_at`,`created_at`,`updated_at`"

type (
	NotificationModel interface {
		Insert(ctx context.Context, data *Notification) (sql.Result, error)
		FindByRecipientBeforeID(ctx context.Context, recipientUserID uint64, beforeID uint64, limit int64) ([]*Notification, error)
		CountUnread(ctx context.Context, recipientUserID uint64) (int64, error)
		MarkRead(ctx context.Context, recipientUserID uint64, id uint64) error
		MarkAllRead(ctx context.Context, recipientUserID uint64) error
		withSession(session sqlx.Session) NotificationModel
	}

	defaultNotificationModel struct {
		conn  sqlx.SqlConn
		table string
	}

	Notification struct {
		Id              uint64         `db:"id"`
		RecipientUserId uint64         `db:"recipient_user_id"`
		ActorUserId     sql.NullInt64  `db:"actor_user_id"`
		EventType       string         `db:"event_type"`
		TargetType      string         `db:"target_type"`
		TargetId        uint64         `db:"target_id"`
		Title           string         `db:"title"`
		Content         sql.NullString `db:"content"`
		MetadataJson    sql.NullString `db:"metadata_json"`
		ReadAt          sql.NullTime   `db:"read_at"`
		CreatedAt       time.Time      `db:"created_at"`
		UpdatedAt       time.Time      `db:"updated_at"`
	}
)

func NewNotificationModel(conn sqlx.SqlConn) NotificationModel {
	return &defaultNotificationModel{
		conn:  conn,
		table: "`notification`",
	}
}

func (m *defaultNotificationModel) withSession(session sqlx.Session) NotificationModel {
	return NewNotificationModel(sqlx.NewSqlConnFromSession(session))
}

func (m *defaultNotificationModel) Insert(ctx context.Context, data *Notification) (sql.Result, error) {
	query := fmt.Sprintf("insert into %s (`recipient_user_id`,`actor_user_id`,`event_type`,`target_type`,`target_id`,`title`,`content`,`metadata_json`,`read_at`) values (?, ?, ?, ?, ?, ?, ?, ?, ?)", m.table)
	return m.conn.ExecCtx(ctx, query, data.RecipientUserId, data.ActorUserId, data.EventType, data.TargetType, data.TargetId, data.Title, data.Content, data.MetadataJson, data.ReadAt)
}

func (m *defaultNotificationModel) FindByRecipientBeforeID(ctx context.Context, recipientUserID uint64, beforeID uint64, limit int64) ([]*Notification, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	conditions := []string{"`recipient_user_id` = ?"}
	args := []any{recipientUserID}
	if beforeID > 0 {
		conditions = append(conditions, "`id` < ?")
		args = append(args, beforeID)
	}
	query := fmt.Sprintf("select %s from %s where %s order by `id` desc limit ?", notificationRows, m.table, strings.Join(conditions, " and "))
	args = append(args, limit)

	var resp []*Notification
	if err := m.conn.QueryRowsCtx(ctx, &resp, query, args...); err != nil {
		return nil, err
	}
	return resp, nil
}

func (m *defaultNotificationModel) CountUnread(ctx context.Context, recipientUserID uint64) (int64, error) {
	query := fmt.Sprintf("select count(1) from %s where `recipient_user_id` = ? and `read_at` is null", m.table)
	var resp int64
	if err := m.conn.QueryRowCtx(ctx, &resp, query, recipientUserID); err != nil {
		return 0, err
	}
	return resp, nil
}

func (m *defaultNotificationModel) MarkRead(ctx context.Context, recipientUserID uint64, id uint64) error {
	query := fmt.Sprintf("update %s set `read_at` = coalesce(`read_at`, now()) where `recipient_user_id` = ? and `id` = ?", m.table)
	_, err := m.conn.ExecCtx(ctx, query, recipientUserID, id)
	return err
}

func (m *defaultNotificationModel) MarkAllRead(ctx context.Context, recipientUserID uint64) error {
	query := fmt.Sprintf("update %s set `read_at` = coalesce(`read_at`, now()) where `recipient_user_id` = ? and `read_at` is null", m.table)
	_, err := m.conn.ExecCtx(ctx, query, recipientUserID)
	return err
}
