package search

import (
	"context"
	"database/sql"
	mediamodel "discover_world/model/media"
	postmodel "discover_world/model/post"
	profilemodel "discover_world/model/profile"
	"fmt"
	"github.com/zeromicro/go-zero/core/stores/builder"
	"strings"
	"time"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

type (
	SearchModel interface {
		SearchPublicMediaAssets(ctx context.Context, query string, limit int64) ([]*mediamodel.MediaAsset, error)
		SearchPublicPosts(ctx context.Context, query string, limit int64) ([]*postmodel.Post, error)
		SearchPublicAlbums(ctx context.Context, query string, limit int64) ([]*profilemodel.Album, error)
		SearchPublicUsers(ctx context.Context, query string, limit int64) ([]*SearchUser, error)
	}

	defaultSearchModel struct {
		conn sqlx.SqlConn
	}

	SearchUser struct {
		Id            uint64         `db:"id"`
		Username      string         `db:"username"`
		Email         sql.NullString `db:"email"`
		Role          string         `db:"role"`
		Status        string         `db:"status"`
		CreatedAt     time.Time      `db:"created_at"`
		UpdatedAt     time.Time      `db:"updated_at"`
		Nickname      sql.NullString `db:"nickname"`
		AvatarAssetId sql.NullInt64  `db:"avatar_asset_id"`
		Bio           sql.NullString `db:"bio"`
	}
)

func NewSearchModel(conn sqlx.SqlConn) SearchModel {
	return &defaultSearchModel{conn: conn}
}

func normalizeSearchLimit(limit int64) int64 {
	if limit <= 0 {
		return 20
	}
	if limit > 50 {
		return 50
	}
	return limit
}

func searchLike(query string) string {
	return "%" + strings.TrimSpace(query) + "%"
}

func qualifiedRows(rows, alias string) string {
	fields := strings.Split(rows, ",")
	for i, field := range fields {
		fields[i] = alias + "." + strings.TrimSpace(field)
	}
	return strings.Join(fields, ",")
}

func qualifiedStructRows(value any, alias string) string {
	return qualifiedRows(strings.Join(builder.RawFieldNames(value), ","), alias)
}

func qualifiedPostRowsWithDefaultScore(alias string) string {
	fields := builder.RawFieldNames(&postmodel.Post{})
	rows := make([]string, 0, len(fields))
	for _, field := range fields {
		if field != "`score`" {
			rows = append(rows, field)
		}
	}
	return qualifiedRows(strings.Join(rows, ","), alias) + ",0 as score"
}

func (m *defaultSearchModel) SearchPublicMediaAssets(ctx context.Context, query string, limit int64) ([]*mediamodel.MediaAsset, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return []*mediamodel.MediaAsset{}, nil
	}

	like := searchLike(query)
	sqlQuery := fmt.Sprintf(`
select %s
from `+"`media_asset`"+` ma
left join `+"`user_account`"+` ua on ua.`+"`id`"+` = ma.`+"`owner_user_id`"+`
left join `+"`user_profile`"+` up on up.`+"`user_id`"+` = ma.`+"`owner_user_id`"+`
left join `+"`entity_stat`"+` es on es.`+"`target_type`"+` = 'media_asset' and es.`+"`target_id`"+` = ma.`+"`id`"+`
where ma.`+"`status`"+` = 'active'
  and ma.`+"`visibility`"+` = 'public'
  and ma.`+"`audit_status`"+` = 'approved'
  and ma.`+"`asset_usage`"+` = 'work'
  and ma.`+"`deleted_at`"+` is null
  and (
    ma.`+"`title`"+` like ?
    or ma.`+"`description`"+` like ?
    or ma.`+"`original_filename`"+` like ?
    or json_unquote(json_extract(ma.`+"`metadata_json`"+`, '$.category')) like ?
    or ua.`+"`username`"+` like ?
    or up.`+"`nickname`"+` like ?
    or exists (
      select 1
      from `+"`tagging`"+` tg
      join `+"`tag`"+` t on t.`+"`id`"+` = tg.`+"`tag_id`"+`
      where tg.`+"`target_type`"+` = 'media_asset'
        and tg.`+"`target_id`"+` = ma.`+"`id`"+`
        and t.`+"`status`"+` = 1
        and (t.`+"`name`"+` like ? or t.`+"`slug`"+` like ?)
    )
  )
order by
  case
    when ma.`+"`title`"+` = ? then 0
    when ma.`+"`title`"+` like ? then 1
    when exists (
      select 1
      from `+"`tagging`"+` tg
      join `+"`tag`"+` t on t.`+"`id`"+` = tg.`+"`tag_id`"+`
      where tg.`+"`target_type`"+` = 'media_asset'
        and tg.`+"`target_id`"+` = ma.`+"`id`"+`
        and t.`+"`status`"+` = 1
        and t.`+"`name`"+` = ?
    ) then 2
    else 5
  end asc,
  coalesce(es.`+"`favorite_count`"+`, 0) desc,
  coalesce(es.`+"`reaction_count`"+`, 0) desc,
  coalesce(es.`+"`view_count`"+`, 0) desc,
  ma.`+"`id`"+` desc
limit ?`, qualifiedStructRows(&mediamodel.MediaAsset{}, "ma"))

	args := []any{like, like, like, like, like, like, like, like, query, query + "%", query, normalizeSearchLimit(limit)}
	var resp []*mediamodel.MediaAsset
	if err := m.conn.QueryRowsCtx(ctx, &resp, sqlQuery, args...); err != nil {
		return nil, err
	}
	return resp, nil
}

