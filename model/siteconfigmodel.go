package model

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/go-sql-driver/mysql"
	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

type (
	// SiteConfigModel is a hand-written model for the site_config key/value
	// table (no goctl gen file). It stores site-wide configuration such as the
	// homepage hero selection as JSON payloads keyed by config_key.
	SiteConfigModel interface {
		GetByKey(ctx context.Context, key string) (*SiteConfig, error)
		UpsertByKey(ctx context.Context, key, valueJSON string, updatedBy uint64) error
		withSession(session sqlx.Session) SiteConfigModel
	}

	defaultSiteConfigModel struct {
		conn  sqlx.SqlConn
		table string
	}

	SiteConfig struct {
		Id          uint64         `db:"id"`
		ConfigKey   string         `db:"config_key"`
		ConfigValue sql.NullString `db:"config_value"`
		UpdatedBy   uint64         `db:"updated_by"`
		CreatedAt   time.Time      `db:"created_at"`
		UpdatedAt   time.Time      `db:"updated_at"`
	}
)

// NewSiteConfigModel returns a model for the site_config table.
func NewSiteConfigModel(conn sqlx.SqlConn) SiteConfigModel {
	return &defaultSiteConfigModel{
		conn:  conn,
		table: "`site_config`",
	}
}

func (m *defaultSiteConfigModel) withSession(session sqlx.Session) SiteConfigModel {
	return NewSiteConfigModel(sqlx.NewSqlConnFromSession(session))
}

func (m *defaultSiteConfigModel) GetByKey(ctx context.Context, key string) (*SiteConfig, error) {
	query := "select `id`, `config_key`, `config_value`, `updated_by`, `created_at`, `updated_at` from " + m.table + " where `config_key` = ? limit 1"
	var resp SiteConfig
	err := m.conn.QueryRowCtx(ctx, &resp, query, key)
	switch err {
	case nil:
		return &resp, nil
	case sqlx.ErrNotFound:
		return nil, ErrNotFound
	default:
		if isMissingTableError(err) {
			return nil, ErrNotFound
		}
		return nil, err
	}
}

func (m *defaultSiteConfigModel) UpsertByKey(ctx context.Context, key, valueJSON string, updatedBy uint64) error {
	query := "insert into " + m.table + " (`config_key`, `config_value`, `updated_by`) values (?, ?, ?) " +
		"on duplicate key update `config_value` = values(`config_value`), `updated_by` = values(`updated_by`)"
	_, err := m.conn.ExecCtx(ctx, query, key, valueJSON, updatedBy)
	return err
}

func isMissingTableError(err error) bool {
	var mysqlErr *mysql.MySQLError
	return errors.As(err, &mysqlErr) && mysqlErr.Number == 1146
}
