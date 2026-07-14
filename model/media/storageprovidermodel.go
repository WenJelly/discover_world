package media

import "github.com/zeromicro/go-zero/core/stores/sqlx"

var _ StorageProviderModel = (*customStorageProviderModel)(nil)

type (
	// StorageProviderModel is an interface to be customized, add more methods here,
	// and implement the added methods in customStorageProviderModel.
	StorageProviderModel interface {
		storageProviderModel
		withSession(session sqlx.Session) StorageProviderModel
	}

	customStorageProviderModel struct {
		*defaultStorageProviderModel
	}
)

// NewStorageProviderModel returns a model for the database table.
func NewStorageProviderModel(conn sqlx.SqlConn) StorageProviderModel {
	return &customStorageProviderModel{
		defaultStorageProviderModel: newStorageProviderModel(conn),
	}
}

func (m *customStorageProviderModel) withSession(session sqlx.Session) StorageProviderModel {
	return NewStorageProviderModel(sqlx.NewSqlConnFromSession(session))
}
