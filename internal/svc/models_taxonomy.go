package svc

import (
	taxonomymodel "discover_world/model/taxonomy"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

type TaxonomyModels struct {
	Tag     taxonomymodel.TagModel
	Tagging taxonomymodel.TaggingModel
}

func newTaxonomyModels(conn sqlx.SqlConn) TaxonomyModels {
	return TaxonomyModels{
		Tag:     taxonomymodel.NewTagModel(conn),
		Tagging: taxonomymodel.NewTaggingModel(conn),
	}
}
