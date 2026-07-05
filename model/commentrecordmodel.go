package model

import (
	"context"
	"fmt"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

var _ CommentRecordModel = (*customCommentRecordModel)(nil)

type (
	// CommentRecordModel is an interface to be customized, add more methods here,
	// and implement the added methods in customCommentRecordModel.
	CommentRecordModel interface {
		commentRecordModel
		FindActiveByTargetBeforeID(ctx context.Context, targetType string, targetID uint64, beforeID, limit int64) ([]*CommentRecord, error)
		withSession(session sqlx.Session) CommentRecordModel
	}

	customCommentRecordModel struct {
		*defaultCommentRecordModel
	}
)

// NewCommentRecordModel returns a model for the database table.
func NewCommentRecordModel(conn sqlx.SqlConn) CommentRecordModel {
	return &customCommentRecordModel{
		defaultCommentRecordModel: newCommentRecordModel(conn),
	}
}

func (m *customCommentRecordModel) withSession(session sqlx.Session) CommentRecordModel {
	return NewCommentRecordModel(sqlx.NewSqlConnFromSession(session))
}

func (m *customCommentRecordModel) FindActiveByTargetBeforeID(ctx context.Context, targetType string, targetID uint64, beforeID, limit int64) ([]*CommentRecord, error) {
	if limit <= 0 {
		limit = 20
	}

	args := []any{targetType, targetID}
	beforeSQL := ""
	if beforeID > 0 {
		beforeSQL = " and `id` < ?"
		args = append(args, uint64(beforeID))
	}
	args = append(args, limit)

	query := fmt.Sprintf("select %s from %s where `target_type` = ? and `target_id` = ? and `status` = 'active' and `deleted_at` is null%s order by `id` desc limit ?", commentRecordRows, m.table, beforeSQL)
	var resp []*CommentRecord
	if err := m.conn.QueryRowsCtx(ctx, &resp, query, args...); err != nil {
		return nil, err
	}
	return resp, nil
}
