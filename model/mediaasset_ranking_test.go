package model

import (
	"os"
	"strings"
	"testing"
)

func TestMediaRankingCursorUsesOnlyPrecomputedScores(t *testing.T) {
	tests := []struct {
		name       string
		where      string
		wantColumn string
	}{
		{
			name:       "hot",
			where:      mustAppendHotCursorWhere(t),
			wantColumn: "er.`hot_score`",
		},
		{
			name:       "rising",
			where:      mustAppendRisingCursorWhere(t),
			wantColumn: "er.`rising_score`",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if !strings.Contains(tt.where, tt.wantColumn) {
				t.Fatalf("cursor where missing precomputed score %q in %s", tt.wantColumn, tt.where)
			}
			for _, forbidden := range []string{"entity_stat_hourly", "select es.", "timestampdiff"} {
				if strings.Contains(strings.ToLower(tt.where), forbidden) {
					t.Fatalf("cursor where must not recompute ranking with %q: %s", forbidden, tt.where)
				}
			}
			if strings.Contains(strings.ToLower(tt.where), "abs(") {
				t.Fatalf("cursor where must use indexable score equality, got %s", tt.where)
			}
			if !strings.Contains(tt.where, tt.wantColumn+" = ?") {
				t.Fatalf("cursor where missing exact score tie-break in %s", tt.where)
			}
		})
	}
}

func TestMediaRankingListSQLUsesRankingIndex(t *testing.T) {
	query, err := mediaRankingListSQL("hot_score", "`status` = 'active'")
	if err != nil {
		t.Fatalf("mediaRankingListSQL returned error: %v", err)
	}

	for _, fragment := range []string{
		"from `entity_ranking` er force index (`idx_entity_ranking_hot`)",
		"straight_join `media_asset`",
		"er.`target_type` = 'media_asset'",
		"order by er.`hot_score` desc, er.`target_id` desc",
	} {
		if !strings.Contains(query, fragment) {
			t.Fatalf("ranked media query missing %q in %s", fragment, query)
		}
	}
	for _, forbidden := range []string{"entity_stat_hourly", "timestampdiff", "order by ((("} {
		if strings.Contains(strings.ToLower(query), forbidden) {
			t.Fatalf("ranked media query must not calculate scores with %q: %s", forbidden, query)
		}
	}
}

func TestMediaRankingRefreshSQLAggregatesStatsBeforeServingQueries(t *testing.T) {
	query := mediaRankingRefreshSQL(10, 20)

	for _, fragment := range []string{
		"insert into `entity_ranking`",
		"left join `entity_stat` es",
		"left join (select esh.`target_id`",
		"from `entity_stat_hourly` esh",
		"group by esh.`target_id`",
		"on duplicate key update",
		"`hot_score` = values(`hot_score`)",
		"`rising_score` = values(`rising_score`)",
	} {
		if !strings.Contains(query, fragment) {
			t.Fatalf("ranking refresh query missing %q in %s", fragment, query)
		}
	}
	if got := strings.Count(query, "from `entity_stat_hourly` esh"); got != 1 {
		t.Fatalf("ranking refresh must aggregate hourly stats once, got %d scans in %s", got, query)
	}
}

func TestEntityRankingSchemaDefinesCursorOrderIndexes(t *testing.T) {
	data, err := os.ReadFile("../sql/create/entity_ranking.sql")
	if err != nil {
		t.Fatalf("read entity ranking schema: %v", err)
	}
	schema := string(data)

	for _, fragment := range []string{
		"`target_type`",
		"`target_id`",
		"`hot_score`",
		"`rising_score`",
		"UNIQUE KEY `uk_entity_ranking_target` (`target_type`, `target_id`)",
		"KEY `idx_entity_ranking_hot` (`target_type`, `hot_score` DESC, `target_id` DESC)",
		"KEY `idx_entity_ranking_rising` (`target_type`, `rising_score` DESC, `target_id` DESC)",
	} {
		if !strings.Contains(schema, fragment) {
			t.Fatalf("entity_ranking schema missing %q", fragment)
		}
	}
}

func mustAppendHotCursorWhere(t *testing.T) string {
	t.Helper()
	where, _ := appendHotCursorWhere("`status` = 'active'", 12.5, 99, nil)
	return where
}

func mustAppendRisingCursorWhere(t *testing.T) string {
	t.Helper()
	where, _ := appendRisingCursorWhere("`status` = 'active'", 8.25, 77, nil)
	return where
}
