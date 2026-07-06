package media

import (
	"fmt"
	"strings"

	"discover_world/model"
)

const (
	deleteReferenceOwnerPost        = "post"
	deleteReferenceOwnerAlbum       = "album"
	deleteReferenceOwnerUserProfile = "user_profile"
	deleteReferenceOwnerSiteHome    = "site_home"

	deleteReferenceRoleAttachment = "attachment"
	deleteReferenceRoleFeatured   = "featured"
	deleteReferenceRoleAlbumItem  = "album_item"
	deleteReferenceRoleCover      = "cover"
)

type mediaDeleteReferenceSummary struct {
	postLabels     []string
	blockingLabels []string
}

func buildMediaDeleteReferenceSummary(links []*model.AssetLink) mediaDeleteReferenceSummary {
	summary := mediaDeleteReferenceSummary{}
	seen := make(map[string]struct{}, len(links))

	for _, link := range links {
		if link == nil || link.Status != 1 {
			continue
		}

		label := mediaDeleteReferenceLabel(link)
		key := link.OwnerType + "|" + fmt.Sprint(link.OwnerId) + "|" + link.LinkRole
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}

		if isPostAttachmentReference(link) {
			summary.postLabels = append(summary.postLabels, label)
			continue
		}
		summary.blockingLabels = append(summary.blockingLabels, label)
	}

	return summary
}

func (s mediaDeleteReferenceSummary) hasBlockingReferences() bool {
	return len(s.blockingLabels) > 0
}

func (s mediaDeleteReferenceSummary) hasPostReferences() bool {
	return len(s.postLabels) > 0
}

func (s *mediaDeleteReferenceSummary) addBlockingLabels(labels ...string) {
	if s == nil || len(labels) == 0 {
		return
	}
	for _, label := range labels {
		label = strings.TrimSpace(label)
		if label == "" {
			continue
		}
		s.blockingLabels = append(s.blockingLabels, label)
	}
}

func (s mediaDeleteReferenceSummary) requiresForceConfirmation() bool {
	return !s.hasBlockingReferences() && s.hasPostReferences()
}

func (s mediaDeleteReferenceSummary) forceConfirmationMessage() string {
	return "该媒体已被动态引用：" + strings.Join(s.postLabels, "、") + "。删除后会从这些动态中移除该图片，是否继续删除？"
}

func (s mediaDeleteReferenceSummary) blockingMessage() string {
	labels := make([]string, 0, len(s.blockingLabels)+len(s.postLabels))
	labels = append(labels, s.blockingLabels...)
	labels = append(labels, s.postLabels...)
	return "该媒体正在被以下位置引用，不能直接删除：" + strings.Join(labels, "、") + "。请先到对应位置取消精选、相册、头像等引用后再删除。"
}

func isPostAttachmentReference(link *model.AssetLink) bool {
	return link != nil && link.OwnerType == deleteReferenceOwnerPost && link.LinkRole == deleteReferenceRoleAttachment
}

func mediaDeleteReferenceLabel(link *model.AssetLink) string {
	if link == nil {
		return "未知引用"
	}

	switch {
	case link.OwnerType == deleteReferenceOwnerPost && link.LinkRole == deleteReferenceRoleAttachment:
		return fmt.Sprintf("动态 #%d", link.OwnerId)
	case link.OwnerType == deleteReferenceOwnerUserProfile && link.LinkRole == deleteReferenceRoleFeatured:
		return fmt.Sprintf("个人主页精选 #%d", link.OwnerId)
	case link.OwnerType == deleteReferenceOwnerSiteHome && link.LinkRole == deleteReferenceRoleFeatured:
		return fmt.Sprintf("首页精选 #%d", link.OwnerId)
	case link.OwnerType == deleteReferenceOwnerAlbum && link.LinkRole == deleteReferenceRoleAlbumItem:
		return fmt.Sprintf("相册 #%d", link.OwnerId)
	case link.OwnerType == deleteReferenceOwnerAlbum && link.LinkRole == deleteReferenceRoleCover:
		return fmt.Sprintf("相册封面 #%d", link.OwnerId)
	default:
		return fmt.Sprintf("%s/%s #%d", link.OwnerType, link.LinkRole, link.OwnerId)
	}
}

func buildDirectMediaDeleteReferenceLabels(profiles []*model.UserProfile, albums []*model.Album) []string {
	labels := make([]string, 0, len(profiles)+len(albums))
	for _, profile := range profiles {
		if profile == nil || profile.UserId == 0 {
			continue
		}
		labels = append(labels, fmt.Sprintf("用户头像 #%d", profile.UserId))
	}
	for _, album := range albums {
		if album == nil || album.Id == 0 {
			continue
		}
		labels = append(labels, fmt.Sprintf("相册封面 #%d", album.Id))
	}
	return labels
}
