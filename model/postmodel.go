package model

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

const postRows = "`id`,`user_id`,`content`,`visibility`,`status`,`location`,`extra_json`,`is_pinned`,`pinned_at`,`created_at`,`updated_at`,`deleted_at`"

type (
	PostModel interface {
		Insert(ctx context.Context, data *Post) (sql.Result, error)
		FindOneActive(ctx context.Context, id uint64) (*Post, error)
		FindByUserBeforeID(ctx context.Context, userID uint64, includePrivate bool, beforeID, limit int64) ([]*Post, error)
		FindByUserBeforePinCursor(ctx context.Context, userID uint64, includePrivate bool, cursor PostPinCursor, limit int64) ([]*Post, error)
		SetPinned(ctx context.Context, id uint64, pinned bool, pinnedAt time.Time) error
		Update(ctx context.Context, data *Post) error
		SoftDelete(ctx context.Context, id uint64, deletedAt time.Time) error
	}

	PostPinCursor struct {
		ID       uint64
		IsPinned bool
		PinnedAt sql.NullTime
	}

	defaultPostModel struct {
		conn  sqlx.SqlConn
		table string
	}

	Post struct {
		Id         uint64         `db:"id"`
		UserId     uint64         `db:"user_id"`
		Content    sql.NullString `db:"content"`
		Visibility string         `db:"visibility"`
		Status     string         `db:"status"`
		Location   sql.NullString `db:"location"`
		ExtraJson  sql.NullString `db:"extra_json"`
		IsPinned   int64          `db:"is_pinned"`
		PinnedAt   sql.NullTime   `db:"pinned_at"`
		CreatedAt  time.Time      `db:"created_at"`
		UpdatedAt  time.Time      `db:"updated_at"`
		DeletedAt  sql.NullTime   `db:"deleted_at"`
	}
)

func NewPostModel(conn sqlx.SqlConn) PostModel {
	return &defaultPostModel{
		conn:  conn,
		table: "`post`",
	}
}

func (m *defaultPostModel) Insert(ctx context.Context, data *Post) (sql.Result, error) {
	query := fmt.Sprintf("insert into %s (`user_id`,`content`,`visibility`,`status`,`location`,`extra_json`,`is_pinned`,`pinned_at`,`deleted_at`) values (?, ?, ?, ?, ?, ?, ?, ?, ?)", m.table)
	return m.conn.ExecCtx(ctx, query, data.UserId, data.Content, data.Visibility, data.Status, data.Location, data.ExtraJson, data.IsPinned, data.PinnedAt, data.DeletedAt)
}

func (m *defaultPostModel) FindOneActive(ctx context.Context, id uint64) (*Post, error) {
	query := fmt.Sprintf("select %s from %s where `id` = ? and `status` <> 'deleted' and `deleted_at` is null limit 1", postRows, m.table)
	var resp Post
	err := m.conn.QueryRowCtx(ctx, &resp, query, id)
	switch err {
	case nil:
		return &resp, nil
	case sqlx.ErrNotFound:
		return nil, ErrNotFound
	default:
		return nil, err
	}
}

func (m *defaultPostModel) FindByUserBeforeID(ctx context.Context, userID uint64, includePrivate bool, beforeID, limit int64) ([]*Post, error) {
	return m.FindByUserBeforePinCursor(ctx, userID, includePrivate, PostPinCursor{ID: uint64(maxInt64(beforeID))}, limit)
}

func (m *defaultPostModel) FindByUserBeforePinCursor(ctx context.Context, userID uint64, includePrivate bool, cursor PostPinCursor, limit int64) ([]*Post, error) {
	if limit <= 0 {
		limit = 20
	}

	conditions := []string{"`user_id` = ?", "`status` <> 'deleted'", "`deleted_at` is null"}
	args := []any{userID}
	if !includePrivate {
		conditions = append(conditions, "`status` = 'active'", "`visibility` = 'public'")
	}
	if cursor.ID > 0 {
		if cursor.IsPinned && cursor.PinnedAt.Valid {
			conditions = append(conditions, "((`is_pinned` = 1 and (`pinned_at` < ? or (`pinned_at` = ? and `id` < ?))) or `is_pinned` = 0)")
			args = append(args, cursor.PinnedAt.Time, cursor.PinnedAt.Time, cursor.ID)
		} else {
			conditions = append(conditions, "`is_pinned` = 0", "`id` < ?")
			args = append(args, cursor.ID)
		}
	}

	query := fmt.Sprintf(
		"select %s from %s where %s order by `is_pinned` desc, `pinned_at` desc, `id` desc limit ?",
		postRows,
		m.table,
		strings.Join(conditions, " and "),
	)
	args = append(args, limit)

	var resp []*Post
	if err := m.conn.QueryRowsCtx(ctx, &resp, query, args...); err != nil {
		return nil, err
	}
	return resp, nil
}

func (m *defaultPostModel) Update(ctx context.Context, data *Post) error {
	query := fmt.Sprintf("update %s set `user_id` = ?, `content` = ?, `visibility` = ?, `status` = ?, `location` = ?, `extra_json` = ?, `is_pinned` = ?, `pinned_at` = ?, `deleted_at` = ? where `id` = ?", m.table)
	_, err := m.conn.ExecCtx(ctx, query, data.UserId, data.Content, data.Visibility, data.Status, data.Location, data.ExtraJson, data.IsPinned, data.PinnedAt, data.DeletedAt, data.Id)
	return err
}

func (m *defaultPostModel) SetPinned(ctx context.Context, id uint64, pinned bool, pinnedAt time.Time) error {
	isPinned := int64(0)
	pinnedAtValue := sql.NullTime{}
	if pinned {
		isPinned = 1
		pinnedAtValue = sql.NullTime{Time: pinnedAt, Valid: !pinnedAt.IsZero()}
	}

	query := fmt.Sprintf("update %s set `is_pinned` = ?, `pinned_at` = ? where `id` = ? and `status` <> 'deleted' and `deleted_at` is null", m.table)
	_, err := m.conn.ExecCtx(ctx, query, isPinned, pinnedAtValue, id)
	return err
}

func (m *defaultPostModel) SoftDelete(ctx context.Context, id uint64, deletedAt time.Time) error {
	query := fmt.Sprintf("update %s set `status` = 'deleted', `is_pinned` = 0, `pinned_at` = null, `deleted_at` = ? where `id` = ? and `status` <> 'deleted' and `deleted_at` is null", m.table)
	_, err := m.conn.ExecCtx(ctx, query, sql.NullTime{Time: deletedAt, Valid: !deletedAt.IsZero()}, id)
	return err
}

func maxInt64(value int64) int64 {
	if value < 0 {
		return 0
	}
	return value
}
