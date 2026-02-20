package notifications

import (
	notifypb "Aesterial/backend/internal/gen/notifications/v1"
	"context"
	"time"

	"github.com/google/uuid"
)

type Repository interface {
	GetAll(ctx context.Context) (Notifications, error)
	ForUser(ctx context.Context, id uint, rank string, shown bool) (Notifications, error)
	Create(ctx context.Context, scope notifypb.Scope, body string, receiver *string, expires *time.Time) error
	Mark(ctx context.Context, id uuid.UUID, uid uint) error
}
