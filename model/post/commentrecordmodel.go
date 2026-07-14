package post

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

var _ CommentRecordModel = (*customCommentRecordModel)(nil)

type (
	// CommentRecordModel is an interface to be customized, add more methods here,
	// and implement the added methods in customCommentRecordModel.
	CommentRecordModel interface {
		commentRecordModel
		FindActiveByTargetBeforeID(ctx context.Context, targetType string, targetID uint64, beforeID, limit int64) ([]*CommentRecord, error)
		FindByFilter(ctx context.Context, filter CommentRecordFilter, pageNum int64, pageSize int64) ([]*CommentRecord, error)
		CountByFilter(ctx context.Context, filter CommentRecordFilter) (int64, error)
		SetStatus(ctx context.Context, id uint64, status string) error
		withSession(session sqlx.Session) CommentRecordModel
	}

	customCommentRecordModel struct {
		*defaultCommentRecordModel
	}

	CommentRecordFilter struct {
		Status        string
		UserId        uint64
		TargetType    string
		TargetId      uint64
		SearchText    string
		CreatedAtFrom time.Time
		CreatedAtTo   time.Time
	}
)

// NewCommentRecordModel returns a model for the database table.
func NewCommentRecordModel(conn sqlx.SqlConn) CommentRecordModel {
	return &customCommentRecordModel{
		defaultCommentRecordModel: newCommentRecordModel(conn),
	}
}

func (m *customCommentRecordModel) SetStatus(ctx context.Context, id uint64, status string) error {
	status = strings.ToLower(strings.TrimSpace(status))
	switch status {
	case "active", "hidden", "deleted":
	default:
		return fmt.Errorf("unsupported comment status: %s", status)
	}
	deletedExpr := "null"
	if status == "deleted" {
		deletedExpr = "now()"
	}
	query := fmt.Sprintf("update %s set `status` = ?, `deleted_at` = %s where `id` = ? and `status` <> 'deleted'", m.table, deletedExpr)
	_, err := m.conn.ExecCtx(ctx, query, status, id)
	return err
}

func (m *customCommentRecordModel) FindByFilter(ctx context.Context, filter CommentRecordFilter, pageNum int64, pageSize int64) ([]*CommentRecord, error) {
	whereSQL, args := buildCommentRecordWhere(filter)
	if pageNum <= 0 {
		pageNum = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	query := fmt.Sprintf("select %s from %s where %s order by `id` desc limit ? offset ?", commentRecordRows, m.table, whereSQL)
	args = append(args, pageSize, (pageNum-1)*pageSize)
	var resp []*CommentRecord
	if err := m.conn.QueryRowsCtx(ctx, &resp, query, args...); err != nil {
		return nil, err
	}
	return resp, nil
}

func (m *customCommentRecordModel) CountByFilter(ctx context.Context, filter CommentRecordFilter) (int64, error) {
	whereSQL, args := buildCommentRecordWhere(filter)
	query := fmt.Sprintf("select count(1) from %s where %s", m.table, whereSQL)
	var resp int64
	if err := m.conn.QueryRowCtx(ctx, &resp, query, args...); err != nil {
		return 0, err
	}
	return resp, nil
}

func buildCommentRecordWhere(filter CommentRecordFilter) (string, []any) {
	conditions := []string{"`deleted_at` is null"}
	args := make([]any, 0)
	if status := strings.TrimSpace(filter.Status); status != "" && status != "all" {
		conditions = append(conditions, "`status` = ?")
		args = append(args, status)
	}
	if filter.UserId > 0 {
		conditions = append(conditions, "`user_id` = ?")
		args = append(args, filter.UserId)
	}
	if targetType := strings.TrimSpace(filter.TargetType); targetType != "" {
		conditions = append(conditions, "`target_type` = ?")
		args = append(args, targetType)
	}
	if filter.TargetId > 0 {
		conditions = append(conditions, "`target_id` = ?")
		args = append(args, filter.TargetId)
	}
	if searchText := strings.TrimSpace(filter.SearchText); searchText != "" {
		conditions = append(conditions, "`content` like ?")
		args = append(args, "%"+searchText+"%")
	}
	if !filter.CreatedAtFrom.IsZero() {
		conditions = append(conditions, "`created_at` >= ?")
		args = append(args, filter.CreatedAtFrom)
	}
	if !filter.CreatedAtTo.IsZero() {
		conditions = append(conditions, "`created_at` <= ?")
		args = append(args, filter.CreatedAtTo)
	}
	return strings.Join(conditions, " and "), args
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
