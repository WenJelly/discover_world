package model

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

const moderationReportRows = "`id`,`reporter_user_id`,`target_type`,`target_id`,`reason`,`description`,`status`,`created_at`,`updated_at`,`resolved_at`"

type (
	ModerationReportModel interface {
		Insert(ctx context.Context, data *ModerationReport) (sql.Result, error)
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
		CreatedAt      time.Time      `db:"created_at"`
		UpdatedAt      time.Time      `db:"updated_at"`
		ResolvedAt     sql.NullTime   `db:"resolved_at"`
	}
)

func NewModerationReportModel(conn sqlx.SqlConn) ModerationReportModel {
	return &defaultModerationReportModel{
		conn:  conn,
		table: "`moderation_report`",
	}
}

func (m *defaultModerationReportModel) Insert(ctx context.Context, data *ModerationReport) (sql.Result, error) {
	query := fmt.Sprintf("insert into %s (`reporter_user_id`,`target_type`,`target_id`,`reason`,`description`,`status`,`resolved_at`) values (?, ?, ?, ?, ?, ?, ?)", m.table)
	return m.conn.ExecCtx(ctx, query, data.ReporterUserId, data.TargetType, data.TargetId, data.Reason, data.Description, data.Status, data.ResolvedAt)
}
