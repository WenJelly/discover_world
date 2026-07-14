package svc

import "github.com/zeromicro/go-zero/core/stores/sqlx"

type ModelSet struct {
	Account      AccountModels
	Admin        AdminModels
	Follow       FollowModels
	Forum        ForumModels
	Homepage     HomepageModels
	Interaction  InteractionModels
	Media        MediaModels
	Moderation   ModerationModels
	Notification NotificationModels
	Post         PostModels
	Profile      ProfileModels
	Search       SearchModels
	Statistics   StatisticsModels
	Taxonomy     TaxonomyModels
}

func newModelSet(conn sqlx.SqlConn) ModelSet {
	return ModelSet{
		Account:      newAccountModels(conn),
		Admin:        newAdminModels(conn),
		Follow:       newFollowModels(conn),
		Forum:        newForumModels(conn),
		Homepage:     newHomepageModels(conn),
		Interaction:  newInteractionModels(conn),
		Media:        newMediaModels(conn),
		Moderation:   newModerationModels(conn),
		Notification: newNotificationModels(conn),
		Post:         newPostModels(conn),
		Profile:      newProfileModels(conn),
		Search:       newSearchModels(conn),
		Statistics:   newStatisticsModels(conn),
		Taxonomy:     newTaxonomyModels(conn),
	}
}
