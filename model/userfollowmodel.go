package model

import (
	"context"
	"fmt"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

var _ UserFollowModel = (*customUserFollowModel)(nil)

type (
	// UserFollowModel is an interface to be customized, add more methods here,
	// and implement the added methods in customUserFollowModel.
	UserFollowModel interface {
		userFollowModel
		CountFollowers(ctx context.Context, userID uint64) (int64, error)
		CountFollowing(ctx context.Context, userID uint64) (int64, error)
		Follow(ctx context.Context, followerID uint64, followingID uint64) error
		IsFollowing(ctx context.Context, followerID uint64, followingID uint64) (bool, error)
		ListFollowerRefs(ctx context.Context, userID uint64, cursor uint64, limit int64) ([]FollowUserRef, bool, error)
		ListFollowerIDs(ctx context.Context, userID uint64, cursor uint64, limit int64) ([]uint64, bool, error)
		ListFollowingRefs(ctx context.Context, userID uint64, cursor uint64, limit int64) ([]FollowUserRef, bool, error)
		ListFollowingIDs(ctx context.Context, userID uint64, cursor uint64, limit int64) ([]uint64, bool, error)
		Unfollow(ctx context.Context, followerID uint64, followingID uint64) error
		withSession(session sqlx.Session) UserFollowModel
	}

	FollowUserRef struct {
		Cursor uint64
		UserID uint64
	}

	customUserFollowModel struct {
		*defaultUserFollowModel
	}
)

// NewUserFollowModel returns a model for the database table.
func NewUserFollowModel(conn sqlx.SqlConn) UserFollowModel {
	return &customUserFollowModel{
		defaultUserFollowModel: newUserFollowModel(conn),
	}
}

func (m *customUserFollowModel) withSession(session sqlx.Session) UserFollowModel {
	return NewUserFollowModel(sqlx.NewSqlConnFromSession(session))
}

func (m *customUserFollowModel) Follow(ctx context.Context, followerID uint64, followingID uint64) error {
	query := fmt.Sprintf("insert into %s (`follower_id`,`following_id`,`status`) values (?, ?, 1) on duplicate key update `status` = 1", m.table)
	_, err := m.conn.ExecCtx(ctx, query, followerID, followingID)
	return err
}

func (m *customUserFollowModel) Unfollow(ctx context.Context, followerID uint64, followingID uint64) error {
	query := fmt.Sprintf("update %s set `status` = 0 where `follower_id` = ? and `following_id` = ?", m.table)
	_, err := m.conn.ExecCtx(ctx, query, followerID, followingID)
	return err
}

func (m *customUserFollowModel) IsFollowing(ctx context.Context, followerID uint64, followingID uint64) (bool, error) {
	follow, err := m.FindOneByFollowerIdFollowingId(ctx, followerID, followingID)
	if err != nil {
		if err == ErrNotFound {
			return false, nil
		}
		return false, err
	}
	return follow.Status == 1, nil
}

func (m *customUserFollowModel) CountFollowers(ctx context.Context, userID uint64) (int64, error) {
	query := fmt.Sprintf("select count(1) from %s where `following_id` = ? and `status` = 1", m.table)
	var count int64
	if err := m.conn.QueryRowCtx(ctx, &count, query, userID); err != nil {
		return 0, err
	}
	return count, nil
}

func (m *customUserFollowModel) CountFollowing(ctx context.Context, userID uint64) (int64, error) {
	query := fmt.Sprintf("select count(1) from %s where `follower_id` = ? and `status` = 1", m.table)
	var count int64
	if err := m.conn.QueryRowCtx(ctx, &count, query, userID); err != nil {
		return 0, err
	}
	return count, nil
}

func (m *customUserFollowModel) ListFollowerIDs(ctx context.Context, userID uint64, cursor uint64, limit int64) ([]uint64, bool, error) {
	refs, hasMore, err := m.ListFollowerRefs(ctx, userID, cursor, limit)
	if err != nil {
		return nil, false, err
	}
	return followUserRefIDs(refs), hasMore, nil
}

func (m *customUserFollowModel) ListFollowingIDs(ctx context.Context, userID uint64, cursor uint64, limit int64) ([]uint64, bool, error) {
	refs, hasMore, err := m.ListFollowingRefs(ctx, userID, cursor, limit)
	if err != nil {
		return nil, false, err
	}
	return followUserRefIDs(refs), hasMore, nil
}

func (m *customUserFollowModel) ListFollowerRefs(ctx context.Context, userID uint64, cursor uint64, limit int64) ([]FollowUserRef, bool, error) {
	return m.listActiveUserRefs(ctx, "`follower_id`", "`following_id`", userID, cursor, limit)
}

func (m *customUserFollowModel) ListFollowingRefs(ctx context.Context, userID uint64, cursor uint64, limit int64) ([]FollowUserRef, bool, error) {
	return m.listActiveUserRefs(ctx, "`following_id`", "`follower_id`", userID, cursor, limit)
}

func (m *customUserFollowModel) listActiveUserRefs(ctx context.Context, selectColumn, filterColumn string, userID uint64, cursor uint64, limit int64) ([]FollowUserRef, bool, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	queryLimit := limit + 1
	query := fmt.Sprintf("select `id`, %s as `user_id` from %s where %s = ? and `status` = 1 and `id` > ? order by `id` asc limit ?", selectColumn, m.table, filterColumn)
	var rows []struct {
		Id     uint64 `db:"id"`
		UserId uint64 `db:"user_id"`
	}
	if err := m.conn.QueryRowsCtx(ctx, &rows, query, userID, cursor, queryLimit); err != nil {
		return nil, false, err
	}

	hasMore := int64(len(rows)) > limit
	if hasMore {
		rows = rows[:limit]
	}

	refs := make([]FollowUserRef, 0, len(rows))
	for _, row := range rows {
		refs = append(refs, FollowUserRef{Cursor: row.Id, UserID: row.UserId})
	}
	return refs, hasMore, nil
}

func followUserRefIDs(refs []FollowUserRef) []uint64 {
	ids := make([]uint64, 0, len(refs))
	for _, ref := range refs {
		ids = append(ids, ref.UserID)
	}
	return ids
}
