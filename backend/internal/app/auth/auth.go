package login

import (
	domain "ascendant/backend/internal/domain/login"
	"ascendant/backend/internal/infra/logger"
	apperrors "ascendant/backend/internal/shared/errors"
	"context"
	"net/http"
	"strconv"
)

func (s *Service) Authorization(ctx context.Context, required domain.AuthorizationRequire) (*uint, error) {
	if required.IsEmpty() {
		logger.Debug("received login: "+required.Usermail+" | received password: "+required.Password, "service.authorization")
		return nil, apperrors.BuildError(strconv.Itoa(http.StatusBadRequest), "required body is empty", nil, "")
	}
	return s.repo.Authorization(ctx, required)
}
