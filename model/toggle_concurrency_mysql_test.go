package model

import (
	"context"
	"fmt"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/zeromicro/go-zero/core/logx"
	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

const concurrentToggleRequests = 100

func TestReactionToggleStatusConcurrentRequestsKeepStatsConsistent(t *testing.T) {
	runConcurrentToggleConsistencyTest(t, "reaction")
}

func TestFavoriteToggleStatusConcurrentRequestsKeepStatsConsistent(t *testing.T) {
	runConcurrentToggleConsistencyTest(t, "favorite")
}

func runConcurrentToggleConsistencyTest(t *testing.T, toggleType string) {
	t.Helper()

	dsn := os.Getenv("DISCOVER_WORLD_TEST_MYSQL_DSN")
	if dsn == "" {
		t.Skip("set DISCOVER_WORLD_TEST_MYSQL_DSN to run the MySQL concurrency test")
	}
	logx.Disable()

	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()

	conn := sqlx.NewMysql(dsn)
	suffix := fmt.Sprintf("%d", time.Now().UnixNano())
	relationTable := fmt.Sprintf("toggle_%s_%s", toggleType, suffix)
	statTable := fmt.Sprintf("toggle_stat_%s_%s", toggleType, suffix)
	triggerName := fmt.Sprintf("toggle_delay_%s_%s", toggleType, suffix)

	t.Cleanup(func() {
		cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cleanupCancel()
		_, _ = conn.ExecCtx(cleanupCtx, fmt.Sprintf("drop trigger if exists `%s`", triggerName))
		_, _ = conn.ExecCtx(cleanupCtx, fmt.Sprintf("drop table if exists `%s`", relationTable))
		_, _ = conn.ExecCtx(cleanupCtx, fmt.Sprintf("drop table if exists `%s`", statTable))
	})
	createToggleConcurrencyTables(t, ctx, conn, toggleType, relationTable, statTable, triggerName)

	start := make(chan struct{})
	errs := make(chan error, concurrentToggleRequests)
	var wg sync.WaitGroup
	for range concurrentToggleRequests {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			errs <- conn.TransactCtx(ctx, func(ctx context.Context, session sqlx.Session) error {
				txConn := sqlx.NewSqlConnFromSession(session)
				var delta int64
				switch toggleType {
				case "reaction":
					reactionModel := NewReactionModel(txConn).(*customReactionModel)
					reactionModel.table = fmt.Sprintf("`%s`", relationTable)
					_, nextDelta, err := reactionModel.ToggleStatus(ctx, 1, "post", 42, "like")
					if err != nil {
						return err
					}
					delta = nextDelta
				case "favorite":
					favoriteModel := NewFavoriteModel(txConn).(*customFavoriteModel)
					favoriteModel.table = fmt.Sprintf("`%s`", relationTable)
					_, nextDelta, err := favoriteModel.ToggleStatus(ctx, 1, "post", 42)
					if err != nil {
						return err
					}
					delta = nextDelta
				default:
					return fmt.Errorf("unsupported toggle type %q", toggleType)
				}

				statModel := NewEntityStatModel(txConn).(*customEntityStatModel)
				statModel.table = fmt.Sprintf("`%s`", statTable)
				return statModel.IncrementCounter(ctx, "post", 42, toggleType+"_count", delta)
			})
		}()
	}
	close(start)
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatalf("concurrent %s toggle failed: %v", toggleType, err)
		}
	}

	var activeCount uint64
	reactionTypePredicate := ""
	if toggleType == "reaction" {
		reactionTypePredicate = " and `reaction_type` = 'like'"
	}
	countQuery := fmt.Sprintf("select count(*) from `%s` where `target_type` = 'post' and `target_id` = 42 and `status` = 1%s", relationTable, reactionTypePredicate)
	if err := conn.QueryRowCtx(ctx, &activeCount, countQuery); err != nil {
		t.Fatalf("count active %s rows: %v", toggleType, err)
	}

	var recordedCount uint64
	statQuery := fmt.Sprintf("select `%s_count` from `%s` where `target_type` = 'post' and `target_id` = 42", toggleType, statTable)
	if err := conn.QueryRowCtx(ctx, &recordedCount, statQuery); err != nil {
		t.Fatalf("query recorded %s count: %v", toggleType, err)
	}

	if activeCount != 10 {
		t.Fatalf("after %d toggles, active %s count = %d, want 10", concurrentToggleRequests, toggleType, activeCount)
	}
	if recordedCount != activeCount {
		t.Fatalf("%s count drifted: entity_stat=%d, active rows=%d", toggleType, recordedCount, activeCount)
	}
}

