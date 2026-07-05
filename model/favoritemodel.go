package model

import (
	"context"
	"errors"
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
	favorite, err := m.FindOneByUserIdTargetTypeTargetId(ctx, userID, targetType, targetID)
	if err != nil {
		if !errors.Is(err, ErrNotFound) {
			return false, 0, err
		}
		if _, err := m.Insert(ctx, &Favorite{
			UserId:     userID,
			TargetType: targetType,
			TargetId:   targetID,
			Status:     1,
		}); err != nil {
			return false, 0, err
		}
		return true, 1, nil
	}

	if favorite.Status == 1 {
		favorite.Status = 0
		if err := m.Update(ctx, favorite); err != nil {
			return false, 0, err
		}
		return false, -1, nil
	}

	favorite.Status = 1
	if err := m.Update(ctx, favorite); err != nil {
		return false, 0, err
	}
	return true, 1, nil
}
