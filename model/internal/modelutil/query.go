package modelutil

import "strings"

func UniquePositiveIDs(ids []uint64) []uint64 {
	if len(ids) == 0 {
		return nil
	}

	seen := make(map[uint64]struct{}, len(ids))
	result := make([]uint64, 0, len(ids))
	for _, id := range ids {
		if id == 0 {
			continue
		}
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		result = append(result, id)
	}
	return result
}

func InPlaceholders(count int) string {
	if count <= 0 {
		return ""
	}

	parts := make([]string, count)
	for index := range parts {
		parts[index] = "?"
	}
	return strings.Join(parts, ",")
}
