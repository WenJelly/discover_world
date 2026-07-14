package statistics

import (
	"context"
	"fmt"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

var _ EntityStatHourlyModel = (*defaultEntityStatHourlyModel)(nil)

type (
	EntityStatHourlyModel interface {
		IncrementCounter(ctx context.Context, targetType string, targetID uint64, counter string, delta int64) error
		withSession(session sqlx.Session) EntityStatHourlyModel
	}

	defaultEntityStatHourlyModel struct {
		conn  sqlx.SqlConn
		table string
	}
)

func NewEntityStatHourlyModel(conn sqlx.SqlConn) EntityStatHourlyModel {
	return &defaultEntityStatHourlyModel{
		conn:  conn,
		table: "`entity_stat_hourly`",
	}
}

func (m *defaultEntityStatHourlyModel) withSession(session sqlx.Session) EntityStatHourlyModel {
	return NewEntityStatHourlyModel(sqlx.NewSqlConnFromSession(session))
}

func (m *defaultEntityStatHourlyModel) IncrementCounter(ctx context.Context, targetType string, targetID uint64, counter string, delta int64) error {
	delta = normalizeEntityStatHourlyDelta(delta)
	if targetType == "" || targetID == 0 || delta == 0 {
		return nil
	}

	query, err := entityStatHourlyIncrementSQL(counter)
	if err != nil {
		return err
	}
	_, err = m.conn.ExecCtx(ctx, query, targetType, targetID, delta)
	return err
}

func normalizeEntityStatHourlyDelta(delta int64) int64 {
	if delta <= 0 {
		return 0
	}
	return delta
}

func entityStatHourlyIncrementSQL(counter string) (string, error) {
	counter, err := normalizeEntityStatCounter(counter)
	if err != nil {
		return "", err
	}

	return fmt.Sprintf(
		"insert into `entity_stat_hourly` (`target_type`,`target_id`,`bucket_hour`,`%s`) values (?, ?, timestamp(date_format(now(), '%%Y-%%m-%%d %%H:00:00')), ?) on duplicate key update `%s` = `%s` + values(`%s`)",
		counter,
		counter,
		counter,
		counter,
	), nil
}