func (m *defaultSearchModel) SearchPublicPosts(ctx context.Context, query string, limit int64) ([]*postmodel.Post, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return []*postmodel.Post{}, nil
	}

	like := searchLike(query)
	sqlQuery := fmt.Sprintf(`
select %s
from `+"`post`"+` p
left join `+"`user_account`"+` ua on ua.`+"`id`"+` = p.`+"`user_id`"+`
left join `+"`user_profile`"+` up on up.`+"`user_id`"+` = p.`+"`user_id`"+`
left join `+"`entity_stat`"+` es on es.`+"`target_type`"+` = 'post' and es.`+"`target_id`"+` = p.`+"`id`"+`
where p.`+"`status`"+` = 'active'
  and p.`+"`visibility`"+` = 'public'
  and p.`+"`deleted_at`"+` is null
  and (
    p.`+"`content`"+` like ?
    or p.`+"`location`"+` like ?
    or ua.`+"`username`"+` like ?
    or up.`+"`nickname`"+` like ?
    or exists (
      select 1
      from `+"`tagging`"+` tg
      join `+"`tag`"+` t on t.`+"`id`"+` = tg.`+"`tag_id`"+`
      where tg.`+"`target_type`"+` = 'post'
        and tg.`+"`target_id`"+` = p.`+"`id`"+`
        and t.`+"`status`"+` = 1
        and (t.`+"`name`"+` like ? or t.`+"`slug`"+` like ?)
    )
  )
order by
  case
    when p.`+"`content`"+` like ? then 0
    when exists (
      select 1
      from `+"`tagging`"+` tg
      join `+"`tag`"+` t on t.`+"`id`"+` = tg.`+"`tag_id`"+`
      where tg.`+"`target_type`"+` = 'post'
        and tg.`+"`target_id`"+` = p.`+"`id`"+`
        and t.`+"`status`"+` = 1
        and t.`+"`name`"+` = ?
    ) then 1
    else 4
  end asc,
  coalesce(es.`+"`reaction_count`"+`, 0) desc,
  coalesce(es.`+"`comment_count`"+`, 0) desc,
  coalesce(es.`+"`view_count`"+`, 0) desc,
  p.`+"`id`"+` desc
limit ?`, qualifiedPostRowsWithDefaultScore("p"))

	args := []any{like, like, like, like, like, like, query + "%", query, normalizeSearchLimit(limit)}
	var resp []*postmodel.Post
	if err := m.conn.QueryRowsCtx(ctx, &resp, sqlQuery, args...); err != nil {
		return nil, err
	}
	return resp, nil
}

