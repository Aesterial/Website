package user

import (
	"ascendant/backend/internal/domain/rank"
	"ascendant/backend/internal/gen/user/v1"
	"context"
	"time"
)

type Repository interface {
	GetList(ctx context.Context) ([]*user.UserSelf, error)
	GetUID(ctx context.Context, username string) (uint, error)
	GetUsername(ctx context.Context, uid uint) (string, error)
	GetEmail(ctx context.Context, uid uint) (*Email, error)
	GetRank(ctx context.Context, uid uint) (*rank.Rank, error)
	GetJoinedAT(ctx context.Context, uid uint) (*time.Time, error)
	GetSettings(ctx context.Context, uid uint) (*Settings, error)
	GetUserByUID(ctx context.Context, uid uint) (*User, error)
	GetUserByUsername(ctx context.Context, username string) (*User, error)
	GetUserSessionLiveTime(ctx context.Context, uid uint) (*SessionTime, error)
	UpdateDisplayName(ctx context.Context, uid uint, displayName string) error
	IsExists(ctx context.Context, user User) (bool, error)
}
