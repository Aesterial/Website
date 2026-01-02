package login

import (
	"context"
	"errors"

	"github.com/google/uuid"
)

func (s *Service) Logout(ctx context.Context, sessionID uuid.UUID) error {
	if sessionID == uuid.Nil {
		return errors.New("sessionID is nil")
	}
	return s.repo.Logout(ctx, sessionID)
}
