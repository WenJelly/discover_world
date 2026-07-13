package types

import (
	"reflect"
	"testing"
)

func TestContentWriteRequestsDoNotExposeLocation(t *testing.T) {
	requests := []any{
		CreatePostRequest{},
		UpdatePostRequest{},
		CreateForumPostRequest{},
	}
	for _, request := range requests {
		typeOf := reflect.TypeOf(request)
		if _, ok := typeOf.FieldByName("Location"); ok {
			t.Fatalf("%s still exposes a user-provided Location field", typeOf.Name())
		}
	}
}
