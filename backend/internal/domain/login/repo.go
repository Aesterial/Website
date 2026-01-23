package login

import (
	"context"
	"github.com/google/uuid"
)

type Repository interface {
	Register(ctx context.Context, user RegisterRequire) (*uint, error)
	Authorization(ctx context.Context, user AuthorizationRequire) (*uint, error)
	Logout(ctx context.Context, sessionID uuid.UUID) error
	GetUIDByEmail(ctx context.Context, email string) (*uint, error)
	GetOAuthUID(ctx context.Context, service OAuthService, linkedID string) (*uint, error)
	LinkOAuth(ctx context.Context, service OAuthService, linkedID string, uid uint) error
}
