package svc

import "testing"

func TestModelSetContainsEveryModule(t *testing.T) {
	models := ModelSet{}
	_ = models.Account
	_ = models.Admin
	_ = models.Follow
	_ = models.Forum
	_ = models.Homepage
	_ = models.Interaction
	_ = models.Media
	_ = models.Moderation
	_ = models.Notification
	_ = models.Post
	_ = models.Profile
	_ = models.Search
	_ = models.Statistics
	_ = models.Taxonomy
}
