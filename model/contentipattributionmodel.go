package model

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

const contentIpAttributionRows = "`id`,`target_type`,`target_id`,`action_type`,`user_id`,`ip_hash`,`ip_version`,`country`,`province`,`city`,`district`,`isp`,`display_location`,`provider`,`provider_version`,`resolved_at`,`created_at`,`updated_at`"

type (
	ContentIpAttributionModel interface {
		Upsert(ctx context.Context, data *ContentIpAttribution) error
		FindByTargets(ctx context.Context, targetType string, targetIDs []uint64, actionType string) (map[uint64]*ContentIpAttribution, error)
	}

	defaultContentIpAttributionModel struct {
		conn  sqlx.SqlConn
		table string
	}

	ContentIpAttribution struct {
		Id              uint64         `db:"id"`
		TargetType      string         `db:"target_type"`
		TargetId        uint64         `db:"target_id"`
		ActionType      string         `db:"action_type"`
		UserId          uint64         `db:"user_id"`
		IpHash          sql.NullString `db:"ip_hash"`
		IpVersion       sql.NullInt64  `db:"ip_version"`
		Country         sql.NullString `db:"country"`
		Province        sql.NullString `db:"province"`
		City            sql.NullString `db:"city"`
		District        sql.NullString `db:"district"`
		Isp             sql.NullString `db:"isp"`
		DisplayLocation sql.NullString `db:"display_location"`
		Provider        sql.NullString `db:"provider"`
		ProviderVersion sql.NullString `db:"provider_version"`
		ResolvedAt      sql.NullTime   `db:"resolved_at"`
		CreatedAt       time.Time      `db:"created_at"`
		UpdatedAt       time.Time      `db:"updated_at"`
	}
)

func NewContentIpAttributionModel(conn sqlx.SqlConn) ContentIpAttributionModel {
	return &defaultContentIpAttributionModel{
		conn:  conn,
		table: "`content_ip_attribution`",
	}
}

func (m *defaultContentIpAttributionModel) Upsert(ctx context.Context, data *ContentIpAttribution) error {
	if data == nil || data.TargetType == "" || data.TargetId == 0 || data.ActionType == "" || data.UserId == 0 {
		return nil
	}
	// Matches uk_content_ip_target_action in sql/content_ip_attribution.sql.
	query := fmt.Sprintf(
		"insert into %s (`target_type`,`target_id`,`action_type`,`user_id`,`ip_hash`,`ip_version`,`country`,`province`,`city`,`district`,`isp`,`display_location`,`provider`,`provider_version`,`resolved_at`) "+
			"values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "+
			"on duplicate key update "+
			"`user_id` = values(`user_id`), "+
			"`ip_hash` = values(`ip_hash`), "+
			"`ip_version` = values(`ip_version`), "+
			"`country` = values(`country`), "+
			"`province` = values(`province`), "+
			"`city` = values(`city`), "+
			"`district` = values(`district`), "+
			"`isp` = values(`isp`), "+
			"`display_location` = values(`display_location`), "+
			"`provider` = values(`provider`), "+
			"`provider_version` = values(`provider_version`), "+
			"`resolved_at` = values(`resolved_at`), "+
			"`updated_at` = CURRENT_TIMESTAMP",
		m.table,
	)
	_, err := m.conn.ExecCtx(ctx, query,
		data.TargetType,
		data.TargetId,
		data.ActionType,
		data.UserId,
		data.IpHash,
		data.IpVersion,
		data.Country,
		data.Province,
		data.City,
		data.District,
		data.Isp,
		data.DisplayLocation,
		data.Provider,
		data.ProviderVersion,
		data.ResolvedAt,
	)
	return err
}

func (m *defaultContentIpAttributionModel) FindByTargets(ctx context.Context, targetType string, targetIDs []uint64, actionType string) (map[uint64]*ContentIpAttribution, error) {
	resp := make(map[uint64]*ContentIpAttribution)
	targetType = strings.TrimSpace(targetType)
	actionType = strings.TrimSpace(actionType)
	targetIDs = uniquePositiveIDs(targetIDs)
	if targetType == "" || actionType == "" || len(targetIDs) == 0 {
		return resp, nil
	}

	args := make([]any, 0, len(targetIDs)+2)
	args = append(args, targetType, actionType)
	for _, id := range targetIDs {
		args = append(args, id)
	}
	query := fmt.Sprintf(
		"select %s from %s where `target_type` = ? and `action_type` = ? and `target_id` in (%s)",
		contentIpAttributionRows,
		m.table,
		inPlaceholders(len(targetIDs)),
	)

	var rows []*ContentIpAttribution
	if err := m.conn.QueryRowsCtx(ctx, &rows, query, args...); err != nil {
		return nil, err
	}
	for _, row := range rows {
		if row != nil {
			resp[row.TargetId] = row
		}
	}
	return resp, nil
}