func createToggleConcurrencyTables(t *testing.T, ctx context.Context, conn sqlx.SqlConn, toggleType string, relationTable string, statTable string, triggerName string) {
	t.Helper()

	var relationDDL string
	switch toggleType {
	case "reaction":
		relationDDL = fmt.Sprintf(`create table %s (
  id bigint unsigned not null auto_increment,
  user_id bigint unsigned not null,
  target_type varchar(50) not null,
  target_id bigint unsigned not null,
  reaction_type varchar(30) not null,
  status tinyint not null default 1,
  created_at datetime not null default current_timestamp,
  updated_at datetime not null default current_timestamp on update current_timestamp,
  primary key (id),
  unique key uk_toggle_relation (user_id, target_type, target_id, reaction_type)
) engine=InnoDB`, "`"+relationTable+"`")
	case "favorite":
		relationDDL = fmt.Sprintf(`create table %s (
  id bigint unsigned not null auto_increment,
  user_id bigint unsigned not null,
  target_type varchar(50) not null,
  target_id bigint unsigned not null,
  status tinyint not null default 1,
  created_at datetime not null default current_timestamp,
  updated_at datetime not null default current_timestamp on update current_timestamp,
  primary key (id),
  unique key uk_toggle_relation (user_id, target_type, target_id)
) engine=InnoDB`, "`"+relationTable+"`")
	default:
		t.Fatalf("unsupported toggle type %q", toggleType)
	}

	statDDL := fmt.Sprintf(`create table %s (
  id bigint unsigned not null auto_increment,
  target_type varchar(50) not null,
  target_id bigint unsigned not null,
  reaction_count bigint unsigned not null default 0,
  favorite_count bigint unsigned not null default 0,
  primary key (id),
  unique key uk_toggle_stat (target_type, target_id)
) engine=InnoDB`, "`"+statTable+"`")

	for _, ddl := range []string{relationDDL, statDDL} {
		if _, err := conn.ExecCtx(ctx, ddl); err != nil {
			t.Fatalf("create MySQL concurrency fixture: %v", err)
		}
	}

	for userID := uint64(1); userID <= 10; userID++ {
		var seedSQL string
		if toggleType == "reaction" {
			seedSQL = fmt.Sprintf("insert into `%s` (`user_id`,`target_type`,`target_id`,`reaction_type`,`status`) values (?, 'post', 42, 'like', 1)", relationTable)
		} else {
			seedSQL = fmt.Sprintf("insert into `%s` (`user_id`,`target_type`,`target_id`,`status`) values (?, 'post', 42, 1)", relationTable)
		}
		if _, err := conn.ExecCtx(ctx, seedSQL, userID); err != nil {
			t.Fatalf("seed active %s row: %v", toggleType, err)
		}
	}

	statSeedSQL := fmt.Sprintf("insert into `%s` (`target_type`,`target_id`,`%s_count`) values ('post', 42, 10)", statTable, toggleType)
	if _, err := conn.ExecCtx(ctx, statSeedSQL); err != nil {
		t.Fatalf("seed %s stats: %v", toggleType, err)
	}

	triggerDDL := fmt.Sprintf("create trigger `%s` before update on `%s` for each row do sleep(0.02)", triggerName, relationTable)
	if _, err := conn.ExecCtx(ctx, triggerDDL); err != nil {
		t.Fatalf("create %s concurrency trigger: %v", toggleType, err)
	}
}
