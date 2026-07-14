package admin

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

const adminOperationLogRows = "`id`,`operator_user_id`,`action`,`target_type`,`target_id`,`reason`,`before_json`,`after_json`,`metadata_json`,`client_ip`,`created_at`"

type (
	AdminOperationLogModel interface {
		Insert(ctx context.Context, data *AdminOperationLog) (sql.Result, error)
		FindByID(ctx context.Context, id uint64) (*AdminOperationLog, error)
		FindByFilter(ctx context.Context, filter AdminOperationLogFilter, pageNum int64, pageSize int64) ([]*AdminOperationLog, error)
		CountByFilter(ctx context.Context, filter AdminOperationLogFilter) (int64, error)
		withSession(session sqlx.Session) AdminOperationLogModel
	}

	defaultAdminOperationLogModel struct {
		conn  sqlx.SqlConn
		table string
	}

	AdminOperationLog struct {
		Id             uint64         `db:"id"`
		OperatorUserId uint64         `db:"operator_user_id"`
		Action         string         `db:"action"`
		TargetType     string         `db:"target_type"`
		TargetId       uint64         `db:"target_id"`
		Reason         sql.NullString `db:"reason"`
		BeforeJson     sql.NullString `db:"before_json"`
		AfterJson      sql.NullString `db:"after_json"`
		MetadataJson   sql.NullString `db:"metadata_json"`
		ClientIp       sql.NullString `db:"client_ip"`
		CreatedAt      time.Time      `db:"created_at"`
	}

	AdminOperationLogFilter struct {
		OperatorUserId uint64
		Action         string
		TargetType     string
		TargetId       uint64
		CreatedAtFrom  time.Time
		CreatedAtTo    time.Time
	}
)

func NewAdminOperationLogModel(conn sqlx.SqlConn) AdminOperationLogModel {
	return &defaultAdminOperationLogModel{
		conn:  conn,
		table: "`admin_operation_log`",
	}
}

func (m *defaultAdminOperationLogModel) withSession(session sqlx.Session) AdminOperationLogModel {
	return NewAdminOperationLogModel(sqlx.NewSqlConnFromSession(session))
}

func (m *defaultAdminOperationLogModel) Insert(ctx context.Context, data *AdminOperationLog) (sql.Result, error) {
	query := fmt.Sprintf("insert into %s (`operator_user_id`,`action`,`target_type`,`target_id`,`reason`,`before_json`,`after_json`,`metadata_json`,`client_ip`) values (?, ?, ?, ?, ?, ?, ?, ?, ?)", m.table)
	return m.conn.ExecCtx(ctx, query, data.OperatorUserId, data.Action, data.TargetType, data.TargetId, data.Reason, data.BeforeJson, data.AfterJson, data.MetadataJson, data.ClientIp)
}

func (m *defaultAdminOperationLogModel) FindByID(ctx context.Context, id uint64) (*AdminOperationLog, error) {
	query := fmt.Sprintf("select %s from %s where `id` = ? limit 1", adminOperationLogRows, m.table)
	var resp AdminOperationLog
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

func (m *defaultAdminOperationLogModel) FindByFilter(ctx context.Context, filter AdminOperationLogFilter, pageNum int64, pageSize int64) ([]*AdminOperationLog, error) {
	whereSQL, args := buildAdminOperationLogWhere(filter)
	if pageNum <= 0 {
		pageNum = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	query := fmt.Sprintf("select %s from %s where %s order by `id` desc limit ? offset ?", adminOperationLogRows, m.table, whereSQL)
	args = append(args, pageSize, (pageNum-1)*pageSize)

	var resp []*AdminOperationLog
	if err := m.conn.QueryRowsCtx(ctx, &resp, query, args...); err != nil {
		return nil, err
	}
	return resp, nil
}

func (m *defaultAdminOperationLogModel) CountByFilter(ctx context.Context, filter AdminOperationLogFilter) (int64, error) {
	whereSQL, args := buildAdminOperationLogWhere(filter)
	query := fmt.Sprintf("select count(1) from %s where %s", m.table, whereSQL)
	var resp int64
	if err := m.conn.QueryRowCtx(ctx, &resp, query, args...); err != nil {
		return 0, err
	}
	return resp, nil
}

func buildAdminOperationLogWhere(filter AdminOperationLogFilter) (string, []any) {
	conditions := []string{"1 = 1"}
	args := make([]any, 0)
	if filter.OperatorUserId > 0 {
		conditions = append(conditions, "`operator_user_id` = ?")
		args = append(args, filter.OperatorUserId)
	}
	if value := strings.TrimSpace(filter.Action); value != "" {
		conditions = append(conditions, "`action` = ?")
		args = append(args, value)
	}
	if value := strings.TrimSpace(filter.TargetType); value != "" {
		conditions = append(conditions, "`target_type` = ?")
		args = append(args, value)
	}
	if filter.TargetId > 0 {
		conditions = append(conditions, "`target_id` = ?")
		args = append(args, filter.TargetId)
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
