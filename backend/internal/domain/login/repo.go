package login

import (
	"context"
	"github.com/google/uuid"
)

type Repository interface {
	Register(ctx context.Context, user RegisterRequire) (*uint, error)
	Authorization(ctx context.Context, user AuthorizationRequire) (*uint, error)
	Logout(ctx context.Context, sessionID uuid.UUID) error
}
