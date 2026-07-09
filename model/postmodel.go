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
const postRowsWithDefaultScore = postRows + ",0 as score"

type (
	PostModel interface {
		Insert(ctx context.Context, data *Post) (sql.Result, error)
		FindOneActive(ctx context.Context, id uint64) (*Post, error)
		FindByIDs(ctx context.Context, ids []uint64) (map[uint64]*Post, error)
		FindPublicBeforeCursor(ctx context.Context, cursor PublicPostCursor, sort string, searchText string, limit int64) ([]*Post, error)
		FindPublicByAuthorsBeforeCursor(ctx context.Context, authorIDs []uint64, beforeID uint64, limit int64) ([]*Post, error)
		FindByUserBeforeID(ctx context.Context, userID uint64, includePrivate bool, beforeID, limit int64) ([]*Post, error)
		FindByUserBeforePinCursor(ctx context.Context, userID uint64, includePrivate bool, cursor PostPinCursor, limit int64) ([]*Post, error)
		SetPinned(ctx context.Context, id uint64, pinned bool, pinnedAt time.Time) error
		SetStatus(ctx context.Context, id uint64, status string) error
		Update(ctx context.Context, data *Post) error
		SoftDelete(ctx context.Context, id uint64, deletedAt time.Time) error
	}

	PublicPostCursor struct {
		ID    uint64
		Score float64
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
		Score      float64        `db:"score"`
	}
)

func NewPostModel(conn sqlx.SqlConn) PostModel {
	return &defaultPostModel{
		conn:  conn,
		table: "`post`",
	}
}

func qualifiedPostRowsWithDefaultScore(alias string) string {
	return qualifiedRows(postRows, alias) + ",0 as score"
}

func (m *defaultPostModel) Insert(ctx context.Context, data *Post) (sql.Result, error) {
	query := fmt.Sprintf("insert into %s (`user_id`,`content`,`visibility`,`status`,`location`,`extra_json`,`is_pinned`,`pinned_at`,`deleted_at`) values (?, ?, ?, ?, ?, ?, ?, ?, ?)", m.table)
	return m.conn.ExecCtx(ctx, query, data.UserId, data.Content, data.Visibility, data.Status, data.Location, data.ExtraJson, data.IsPinned, data.PinnedAt, data.DeletedAt)
}

