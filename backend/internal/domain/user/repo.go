package user

import (
	"ascendant/backend/internal/domain/rank"
	"context"
	"time"
)

type Repository interface {
	GetUID(ctx context.Context, username string) (uint, error)
	GetUsername(ctx context.Context, uid uint) (string, error)
	GetEmail(ctx context.Context, uid uint) (*Email, error)
	GetRank(ctx context.Context, uid uint) (*rank.Rank, error)
	GetJoinedAT(ctx context.Context, uid uint) (*time.Time, error)
	GetSettings(ctx context.Context, uid uint) (*Settings, error)
	GetUserByUID(ctx context.Context, uid uint) (*User, error)
	GetUserByUsername(ctx context.Context, username string) (*User, error)
	IsExists(ctx context.Context, user User) (bool, error)
	Register(ctx context.Context, user User) error
	Authorize(ctx context.Context, user User) error
}
