package model

import (
	"context"
	"errors"
	"fmt"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

var _ ReactionModel = (*customReactionModel)(nil)

type (
	// ReactionModel is an interface to be customized, add more methods here,
	// and implement the added methods in customReactionModel.
	ReactionModel interface {
		reactionModel
		FindActiveTargetIDsByUser(ctx context.Context, userID uint64, targetType string, targetIDs []uint64, reactionType string) (map[uint64]bool, error)
		ToggleStatus(ctx context.Context, userID uint64, targetType string, targetID uint64, reactionType string) (active bool, delta int64, err error)
		withSession(session sqlx.Session) ReactionModel
	}

	customReactionModel struct {
		*defaultReactionModel
	}
)

// NewReactionModel returns a model for the database table.
func NewReactionModel(conn sqlx.SqlConn) ReactionModel {
	return &customReactionModel{
		defaultReactionModel: newReactionModel(conn),
	}
}

func (m *customReactionModel) withSession(session sqlx.Session) ReactionModel {
	return NewReactionModel(sqlx.NewSqlConnFromSession(session))
}

func (m *customReactionModel) FindActiveTargetIDsByUser(ctx context.Context, userID uint64, targetType string, targetIDs []uint64, reactionType string) (map[uint64]bool, error) {
	resp := make(map[uint64]bool)
	targetIDs = uniquePositiveIDs(targetIDs)
	if userID == 0 || targetType == "" || reactionType == "" || len(targetIDs) == 0 {
		return resp, nil
	}

	args := []any{userID, targetType, reactionType}
	for _, id := range targetIDs {
		args = append(args, id)
	}

	query := fmt.Sprintf("select `target_id` from %s where `user_id` = ? and `target_type` = ? and `reaction_type` = ? and `status` = 1 and `target_id` in (%s)", m.table, inPlaceholders(len(targetIDs)))
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

func (m *customReactionModel) ToggleStatus(ctx context.Context, userID uint64, targetType string, targetID uint64, reactionType string) (bool, int64, error) {
	reaction, err := m.FindOneByUserIdTargetTypeTargetIdReactionType(ctx, userID, targetType, targetID, reactionType)
	if err != nil {
		if !errors.Is(err, ErrNotFound) {
			return false, 0, err
		}
		if _, err := m.Insert(ctx, &Reaction{
			UserId:       userID,
			TargetType:   targetType,
			TargetId:     targetID,
			ReactionType: reactionType,
			Status:       1,
		}); err != nil {
			return false, 0, err
		}
		return true, 1, nil
	}

	if reaction.Status == 1 {
		reaction.Status = 0
		if err := m.Update(ctx, reaction); err != nil {
			return false, 0, err
		}
		return false, -1, nil
	}

	reaction.Status = 1
	if err := m.Update(ctx, reaction); err != nil {
		return false, 0, err
	}
	return true, 1, nil
}
