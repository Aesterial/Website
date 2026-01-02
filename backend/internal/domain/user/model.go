package user

import (
	"ascendant/backend/internal/domain/rank"
	userpb "ascendant/backend/internal/gen/user/v1"
	"database/sql"
	"time"

	"github.com/google/uuid"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type Email struct {
	Address  string
	Verified bool
}

type Avatar struct {
	ContentType sql.NullString
	Data        []byte
	Width       sql.NullInt32
	Height      sql.NullInt32
	SizeBytes   sql.NullInt32
	Updated     sql.NullTime
}

func (a *Avatar) ToPublic() *userpb.Avatar {
	if a == nil {
		return nil
	}
	var avatar userpb.Avatar
	avatar.ContentType = a.ContentType.String
	avatar.Data = a.Data
	return &avatar
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
	Joined   time.Time
}

func (u User) ToPublic() *userpb.UserPublic {
	rank_expires := func() *timestamppb.Timestamp {
		if u.Rank.Expires == nil {
			return nil
		}
		return timestamppb.New(*u.Rank.Expires)
	}
	return &userpb.UserPublic{
		UserID:   uint32(u.UID),
		Username: u.Username,
		Rank:     &userpb.Rank{Name: u.Rank.Name, Expires: rank_expires()},
		Settings: &userpb.UserPublicSettings{
			DisplayName: u.Settings.DisplayName,
			Avatar:      u.Settings.Avatar.ToPublic(),
		},
		JoinedAt: timestamppb.New(u.Joined),
	}
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
