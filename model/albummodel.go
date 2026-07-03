package model

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

const albumRows = "`id`,`user_id`,`name`,`description`,`cover_asset_id`,`visibility`,`status`,`sort_order`,`created_at`,`updated_at`,`deleted_at`"

type (
	AlbumModel interface {
		CountByUser(ctx context.Context, userID uint64, includePrivate bool) (int64, error)
		FindByUser(ctx context.Context, userID uint64, includePrivate bool, limit, offset int64) ([]*Album, error)
	}

	defaultAlbumModel struct {
		conn  sqlx.SqlConn
		table string
	}

	Album struct {
		Id           uint64         `db:"id"`
		UserId       uint64         `db:"user_id"`
		Name         string         `db:"name"`
		Description  sql.NullString `db:"description"`
		CoverAssetId sql.NullInt64  `db:"cover_asset_id"`
		Visibility   string         `db:"visibility"`
		Status       string         `db:"status"`
		SortOrder    int64          `db:"sort_order"`
		CreatedAt    time.Time      `db:"created_at"`
		UpdatedAt    time.Time      `db:"updated_at"`
		DeletedAt    sql.NullTime   `db:"deleted_at"`
	}
)

func NewAlbumModel(conn sqlx.SqlConn) AlbumModel {
	return &defaultAlbumModel{
		conn:  conn,
		table: "`album`",
	}
}

func albumVisibilityWhere(includePrivate bool) string {
	conditions := []string{"`status` <> 'deleted'", "`deleted_at` is null"}
	if !includePrivate {
		conditions = append(conditions, "`status` = 'active'", "`visibility` = 'public'")
	}
	return strings.Join(conditions, " and ")
}

func (m *defaultAlbumModel) CountByUser(ctx context.Context, userID uint64, includePrivate bool) (int64, error) {
	query := fmt.Sprintf("select count(1) from %s where `user_id` = ? and %s", m.table, albumVisibilityWhere(includePrivate))
	var resp int64
	if err := m.conn.QueryRowCtx(ctx, &resp, query, userID); err != nil {
		return 0, err
	}
	return resp, nil
}

func (m *defaultAlbumModel) FindByUser(ctx context.Context, userID uint64, includePrivate bool, limit, offset int64) ([]*Album, error) {
	if limit <= 0 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	query := fmt.Sprintf(
		"select %s from %s where `user_id` = ? and %s order by `sort_order` asc, `id` desc limit ? offset ?",
		albumRows,
		m.table,
		albumVisibilityWhere(includePrivate),
	)
	var resp []*Album
	if err := m.conn.QueryRowsCtx(ctx, &resp, query, userID, limit, offset); err != nil {
		return nil, err
	}
	return resp, nil
}
