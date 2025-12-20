package sessions

import (
	"context"

	"github.com/google/uuid"
)

type Repository interface {
	IsValid(ctx context.Context, sessionID uuid.UUID) bool
	GetSessions(ctx context.Context, uid uint) ([]*Session, error)
}
