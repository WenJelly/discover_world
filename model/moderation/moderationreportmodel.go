package moderation

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

const moderationReportRows = "`id`,`reporter_user_id`,`target_type`,`target_id`,`reason`,`description`,`status`,`handler_user_id`,`resolution`,`resolution_note`,`created_at`,`updated_at`,`resolved_at`"

type (
	ModerationReportModel interface {
		Insert(ctx context.Context, data *ModerationReport) (sql.Result, error)
		FindOne(ctx context.Context, id uint64) (*ModerationReport, error)
		FindByFilter(ctx context.Context, filter ModerationReportFilter, pageNum int64, pageSize int64) ([]*ModerationReport, error)
		CountByFilter(ctx context.Context, filter ModerationReportFilter) (int64, error)
		Resolve(ctx context.Context, req ResolveModerationReportRequest) error
		withSession(session sqlx.Session) ModerationReportModel
	}

	defaultModerationReportModel struct {
		conn  sqlx.SqlConn
		table string
	}

	ModerationReport struct {
		Id             uint64         `db:"id"`
		ReporterUserId uint64         `db:"reporter_user_id"`
		TargetType     string         `db:"target_type"`
		TargetId       uint64         `db:"target_id"`
		Reason         string         `db:"reason"`
		Description    sql.NullString `db:"description"`
		Status         string         `db:"status"`
		HandlerUserId  sql.NullInt64  `db:"handler_user_id"`
		Resolution     sql.NullString `db:"resolution"`
		ResolutionNote sql.NullString `db:"resolution_note"`
		CreatedAt      time.Time      `db:"created_at"`
		UpdatedAt      time.Time      `db:"updated_at"`
		ResolvedAt     sql.NullTime   `db:"resolved_at"`
	}

	ModerationReportFilter struct {
		Status         string
		TargetType     string
		TargetId       uint64
		ReporterUserId uint64
		CreatedAtFrom  time.Time
		CreatedAtTo    time.Time
	}

	ResolveModerationReportRequest struct {
		Id             uint64
		HandlerUserId  uint64
		Status         string
		Resolution     string
		ResolutionNote sql.NullString
		ResolvedAt     time.Time
	}
)

func NewModerationReportModel(conn sqlx.SqlConn) ModerationReportModel {
	return &defaultModerationReportModel{
		conn:  conn,
		table: "`moderation_report`",
	}
}

func (m *defaultModerationReportModel) withSession(session sqlx.Session) ModerationReportModel {
	return NewModerationReportModel(sqlx.NewSqlConnFromSession(session))
}

func (m *defaultModerationReportModel) Insert(ctx context.Context, data *ModerationReport) (sql.Result, error) {
	query := fmt.Sprintf("insert into %s (`reporter_user_id`,`target_type`,`target_id`,`reason`,`description`,`status`,`resolved_at`) values (?, ?, ?, ?, ?, ?, ?)", m.table)
	return m.conn.ExecCtx(ctx, query, data.ReporterUserId, data.TargetType, data.TargetId, data.Reason, data.Description, data.Status, data.ResolvedAt)
}

func (m *defaultModerationReportModel) FindOne(ctx context.Context, id uint64) (*ModerationReport, error) {
	query := fmt.Sprintf("select %s from %s where `id` = ? limit 1", moderationReportRows, m.table)
	var resp ModerationReport
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

func (m *defaultModerationReportModel) FindByFilter(ctx context.Context, filter ModerationReportFilter, pageNum int64, pageSize int64) ([]*ModerationReport, error) {
	whereSQL, args := buildModerationReportWhere(filter)
	if pageNum <= 0 {
		pageNum = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	query := fmt.Sprintf("select %s from %s where %s order by `id` desc limit ? offset ?", moderationReportRows, m.table, whereSQL)
	args = append(args, pageSize, (pageNum-1)*pageSize)

	var resp []*ModerationReport
	if err := m.conn.QueryRowsCtx(ctx, &resp, query, args...); err != nil {
		return nil, err
	}
	return resp, nil
}

func (m *defaultModerationReportModel) CountByFilter(ctx context.Context, filter ModerationReportFilter) (int64, error) {
	whereSQL, args := buildModerationReportWhere(filter)
	query := fmt.Sprintf("select count(1) from %s where %s", m.table, whereSQL)
	var resp int64
	if err := m.conn.QueryRowCtx(ctx, &resp, query, args...); err != nil {
		return 0, err
	}
	return resp, nil
}

func (m *defaultModerationReportModel) Resolve(ctx context.Context, req ResolveModerationReportRequest) error {
	resolvedAt := req.ResolvedAt
	if resolvedAt.IsZero() {
		resolvedAt = time.Now()
	}
	query := fmt.Sprintf("update %s set `status` = ?, `handler_user_id` = ?, `resolution` = ?, `resolution_note` = ?, `resolved_at` = ? where `id` = ? and `status` = 'open'", m.table)
	resolution := sql.NullString{String: strings.TrimSpace(req.Resolution), Valid: strings.TrimSpace(req.Resolution) != ""}
	_, err := m.conn.ExecCtx(ctx, query, req.Status, sql.NullInt64{Int64: int64(req.HandlerUserId), Valid: req.HandlerUserId > 0}, resolution, req.ResolutionNote, sql.NullTime{Time: resolvedAt, Valid: true}, req.Id)
	return err
}

func buildModerationReportWhere(filter ModerationReportFilter) (string, []any) {
	conditions := []string{"1 = 1"}
	args := make([]any, 0)
	if value := strings.TrimSpace(filter.Status); value != "" && value != "all" {
		conditions = append(conditions, "`status` = ?")
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
	if filter.ReporterUserId > 0 {
		conditions = append(conditions, "`reporter_user_id` = ?")
		args = append(args, filter.ReporterUserId)
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
