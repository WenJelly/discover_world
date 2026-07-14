package adminsupport

import (
	"context"
	"errors"
	"testing"

	"discover_world/internal/svc"
)

func TestTransactOperationRollsBackMutationWhenAuditFails(t *testing.T) {
	state := "before"
	rolledBack := false
	auditErr := errors.New("audit insert failed")

	transact := func(ctx context.Context, fn func(context.Context, *svc.ServiceContext) error) error {
		before := state
		err := fn(ctx, &svc.ServiceContext{})
		if err != nil {
			state = before
			rolledBack = true
		}
		return err
	}
	mutate := func(context.Context, *svc.ServiceContext) error {
		state = "after"
		return nil
	}
	audit := func(context.Context, *svc.ServiceContext) error {
		return auditErr
	}

	err := transactOperation(context.Background(), transact, mutate, audit)
	if !errors.Is(err, auditErr) {
		t.Fatalf("error = %v, want audit error", err)
	}
	if !rolledBack {
		t.Fatal("transaction did not roll back after audit failure")
	}
	if state != "before" {
		t.Fatalf("business state = %q, want rollback to before", state)
	}
}
