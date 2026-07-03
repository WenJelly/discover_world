package model

import "testing"

func TestUniquePositiveIDsKeepsOrderAndDropsDuplicates(t *testing.T) {
	got := uniquePositiveIDs([]uint64{0, 4, 2, 4, 0, 9, 2})
	want := []uint64{4, 2, 9}

	if len(got) != len(want) {
		t.Fatalf("uniquePositiveIDs length = %d, want %d: %#v", len(got), len(want), got)
	}
	for index := range want {
		if got[index] != want[index] {
			t.Fatalf("uniquePositiveIDs = %#v, want %#v", got, want)
		}
	}
}
