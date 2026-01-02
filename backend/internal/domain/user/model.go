package user

import (
	"ascendant/backend/internal/domain/rank"
	"database/sql"
	"time"

	"github.com/google/uuid"
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
	Expires  sql.NullTime
}

func (b BanInfo) Empty() bool {
	return b.Executor == 0 || b.Target == 0 || b.Reason == "" || b.Expires.Time.IsZero()
}
