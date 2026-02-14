package notifications

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Repository interface {
	GetAll(ctx context.Context) (Notifications, error)
	ForUser(ctx context.Context, id uint) (*Notification, error)
	Create(ctx context.Context, scope string, body string, receiver *string, expires *time.Time) error
	Mark(ctx context.Context, id uuid.UUID) error
}
