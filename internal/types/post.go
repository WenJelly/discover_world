// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package types

type CreatePostRequest struct {
	Content    string   `json:"content,optional"`
	Visibility string   `json:"visibility,optional"`
	Location   string   `json:"location,optional"`
	ImageIds   []string `json:"imageIds,optional"`
}

type UpdatePostRequest struct {
	Id         string   `json:"id"`
	Content    string   `json:"content,optional"`
	Visibility string   `json:"visibility,optional"`
	Location   string   `json:"location,optional"`
	ImageIds   []string `json:"imageIds,optional"`
}

type DeletePostRequest struct {
	Id string `json:"id"`
}

type GetPostDetailRequest struct {
	Id string `json:"id"`
}

type PinPostRequest struct {
	Id string `json:"id"`
}

type UnpinPostRequest struct {
	Id string `json:"id"`
}

type TogglePostReactionRequest struct {
	Id           string `json:"id"`
	ReactionType string `json:"reactionType,optional"`
}

type TogglePostFavoriteRequest struct {
	Id string `json:"id"`
}

type PostToggleResponse struct {
	Active bool            `json:"active"`
	Stats  MediaAssetStats `json:"stats"`
}

type CreatePostCommentRequest struct {
	PostId  string `json:"postId"`
	Content string `json:"content"`
}

type PostCommentCursorListRequest struct {
	PostId   string `json:"postId"`
	Cursor   string `json:"cursor,optional"`
	PageSize int64  `json:"pageSize,optional"`
}

type PostCommentResponse struct {
	Id        string         `json:"id"`
	PostId    string         `json:"postId"`
	UserId    string         `json:"userId"`
	Author    AccountSummary `json:"author"`
	Content   string         `json:"content"`
	Status    string         `json:"status"`
	CreatedAt string         `json:"createdAt"`
	UpdatedAt string         `json:"updatedAt"`
}

type PostCommentCursorPageResponse struct {
	PageSize   int64                 `json:"pageSize"`
	HasMore    bool                  `json:"hasMore"`
	NextCursor string                `json:"nextCursor"`
	List       []PostCommentResponse `json:"list"`
}
