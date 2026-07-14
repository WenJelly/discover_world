package model

import (
	"context"
	"fmt"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

var _ FavoriteModel = (*customFavoriteModel)(nil)

type (
	// FavoriteModel is an interface to be customized, add more methods here,
	// and implement the added methods in customFavoriteModel.
	FavoriteModel interface {
		favoriteModel
		FindActiveTargetIDsByUser(ctx context.Context, userID uint64, targetType string, targetIDs []uint64) (map[uint64]bool, error)
		ToggleStatus(ctx context.Context, userID uint64, targetType string, targetID uint64) (active bool, delta int64, err error)
		withSession(session sqlx.Session) FavoriteModel
	}

	customFavoriteModel struct {
		*defaultFavoriteModel
	}
)

// NewFavoriteModel returns a model for the database table.
func NewFavoriteModel(conn sqlx.SqlConn) FavoriteModel {
	return &customFavoriteModel{
		defaultFavoriteModel: newFavoriteModel(conn),
	}
}

func (m *customFavoriteModel) withSession(session sqlx.Session) FavoriteModel {
	return NewFavoriteModel(sqlx.NewSqlConnFromSession(session))
}

func (m *customFavoriteModel) FindActiveTargetIDsByUser(ctx context.Context, userID uint64, targetType string, targetIDs []uint64) (map[uint64]bool, error) {
	resp := make(map[uint64]bool)
	targetIDs = uniquePositiveIDs(targetIDs)
	if userID == 0 || targetType == "" || len(targetIDs) == 0 {
		return resp, nil
	}

	args := []any{userID, targetType}
	for _, id := range targetIDs {
		args = append(args, id)
	}

	query := fmt.Sprintf("select `target_id` from %s where `user_id` = ? and `target_type` = ? and `status` = 1 and `target_id` in (%s)", m.table, inPlaceholders(len(targetIDs)))
	var rows []struct {
		TargetId uint64 `db:"target_id"`
	}
	if err := m.conn.QueryRowsCtx(ctx, &rows, query, args...); err != nil {
		return nil, err
	}
	for _, row := range rows {
		resp[row.TargetId] = true
	}
	return resp, nil
}

func (m *customFavoriteModel) ToggleStatus(ctx context.Context, userID uint64, targetType string, targetID uint64) (bool, int64, error) {
	// The unique-key upsert is the serialization point; callers apply the returned delta in the same transaction.
	query := fmt.Sprintf("insert into %s (`user_id`,`target_type`,`target_id`,`status`) values (?, ?, ?, 1) on duplicate key update `status` = 1 - `status`", m.table)
	if _, err := m.conn.ExecCtx(ctx, query, userID, targetType, targetID); err != nil {
		return false, 0, err
	}

	var status int64
	query = fmt.Sprintf("select `status` from %s where `user_id` = ? and `target_type` = ? and `target_id` = ? for update", m.table)
	err := m.conn.QueryRowCtx(ctx, &status, query, userID, targetType, targetID)
	if err != nil {
		return false, 0, err
	}
	if status == 1 {
		return true, 1, nil
	}
	if status == 0 {
		return false, -1, nil
	}
	return false, 0, fmt.Errorf("unexpected favorite status after toggle: %d", status)
}
