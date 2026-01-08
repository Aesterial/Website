package user

import (
	"ascendant/backend/internal/domain/rank"
	userpb "ascendant/backend/internal/gen/user/v1"
	"database/sql"
	"strings"
	"time"

	"github.com/google/uuid"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type Email struct {
	Address  string
	Verified bool
}

type Avatar struct {
	ContentType string
	Key         string
	SizeBytes   int
	Updated     time.Time
}

func (a *Avatar) ToPublic() *userpb.Avatar {
	if a == nil {
		return nil
	}
	avatar := &userpb.Avatar{
		ContentType: a.ContentType,
	}
	if strings.TrimSpace(a.Key) != "" {
		avatar.Key = a.Key
	}
	return avatar
}

type Avatars []*Avatar

func (a Avatars) ToProto() []*userpb.Avatar {
	var pbs []*userpb.Avatar
	for _, avatar := range a {
		pbs = append(pbs, avatar.ToPublic())
	}
	return pbs
}

type SessionTime struct {
	Text     string
	Duration time.Duration
}

type Settings struct {
	DisplayName     *string
	Avatar          *Avatar
	Password        *string
	SessionLiveTime int
}

type User struct {
	UID      uint
	Username string
	Email    *Email
	Settings *Settings
	Rank     *rank.Rank
	Banned   bool
	Joined   time.Time
}

type Users []*User

func (u User) ToPublic() *userpb.UserPublic {
	rankExpires := func() *timestamppb.Timestamp {
		if u.Rank.Expires == nil {
			return nil
		}
		return timestamppb.New(*u.Rank.Expires)
	}
	var avatar *userpb.Avatar
	if u.Settings != nil && u.Settings.Avatar != nil {
		avatar = u.Settings.Avatar.ToPublic()
	}
	var displayName *string
	if u.Settings != nil {
		displayName = u.Settings.DisplayName
	}
	return &userpb.UserPublic{
		UserID:   uint32(u.UID),
		Username: u.Username,
		Rank:     &userpb.Rank{Name: u.Rank.Name, Expires: rankExpires()},
		Settings: &userpb.UserPublicSettings{
			DisplayName: displayName,
			Avatar:      avatar,
		},
		Banned:   u.Banned,
		JoinedAt: timestamppb.New(u.Joined),
	}
}

func (u Users) ToPublic() []*userpb.UserPublic {
	var list []*userpb.UserPublic
	for _, user := range u {
		if user == nil {
			continue
		}
		list = append(list, user.ToPublic())
	}
	return list
}

type RequestData struct {
	SessionID uuid.UUID
	UID       uint
}

type BanInfo struct {
	ID       uuid.UUID
	Executor uint
	Target   uint
	Reason   string
	At       time.Time
	Expire   time.Time
	Expires  sql.NullTime
}

func (b BanInfo) Empty() bool {
	return b.Executor == 0 || b.Reason == ""
}