func (m *defaultPostModel) FindOneActive(ctx context.Context, id uint64) (*Post, error) {
	query := fmt.Sprintf("select %s from %s where `id` = ? and `status` <> 'deleted' and `deleted_at` is null limit 1", postRowsWithDefaultScore, m.table)
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

func (m *defaultPostModel) FindByIDs(ctx context.Context, ids []uint64) (map[uint64]*Post, error) {
	resp := make(map[uint64]*Post)
	ids = uniquePositiveIDs(ids)
	if len(ids) == 0 {
		return resp, nil
	}

	args := make([]any, 0, len(ids))
	for _, id := range ids {
		args = append(args, id)
	}
	query := fmt.Sprintf("select %s from %s where `id` in (%s) and `status` <> 'deleted' and `deleted_at` is null", postRowsWithDefaultScore, m.table, inPlaceholders(len(ids)))
	var rows []*Post
	if err := m.conn.QueryRowsCtx(ctx, &rows, query, args...); err != nil {
		return nil, err
	}
	for _, row := range rows {
		if row != nil {
			resp[row.Id] = row
		}
	}
	return resp, nil
}

func (m *defaultPostModel) FindPublicBeforeCursor(ctx context.Context, cursor PublicPostCursor, sort string, searchText string, limit int64) ([]*Post, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	sort = strings.ToLower(strings.TrimSpace(sort))
	scoreExpr := "0"
	orderExpr := "p.`id`"
	if sort == "hot" {
		scoreExpr = postHotScoreSQL()
		orderExpr = "score"
	} else if sort == "rising" {
		scoreExpr = postRisingScoreSQL()
		orderExpr = "score"
	}

	conditions := []string{
		"p.`status` = 'active'",
		"p.`visibility` = 'public'",
		"p.`deleted_at` is null",
		"ua.`status` = 'active'",
		"ua.`deleted_at` is null",
	}
	args := []any{}
	searchText = strings.TrimSpace(searchText)
	if searchText != "" {
		conditions = append(conditions, "(p.`content` like ? or p.`location` like ? or ua.`username` like ?)")
		like := "%" + searchText + "%"
		args = append(args, like, like, like)
	}
	if cursor.ID > 0 {
		if orderExpr == "score" {
			conditions = append(conditions, fmt.Sprintf("((%s) < ? or ((%s) = ? and p.`id` < ?))", scoreExpr, scoreExpr))
			args = append(args, cursor.Score, cursor.Score, cursor.ID)
		} else {
			conditions = append(conditions, "p.`id` < ?")
			args = append(args, cursor.ID)
		}
	}

	orderBy := "p.`id` desc"
	if orderExpr == "score" {
		orderBy = "score desc, p.`id` desc"
	}

	query := fmt.Sprintf(`
select %s, %s as score
from `+"`post`"+` p
join `+"`user_account`"+` ua on ua.`+"`id`"+` = p.`+"`user_id`"+`
left join `+"`entity_stat`"+` es on es.`+"`target_type`"+` = 'post' and es.`+"`target_id`"+` = p.`+"`id`"+`
where %s
order by %s
limit ?`, qualifiedRows(postRows, "p"), scoreExpr, strings.Join(conditions, " and "), orderBy)
	args = append(args, limit)

	var resp []*Post
	if err := m.conn.QueryRowsCtx(ctx, &resp, query, args...); err != nil {
		return nil, err
	}
	return resp, nil
}

func (m *defaultPostModel) FindPublicByAuthorsBeforeCursor(ctx context.Context, authorIDs []uint64, beforeID uint64, limit int64) ([]*Post, error) {
	authorIDs = uniquePositiveIDs(authorIDs)
	if len(authorIDs) == 0 {
		return []*Post{}, nil
	}
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	args := make([]any, 0, len(authorIDs)+2)
	for _, id := range authorIDs {
		args = append(args, id)
	}
	conditions := []string{
		fmt.Sprintf("`user_id` in (%s)", inPlaceholders(len(authorIDs))),
		"`status` = 'active'",
		"`visibility` = 'public'",
		"`deleted_at` is null",
	}
	if beforeID > 0 {
		conditions = append(conditions, "`id` < ?")
		args = append(args, beforeID)
	}

	query := fmt.Sprintf("select %s from %s where %s order by `id` desc limit ?", postRowsWithDefaultScore, m.table, strings.Join(conditions, " and "))
	args = append(args, limit)

	var resp []*Post
	if err := m.conn.QueryRowsCtx(ctx, &resp, query, args...); err != nil {
		return nil, err
	}
	return resp, nil
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
		postRowsWithDefaultScore,
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

func (m *defaultPostModel) SetStatus(ctx context.Context, id uint64, status string) error {
	status = strings.ToLower(strings.TrimSpace(status))
	switch status {
	case "active", "hidden", "deleted":
	default:
		return fmt.Errorf("unsupported post status: %s", status)
	}

	deletedExpr := "`deleted_at`"
	if status == "deleted" {
		deletedExpr = "now()"
	} else {
		deletedExpr = "null"
	}

	query := fmt.Sprintf("update %s set `status` = ?, `deleted_at` = %s where `id` = ? and `status` <> 'deleted'", m.table, deletedExpr)
	_, err := m.conn.ExecCtx(ctx, query, status, id)
	return err
}

func (m *defaultPostModel) SoftDelete(ctx context.Context, id uint64, deletedAt time.Time) error {
	query := fmt.Sprintf("update %s set `status` = 'deleted', `is_pinned` = 0, `pinned_at` = null, `deleted_at` = ? where `id` = ? and `status` <> 'deleted' and `deleted_at` is null", m.table)
	_, err := m.conn.ExecCtx(ctx, query, sql.NullTime{Time: deletedAt, Valid: !deletedAt.IsZero()}, id)
	return err
}

func postHotScoreSQL() string {
	return "(ln(1 + coalesce(es.`view_count`, 0)) + (coalesce(es.`reaction_count`, 0) * 4) + (coalesce(es.`favorite_count`, 0) * 8) + (coalesce(es.`comment_count`, 0) * 3) + (coalesce(es.`share_count`, 0) * 6)) / pow(timestampdiff(hour, p.`created_at`, now()) + 2, 1.2)"
}

func postRisingScoreSQL() string {
	return "(select coalesce(sum(ln(1 + esh.`view_count`) + (esh.`reaction_count` * 4) + (esh.`favorite_count` * 8) + (esh.`comment_count` * 3) + (esh.`share_count` * 6)), 0) from `entity_stat_hourly` esh where esh.`target_type` = 'post' and esh.`target_id` = p.`id` and esh.`bucket_hour` >= date_sub(timestamp(date_format(now(), '%Y-%m-%d %H:00:00')), interval 24 hour))"
}

func maxInt64(value int64) int64 {
	if value < 0 {
		return 0
	}
	return value
}
