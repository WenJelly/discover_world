package post

import "strings"

func qualifiedRows(rows, alias string) string {
	fields := strings.Split(rows, ",")
	for index, field := range fields {
		fields[index] = alias + "." + strings.TrimSpace(field)
	}
	return strings.Join(fields, ",")
}
