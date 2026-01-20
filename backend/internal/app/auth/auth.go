package login

import (
	domain "Aesterial/backend/internal/domain/login"
	"Aesterial/backend/internal/infra/logger"
	apperrors "Aesterial/backend/internal/shared/errors"
	"context"
)

func (s *Service) Authorization(ctx context.Context, required domain.AuthorizationRequire) (*uint, error) {
	if required.IsEmpty() {
		logger.Debug("received login: "+required.Usermail+" | received password: "+required.Password, "service.authorization")
		return nil, apperrors.RequiredDataMissing
	}
	uid, err := s.repo.Authorization(ctx, required)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "auth.authorization")
		return nil, apperrors.Wrap(err)
	}
	return uid, nil
}
