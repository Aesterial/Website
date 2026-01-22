package grpcserver

import (
	"Aesterial/backend/internal/domain/sessions"
	"Aesterial/backend/internal/domain/user"
	userpb "Aesterial/backend/internal/gen/user/v1"
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
		Rank:     u.Rank.ToProtoUser(),
		Settings: u.Settings.ToPublic(),
		Banned:   u.Banned,
		JoinedAt: timestamppb.New(u.Joined),
	}
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
	if avatar.Key == "" && strings.TrimSpace(avatar.ContentType) == "" {
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
		SizeBytes:   0,
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

func errorContains(err error, req string) bool {
	return strings.Contains(strings.ToLower(strings.TrimSpace(err.Error())), req)
}
