package login

import (
	domain "ascendant/backend/internal/domain/login"
	apperrors "ascendant/backend/internal/shared/errors"
	"context"
	"net/http"
	"strconv"
)

func (s *Service) Authorization(ctx context.Context, required domain.AuthorizationRequire) (*int, error) {
	if required.IsEmpty() {
		return nil, apperrors.BuildError(strconv.Itoa(http.StatusBadRequest), "required body is empty", nil, "")
	}
	return s.repo.Authorization(ctx, required)
}
