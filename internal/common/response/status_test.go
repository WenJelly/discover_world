package response

import (
	"errors"
	"net/http"
	"testing"
)

type internalMessageError struct{}

func (internalMessageError) Error() string   { return "table media_asset column secret_token" }
func (internalMessageError) Message() string { return "internal message must stay private" }

func TestErrorBodyHidesUnknownInternalError(t *testing.T) {
	statusCode, body := ErrorBody(errors.New("mysql: duplicate entry for key secret_token"))

	if statusCode != http.StatusInternalServerError {
		t.Fatalf("status code = %d, want %d", statusCode, http.StatusInternalServerError)
	}
	if body.Code != InternalServerErrorCode.Code() {
		t.Fatalf("body code = %d, want %d", body.Code, InternalServerErrorCode.Code())
	}
	if body.Message != InternalServerErrorCode.Message() {
		t.Fatalf("body message = %q, want %q", body.Message, InternalServerErrorCode.Message())
	}
}

func TestMessageFromErrorOnlyTrustsStatusError(t *testing.T) {
	if got := MessageFromError(internalMessageError{}); got != InternalServerErrorCode.Message() {
		t.Fatalf("unknown message error exposed %q", got)
	}

	publicErr := BadRequest("公开业务提示")
	if got := MessageFromError(publicErr); got != "公开业务提示" {
		t.Fatalf("status error message = %q, want public business message", got)
	}
}
