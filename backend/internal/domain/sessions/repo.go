package sessions

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Repository interface {
	IsValid(ctx context.Context, sessionID uuid.UUID) (bool, error)
	GetSession(ctx context.Context, sessionID uuid.UUID) (*Session, error)
	GetSessions(ctx context.Context, uid uint) (*Sessions, error)
	GetUID(ctx context.Context, sessionID uuid.UUID) (*uint, error)
	SetRevoked(ctx context.Context, sessionID uuid.UUID) error
	SetMFACompleted(ctx context.Context, sessionID uuid.UUID) error
	ResetMFAs(ctx context.Context, uid uint) error
	AddSession(ctx context.Context, sessionID uuid.UUID, agentHash string, expires time.Time, uid uint) error
	UpdateLastSeen(ctx context.Context, sessionID uuid.UUID) error
}
