package submissions

import (
	submpb "ascendant/backend/internal/gen/submissions/v1"
	"context"

	"github.com/google/uuid"
)

type Repository interface {
	GetList(ctx context.Context) ([]*submpb.ListResponseTarget, error)
	GetActive(ctx context.Context) ([]*submpb.ListResponseTarget, error)
	Approve(ctx context.Context, id uuid.UUID) error
	Decline(ctx context.Context, id uuid.UUID, reason string) error
}
