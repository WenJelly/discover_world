package model

import (
	"errors"
	"testing"

	"github.com/go-sql-driver/mysql"
)

func TestIsMissingTableErrorRecognizesMySQL1146(t *testing.T) {
	err := &mysql.MySQLError{Number: 1146, Message: "Table 'discover_world.site_config' doesn't exist"}

	if !isMissingTableError(err) {
		t.Fatal("expected MySQL 1146 to be recognized as a missing table error")
	}
}

func TestIsMissingTableErrorRecognizesWrappedMySQL1146(t *testing.T) {
	err := errors.Join(errors.New("query site config"), &mysql.MySQLError{Number: 1146})

	if !isMissingTableError(err) {
		t.Fatal("expected wrapped MySQL 1146 to be recognized as a missing table error")
	}
}

func TestIsMissingTableErrorRejectsOtherErrors(t *testing.T) {
	if isMissingTableError(&mysql.MySQLError{Number: 1062}) {
		t.Fatal("duplicate key must not be treated as missing table")
	}

	if isMissingTableError(errors.New("plain error")) {
		t.Fatal("plain error must not be treated as missing table")
	}
}
