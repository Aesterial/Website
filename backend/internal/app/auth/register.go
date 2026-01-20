package login

import (
	domain "Aesterial/backend/internal/domain/login"
	apperrors "Aesterial/backend/internal/shared/errors"
	"Aesterial/backend/internal/infra/logger"
	"context"
)

func (s *Service) Register(ctx context.Context, required domain.RegisterRequire) (*uint, error) {
	if required.IsEmpty() {
		return nil, apperrors.RequiredDataMissing
	}
	var err error
	required.Password, err = GeneratePassword(required.Password)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "auth.register.hash")
		return nil, apperrors.Wrap(err)
	}
	uid, err := s.repo.Register(ctx, required)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "auth.register")
		return nil, apperrors.Wrap(err)
	}
	return uid, nil
}
