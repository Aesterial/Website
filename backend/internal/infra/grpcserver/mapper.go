package grpcserver

import (
	"ascendant/backend/internal/domain/permissions"
	"ascendant/backend/internal/domain/rank"
	"ascendant/backend/internal/domain/sessions"
	"ascendant/backend/internal/domain/user"
	permspb "ascendant/backend/internal/gen/permissions/v1"
	userpb "ascendant/backend/internal/gen/user/v1"
	"strings"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"
)

func toProtoUserPublic(u *user.User) *userpb.UserPublic {
	if u == nil {
		return nil
	}
	return &userpb.UserPublic{
		UserID:   uint32(u.UID),
		Username: u.Username,
		Rank:     toProtoRank(u.Rank),
		Settings: toProtoUserSettings(u.Settings),
		JoinedAt: toProtoTimestamp(u.Joined),
	}
}

func toProtoUserSelf(u *user.User) *userpb.UserSelf {
	if u == nil {
		return nil
	}
	self := &userpb.UserSelf{
		Public: toProtoUserPublic(u),
	}
	if u.Email != nil {
		self.Email = &userpb.UserEmail{
			Address:  u.Email.Address,
			Verified: u.Email.Verified,
		}
	}
	return self
}

func toProtoRank(r *rank.Rank) *userpb.Rank {
	if r == nil {
		return nil
	}
	out := &userpb.Rank{
		Name: r.Name,
	}
	if r.Expires != nil {
		out.Expires = timestamppb.New(*r.Expires)
	}
	return out
}

func toProtoUserSettings(s *user.Settings) *userpb.UserPublicSettings {
	if s == nil {
		return nil
	}
	out := &userpb.UserPublicSettings{}
	if s.DisplayName != nil {
		out.DisplayName = s.DisplayName
	}
	if s.Avatar != nil {
		out.Avatar = toProtoAvatar(s.Avatar)
	}
	return out
}

func toProtoAvatar(a *user.Avatar) *userpb.Avatar {
	if a == nil {
		return nil
	}
	avatar := &userpb.Avatar{
		ContentType: a.ContentType,
	}
	if strings.TrimSpace(a.Key) != "" {
		avatar.Key = a.Key
	}
	if len(avatar.Data) == 0 && avatar.Key == "" && strings.TrimSpace(avatar.ContentType) == "" {
		return nil
	}
	return avatar
}

func fromProtoAvatar(a *userpb.Avatar) *user.Avatar {
	if a == nil {
		return nil
	}
	avatar := &user.Avatar{
		ContentType: a.ContentType,
		Key:         a.Key,
		SizeBytes:   len(a.Data),
	}
	if strings.TrimSpace(a.Key) != "" {
		avatar.Key = strings.TrimSpace(a.Key)
	}
	return avatar
}

func toProtoUserSessions(sessionsList []*sessions.Session) *userpb.UserSessions {
	resp := &userpb.UserSessions{}
	for _, s := range sessionsList {
		if s == nil {
			continue
		}
		resp.Sessions = append(resp.Sessions, &userpb.Session{
			Uuid:     s.ID.String(),
			Uid:      uint32(s.UID),
			Created:  toProtoTimestamp(s.Created),
			LastSeen: toProtoTimestamp(s.LastSeenAt),
			Expires:  toProtoTimestamp(s.Expires),
		})
	}
	return resp
}

func toProtoTimestamp(t time.Time) *timestamppb.Timestamp {
	if t.IsZero() {
		return nil
	}
	return timestamppb.New(t)
}

func toProtoPermissions(p *permissions.Permissions) *permspb.Permissions {
	if p == nil {
		return nil
	}
	return &permspb.Permissions{
		ViewOtherProfile:     p.ViewOtherProfile,
		PatchOtherProfile:    p.PatchOtherProfile,
		PatchSelfProfile:     p.PatchSelfProfile,
		DeleteSelfProfile:    p.DeleteSelfProfile,
		BanProfile:           p.BanProfile,
		UnbanProfile:         p.UnBanProfile,
		CreateIdea:           p.CreateIdea,
		PatchSelfIdea:        p.PatchSelfIdea,
		DeleteSelfIdea:       p.DeleteSelfIdea,
		CreateComment:        p.CreateComment,
		PatchSelfComment:     p.PatchSelfComment,
		DeleteSelfComment:    p.DeleteSelfComment,
		DeleteOtherComment:   p.DeleteOtherComment,
		UploadIdeaMediaSelf:  p.UploadIdeaMediaSelf,
		DeleteIdeaMediaSelf:  p.DeleteIdeaMediaSelf,
		DeleteIdeaMediaOther: p.DeleteIdeaMediaOther,
		ModerateIdea:         p.ModerateIdea,
		PatchIdeaStatus:      p.PatchIdeaStatusAdmin,
		ViewStatistics:       p.ViewStatistics,
		ViewPermissions:      p.ViewPermissions,
		ManagePermissions:    p.ManagePermissions,
	}
}

func mergePermissions(base *permissions.Permissions, in *permspb.Permissions) *permissions.Permissions {
	if base == nil {
		base = &permissions.Permissions{}
	}
	if in == nil {
		return base
	}
	base.ViewOtherProfile = in.ViewOtherProfile
	base.PatchOtherProfile = in.PatchOtherProfile
	base.PatchSelfProfile = in.PatchSelfProfile
	base.DeleteSelfProfile = in.DeleteSelfProfile
	base.BanProfile = in.BanProfile
	base.UnBanProfile = in.UnbanProfile
	base.CreateIdea = in.CreateIdea
	base.PatchSelfIdea = in.PatchSelfIdea
	base.DeleteSelfIdea = in.DeleteSelfIdea
	base.CreateComment = in.CreateComment
	base.PatchSelfComment = in.PatchSelfComment
	base.DeleteSelfComment = in.DeleteSelfComment
	base.DeleteOtherComment = in.DeleteOtherComment
	base.UploadIdeaMediaSelf = in.UploadIdeaMediaSelf
	base.DeleteIdeaMediaSelf = in.DeleteIdeaMediaSelf
	base.DeleteIdeaMediaOther = in.DeleteIdeaMediaOther
	base.ModerateIdea = in.ModerateIdea
	base.PatchIdeaStatusAdmin = in.PatchIdeaStatus
	base.ViewStatistics = in.ViewStatistics
	base.ViewPermissions = in.ViewPermissions
	base.ManagePermissions = in.ManagePermissions
	return base
}

func errorContains(err error, req string) bool {
	return strings.Contains(strings.ToLower(strings.TrimSpace(err.Error())), req)
}
