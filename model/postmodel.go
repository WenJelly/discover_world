package model

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

const postRows = "`id`,`user_id`,`content`,`visibility`,`status`,`location`,`extra_json`,`created_at`,`updated_at`,`deleted_at`"

type (
	PostModel interface {
		FindByUserBeforeID(ctx context.Context, userID uint64, includePrivate bool, beforeID, limit int64) ([]*Post, error)
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

func (m *defaultPostModel) FindByUserBeforeID(ctx context.Context, userID uint64, includePrivate bool, beforeID, limit int64) ([]*Post, error) {
	if limit <= 0 {
		limit = 20
	}

	conditions := []string{"`user_id` = ?", "`status` <> 'deleted'", "`deleted_at` is null"}
	args := []any{userID}
	if !includePrivate {
		conditions = append(conditions, "`status` = 'active'", "`visibility` = 'public'")
	}
	if beforeID > 0 {
		conditions = append(conditions, "`id` < ?")
		args = append(args, uint64(beforeID))
	}

	query := fmt.Sprintf(
		"select %s from %s where %s order by `id` desc limit ?",
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
