package types

type CompressPictureType struct {
	CompressType int64 `json:"compressType,default=0"` // 0表示不压缩;1-表示等比例压缩;2-表示进一步等比例压缩;3-表示居中裁剪
	CutHeight    int64 `json:"CutHeight,optional"`     // 裁剪的长度；压缩类型=3时使用
	CutWidth     int64 `json:"cutWidth,optional"`      // 裁剪的宽度；压缩类型=3时使用
}

type AdminQueryPictureRequest struct {
	Id                  string              `json:"id,optional"`
	Name                string              `json:"name,optional"`
	Category            string              `json:"category,optional"`
	ReviewStatus        int64               `json:"reviewStatus,default=0"`
	Tags                []string            `json:"tags,optional"`
	PicSize             int64               `json:"picSize,optional"`
	PicWidth            int64               `json:"picWidth,optional"`
	PicHeight           int64               `json:"picHeight,optional"`
	PicScale            float64             `json:"picScale,optional"`
	PicFormat           string              `json:"picFormat,optional"`
	UserId              string              `json:"userId,optional"`
	ReviewMessage       string              `json:"reviewMessage,optional"`
	ReviewerId          string              `json:"reviewerId,optional"`
	EditTimeStart       string              `json:"editTimeStart,optional"`
	EditTimeEnd         string              `json:"editTimeEnd,optional"`
	SearchText          string              `json:"searchText,optional"`
	CompressPictureType CompressPictureType `json:"compressPictureType,optional"`
	PageNum             int64               `json:"pageNum,optional"`
	PageSize            int64               `json:"pageSize,optional"`
}

type QueryPictureRequest struct {
	Id                  string              `json:"id,optional"`
	Name                string              `json:"name,optional"`
	Category            string              `json:"category,optional"`
	ReviewStatus        int64               `json:"reviewStatus,default=1"`
	Tags                []string            `json:"tags,optional"`
	PicSize             int64               `json:"picSize,optional"`
	PicWidth            int64               `json:"picWidth,optional"`
	PicHeight           int64               `json:"picHeight,optional"`
	PicScale            float64             `json:"picScale,optional"`
	PicFormat           string              `json:"picFormat,optional"`
	UserId              string              `json:"userId,optional"`
	ReviewMessage       string              `json:"reviewMessage,optional"`
	ReviewerId          string              `json:"reviewerId,optional"`
	EditTimeStart       string              `json:"editTimeStart,optional"`
	EditTimeEnd         string              `json:"editTimeEnd,optional"`
	SearchText          string              `json:"searchText,optional"`
	CompressPictureType CompressPictureType `json:"compressPictureType,optional"`
	PageNum             int64               `json:"pageNum,optional"`
	PageSize            int64               `json:"pageSize,optional"`
}

type CursorQueryPictureRequest struct {
	Id                  string              `json:"id,optional"`
	Name                string              `json:"name,optional"`
	Category            string              `json:"category,optional"`
	ReviewStatus        int64               `json:"reviewStatus,default=1"`
	Tags                []string            `json:"tags,optional"`
	PicSize             int64               `json:"picSize,optional"`
	PicWidth            int64               `json:"picWidth,optional"`
	PicHeight           int64               `json:"picHeight,optional"`
	PicScale            float64             `json:"picScale,optional"`
	PicFormat           string              `json:"picFormat,optional"`
	UserId              string              `json:"userId,optional"`
	ReviewMessage       string              `json:"reviewMessage,optional"`
	ReviewerId          string              `json:"reviewerId,optional"`
	EditTimeStart       string              `json:"editTimeStart,optional"`
	EditTimeEnd         string              `json:"editTimeEnd,optional"`
	SearchText          string              `json:"searchText,optional"`
	CompressPictureType CompressPictureType `json:"compressPictureType,optional"`
	Cursor              string              `json:"cursor,optional"`
	PageSize            int64               `json:"pageSize,optional"`
}

type GetPictureRequest struct {
	Id                  string              `json:"id"`
	CompressPictureType CompressPictureType `json:"compressPictureType,optional"`
}

type DeletePictureRequest struct {
	Id string `json:"id"`
}

type ReviewPictureRequest struct {
	Id            string `json:"id"`
	ReviewStatus  int64  `json:"reviewStatus"`
	ReviewMessage string `json:"reviewMessage,optional"`
}

type PictureUploadRequest struct {
	Id           int64
	PicName      string
	Introduction string
	Category     string
	Tags         []string
}

type PictureUploadByUrlRequest struct {
	Id           string   `json:"id,optional"`
	FileUrl      string   `json:"fileUrl"`
	PicName      string   `json:"picName,optional"`
	Introduction string   `json:"introduction,optional"`
	Category     string   `json:"category,optional"`
	Tags         []string `json:"tags,optional"`
}

type UserDetail struct {
	Id          string `json:"id"`
	UserName    string `json:"userName"`
	UserAvatar  string `json:"userAvatar"`
	UserProfile string `json:"userProfile"`
	UserRole    string `json:"userRole"`
}

type PictureResponse struct {
	Id            string     `json:"id"`
	Url           string     `json:"url"`
	Name          string     `json:"name"`
	Introduction  string     `json:"introduction"`
	Category      string     `json:"category"`
	Tags          []string   `json:"tags"`
	PicSize       int64      `json:"picSize"`
	PicWidth      int64      `json:"picWidth"`
	PicHeight     int64      `json:"picHeight"`
	PicScale      float64    `json:"picScale"`
	PicFormat     string     `json:"picFormat"`
	UserId        string     `json:"userId"`
	User          UserDetail `json:"user"`
	CreateTime    string     `json:"createTime"`
	EditTime      string     `json:"editTime"`
	UpdateTime    string     `json:"updateTime"`
	ReviewStatus  int64      `json:"reviewStatus"`
	ReviewMessage string     `json:"reviewMessage"`
	ReviewerId    string     `json:"reviewerId"`
	ReviewTime    string     `json:"reviewTime"`
	ThumbnailUrl  string     `json:"thumbnailUrl"`
	PicColor      string     `json:"picColor"`
	BlurHash      string     `json:"blurHash"`
	ViewCount     int64      `json:"viewCount"`
	LikeCount     int64      `json:"likeCount"`
}

type PicturePageResponse struct {
	PageNum  int64             `json:"pageNum"`
	PageSize int64             `json:"pageSize"`
	Total    int64             `json:"total"`
	List     []PictureResponse `json:"list"`
}

type PictureCursorPageResponse struct {
	PageSize   int64             `json:"pageSize"`
	HasMore    bool              `json:"hasMore"`
	NextCursor string            `json:"nextCursor"`
	List       []PictureResponse `json:"list"`
}
