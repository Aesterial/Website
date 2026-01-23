package verification

import (
	"context"
	"time"
)

type Repository interface {
	Create(ctx context.Context, email string, purpose Purpose, ip string, userAgent string, ttl time.Duration) (token string, err error)
	Consume(ctx context.Context, purpose Purpose, token string) (*TokenRecord, error)
	BanEmail(ctx context.Context, email string, reason string) error
	IsBanned(ctx context.Context, email string) (bool, error)
	GetRecord(ctx context.Context, purpose Purpose, token string) (*TokenRecord, error)
	EmailExists(ctx context.Context, email string) (bool, error)
}
