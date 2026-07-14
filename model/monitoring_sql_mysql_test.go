package model

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

func TestMonitoringChecksSQLAgainstMySQL(t *testing.T) {
	validateReadOnlySQLFile(t, "../sql/monitoring_checks.sql")
}

func TestMediaRankingExplainSQLAgainstMySQL(t *testing.T) {
	validateReadOnlySQLFile(t, "../sql/benchmark/media_ranking_explain.sql")
}

func validateReadOnlySQLFile(t *testing.T, path string) {
	t.Helper()
	dsn := os.Getenv("DISCOVER_WORLD_BENCHMARK_MYSQL_DSN")
	if dsn == "" {
		t.Skip("set DISCOVER_WORLD_BENCHMARK_MYSQL_DSN to validate read-only SQL")
	}

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}

	conn := sqlx.NewMysql(dsn)
	db, err := conn.RawDB()
	if err != nil {
		t.Fatalf("open MySQL: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	var version string
	if err := db.QueryRowContext(ctx, "select version()").Scan(&version); err != nil {
		t.Fatalf("query MySQL version: %v", err)
	}
	t.Logf("mysql version=%s", version)
	for index, statement := range monitoringSQLStatements(string(data)) {
		t.Run(fmt.Sprintf("statement_%d", index+1), func(t *testing.T) {
			rows, err := db.QueryContext(ctx, statement)
			if err != nil {
				t.Fatalf("execute %s: %v\n%s", path, err, statement)
			}
			if err := rows.Close(); err != nil {
				t.Fatalf("close %s rows: %v", path, err)
			}
		})
	}
}

func monitoringSQLStatements(source string) []string {
	parts := strings.Split(source, ";")
	statements := make([]string, 0, len(parts))
	for _, part := range parts {
		lines := strings.Split(part, "\n")
		queryLines := lines[:0]
		for _, line := range lines {
			if strings.HasPrefix(strings.TrimSpace(line), "--") {
				continue
			}
			queryLines = append(queryLines, line)
		}
		statement := strings.TrimSpace(strings.Join(queryLines, "\n"))
		if statement != "" {
			statements = append(statements, statement)
		}
	}
	return statements
}