func (m *defaultSearchModel) SearchPublicAlbums(ctx context.Context, query string, limit int64) ([]*profilemodel.Album, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return []*profilemodel.Album{}, nil
	}

	like := searchLike(query)
	sqlQuery := fmt.Sprintf(`
select %s
from `+"`album`"+` a
left join `+"`user_account`"+` ua on ua.`+"`id`"+` = a.`+"`user_id`"+`
left join `+"`user_profile`"+` up on up.`+"`user_id`"+` = a.`+"`user_id`"+`
left join `+"`entity_stat`"+` es on es.`+"`target_type`"+` = 'album' and es.`+"`target_id`"+` = a.`+"`id`"+`
where a.`+"`status`"+` = 'active'
  and a.`+"`visibility`"+` = 'public'
  and a.`+"`deleted_at`"+` is null
  and (
    a.`+"`name`"+` like ?
    or a.`+"`description`"+` like ?
    or ua.`+"`username`"+` like ?
    or up.`+"`nickname`"+` like ?
    or exists (
      select 1
      from `+"`tagging`"+` tg
      join `+"`tag`"+` t on t.`+"`id`"+` = tg.`+"`tag_id`"+`
      where tg.`+"`target_type`"+` = 'album'
        and tg.`+"`target_id`"+` = a.`+"`id`"+`
        and t.`+"`status`"+` = 1
        and (t.`+"`name`"+` like ? or t.`+"`slug`"+` like ?)
    )
  )
order by
  case
    when a.`+"`name`"+` = ? then 0
    when a.`+"`name`"+` like ? then 1
    else 4
  end asc,
  coalesce(es.`+"`favorite_count`"+`, 0) desc,
  coalesce(es.`+"`view_count`"+`, 0) desc,
  a.`+"`id`"+` desc
limit ?`, qualifiedStructRows(&profilemodel.Album{}, "a"))

	args := []any{like, like, like, like, like, like, query, query + "%", normalizeSearchLimit(limit)}
	var resp []*profilemodel.Album
	if err := m.conn.QueryRowsCtx(ctx, &resp, sqlQuery, args...); err != nil {
		return nil, err
	}
	return resp, nil
}

func (m *defaultSearchModel) SearchPublicUsers(ctx context.Context, query string, limit int64) ([]*SearchUser, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return []*SearchUser{}, nil
	}

	like := searchLike(query)
	sqlQuery := `
select ua.` + "`id`" + `, ua.` + "`username`" + `, ua.` + "`email`" + `, ua.` + "`role`" + `, ua.` + "`status`" + `, ua.` + "`created_at`" + `, ua.` + "`updated_at`" + `,
       up.` + "`nickname`" + `, up.` + "`avatar_asset_id`" + `, up.` + "`bio`" + `
from ` + "`user_account`" + ` ua
left join ` + "`user_profile`" + ` up on up.` + "`user_id`" + ` = ua.` + "`id`" + `
left join ` + "`entity_stat`" + ` es on es.` + "`target_type`" + ` = 'user_profile' and es.` + "`target_id`" + ` = up.` + "`id`" + `
where ua.` + "`status`" + ` = 'active'
  and ua.` + "`deleted_at`" + ` is null
  and (
    ua.` + "`username`" + ` like ?
    or up.` + "`nickname`" + ` like ?
    or up.` + "`bio`" + ` like ?
    or exists (
      select 1
      from ` + "`tagging`" + ` tg
      join ` + "`tag`" + ` t on t.` + "`id`" + ` = tg.` + "`tag_id`" + `
      where tg.` + "`target_type`" + ` = 'user_profile'
        and tg.` + "`target_id`" + ` = up.` + "`id`" + `
        and t.` + "`status`" + ` = 1
        and (t.` + "`name`" + ` like ? or t.` + "`slug`" + ` like ?)
    )
  )
order by
  case
    when ua.` + "`username`" + ` = ? then 0
    when up.` + "`nickname`" + ` = ? then 1
    when ua.` + "`username`" + ` like ? then 2
    else 5
  end asc,
  coalesce(es.` + "`view_count`" + `, 0) desc,
  ua.` + "`id`" + ` desc
limit ?`

	args := []any{like, like, like, like, like, query, query, query + "%", normalizeSearchLimit(limit)}
	var resp []*SearchUser
	if err := m.conn.QueryRowsCtx(ctx, &resp, sqlQuery, args...); err != nil {
		return nil, err
	}
	return resp, nil
}
