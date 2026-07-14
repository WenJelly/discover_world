package post

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

const postDiscussionRows = "`id`,`post_id`,`board_id`,`title`,`status`,`is_locked`,`is_board_pinned`,`board_pinned_at`,`last_activity_at`,`created_at`,`updated_at`,`deleted_at`"

type (
	PostDiscussionModel interface {
		FindByPostID(ctx context.Context, postID uint64) (*PostDiscussion, error)
		FindPublicByBoardBeforeCursor(ctx context.Context, boardID uint64, cursor uint64, limit int64) ([]*PostDiscussion, error)
		Insert(ctx context.Context, data *PostDiscussion) (sql.Result, error)
		SetBoardPinned(ctx context.Context, postID uint64, pinned bool, pinnedAt time.Time) error
		SetLocked(ctx context.Context, postID uint64, locked bool) error
		TouchActivity(ctx context.Context, postID uint64, activityAt time.Time) error
	}

	defaultPostDiscussionModel struct {
		conn  sqlx.SqlConn
		table string
	}

	PostDiscussion struct {
		Id             uint64       `db:"id"`
		PostId         uint64       `db:"post_id"`
		BoardId        uint64       `db:"board_id"`
		Title          string       `db:"title"`
		Status         string       `db:"status"`
		IsLocked       int64        `db:"is_locked"`
		IsBoardPinned  int64        `db:"is_board_pinned"`
		BoardPinnedAt  sql.NullTime `db:"board_pinned_at"`
		LastActivityAt time.Time    `db:"last_activity_at"`
		CreatedAt      time.Time    `db:"created_at"`
		UpdatedAt      time.Time    `db:"updated_at"`
		DeletedAt      sql.NullTime `db:"deleted_at"`
	}
)

func NewPostDiscussionModel(conn sqlx.SqlConn) PostDiscussionModel {
	return &defaultPostDiscussionModel{
		conn:  conn,
		table: "`post_discussion`",
	}
}

func (m *defaultPostDiscussionModel) Insert(ctx context.Context, data *PostDiscussion) (sql.Result, error) {
	query := fmt.Sprintf("insert into %s (`post_id`,`board_id`,`title`,`status`,`is_locked`,`is_board_pinned`,`board_pinned_at`,`last_activity_at`,`deleted_at`) values (?, ?, ?, ?, ?, ?, ?, ?, ?)", m.table)
	lastActivity := data.LastActivityAt
	if lastActivity.IsZero() {
		lastActivity = time.Now()
	}
	return m.conn.ExecCtx(ctx, query, data.PostId, data.BoardId, data.Title, data.Status, data.IsLocked, data.IsBoardPinned, data.BoardPinnedAt, lastActivity, data.DeletedAt)
}

func (m *defaultPostDiscussionModel) FindByPostID(ctx context.Context, postID uint64) (*PostDiscussion, error) {
	query := fmt.Sprintf("select %s from %s where `post_id` = ? and `status` <> 'deleted' and `deleted_at` is null limit 1", postDiscussionRows, m.table)
	var resp PostDiscussion
	err := m.conn.QueryRowCtx(ctx, &resp, query, postID)
	switch err {
	case nil:
		return &resp, nil
	case sqlx.ErrNotFound:
		return nil, ErrNotFound
	default:
		return nil, err
	}
}

func (m *defaultPostDiscussionModel) FindPublicByBoardBeforeCursor(ctx context.Context, boardID uint64, cursor uint64, limit int64) ([]*PostDiscussion, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	conditions := []string{
		"pd.`status` = 'active'",
		"pd.`deleted_at` is null",
		"p.`status` = 'active'",
		"p.`visibility` = 'public'",
		"p.`deleted_at` is null",
		"fb.`status` = 'active'",
		"fb.`deleted_at` is null",
	}
	args := []any{}
	if boardID > 0 {
		conditions = append(conditions, "pd.`board_id` = ?")
		args = append(args, boardID)
	}
	if cursor > 0 {
		conditions = append(conditions, "pd.`id` < ?")
		args = append(args, cursor)
	}

	query := fmt.Sprintf(`
select %s
from `+"`post_discussion`"+` pd
join `+"`post`"+` p on p.`+"`id`"+` = pd.`+"`post_id`"+`
join `+"`forum_board`"+` fb on fb.`+"`id`"+` = pd.`+"`board_id`"+`
where %s
order by pd.`+"`is_board_pinned`"+` desc, pd.`+"`board_pinned_at`"+` desc, pd.`+"`last_activity_at`"+` desc, pd.`+"`id`"+` desc
limit ?`, qualifiedRows(postDiscussionRows, "pd"), strings.Join(conditions, " and "))
	args = append(args, limit)

	var resp []*PostDiscussion
	if err := m.conn.QueryRowsCtx(ctx, &resp, query, args...); err != nil {
		return nil, err
	}
	return resp, nil
}

func (m *defaultPostDiscussionModel) SetLocked(ctx context.Context, postID uint64, locked bool) error {
	value := int64(0)
	if locked {
		value = 1
	}
	query := fmt.Sprintf("update %s set `is_locked` = ? where `post_id` = ? and `status` <> 'deleted' and `deleted_at` is null", m.table)
	_, err := m.conn.ExecCtx(ctx, query, value, postID)
	return err
}

func (m *defaultPostDiscussionModel) SetBoardPinned(ctx context.Context, postID uint64, pinned bool, pinnedAt time.Time) error {
	value := int64(0)
	pinnedAtValue := sql.NullTime{}
	if pinned {
		value = 1
		pinnedAtValue = sql.NullTime{Time: pinnedAt, Valid: !pinnedAt.IsZero()}
	}
	query := fmt.Sprintf("update %s set `is_board_pinned` = ?, `board_pinned_at` = ? where `post_id` = ? and `status` <> 'deleted' and `deleted_at` is null", m.table)
	_, err := m.conn.ExecCtx(ctx, query, value, pinnedAtValue, postID)
	return err
}

func (m *defaultPostDiscussionModel) TouchActivity(ctx context.Context, postID uint64, activityAt time.Time) error {
	if activityAt.IsZero() {
		activityAt = time.Now()
	}
	query := fmt.Sprintf("update %s set `last_activity_at` = ? where `post_id` = ? and `status` = 'active' and `deleted_at` is null", m.table)
	_, err := m.conn.ExecCtx(ctx, query, activityAt, postID)
	return err
}
