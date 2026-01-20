package login

import (
	"context"
	apperrors "Aesterial/backend/internal/shared/errors"
	"Aesterial/backend/internal/infra/logger"

	"github.com/google/uuid"
)

func (s *Service) Logout(ctx context.Context, sessionID uuid.UUID) error {
	if sessionID == uuid.Nil {
		return apperrors.InvalidArguments
	}
	if err := s.repo.Logout(ctx, sessionID); err != nil {
		logger.Debug("error appeared: "+err.Error(), "auth.logout")
		return apperrors.Wrap(err)
	}
	return nil
}
