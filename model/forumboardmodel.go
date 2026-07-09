package model

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

const forumBoardRows = "`id`,`slug`,`name`,`description`,`status`,`sort_order`,`created_at`,`updated_at`,`deleted_at`"

type (
	ForumBoardModel interface {
		FindActive(ctx context.Context, limit int64) ([]*ForumBoard, error)
		FindOneActiveByID(ctx context.Context, id uint64) (*ForumBoard, error)
	}

	defaultForumBoardModel struct {
		conn  sqlx.SqlConn
		table string
	}

	ForumBoard struct {
		Id          uint64         `db:"id"`
		Slug        string         `db:"slug"`
		Name        string         `db:"name"`
		Description sql.NullString `db:"description"`
		Status      string         `db:"status"`
		SortOrder   int64          `db:"sort_order"`
		CreatedAt   time.Time      `db:"created_at"`
		UpdatedAt   time.Time      `db:"updated_at"`
		DeletedAt   sql.NullTime   `db:"deleted_at"`
	}
)

func NewForumBoardModel(conn sqlx.SqlConn) ForumBoardModel {
	return &defaultForumBoardModel{
		conn:  conn,
		table: "`forum_board`",
	}
}

func (m *defaultForumBoardModel) FindActive(ctx context.Context, limit int64) ([]*ForumBoard, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}

	query := fmt.Sprintf("select %s from %s where `status` = 'active' and `deleted_at` is null order by `sort_order` asc, `id` asc limit ?", forumBoardRows, m.table)
	var resp []*ForumBoard
	if err := m.conn.QueryRowsCtx(ctx, &resp, query, limit); err != nil {
		return nil, err
	}
	return resp, nil
}

func (m *defaultForumBoardModel) FindOneActiveByID(ctx context.Context, id uint64) (*ForumBoard, error) {
	query := fmt.Sprintf("select %s from %s where `id` = ? and `status` = 'active' and `deleted_at` is null limit 1", forumBoardRows, m.table)
	var resp ForumBoard
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
