package login

import (
	domain "ascendant/backend/internal/domain/login"
	apperrors "ascendant/backend/internal/shared/errors"
	"context"
	"net/http"
	"strconv"
)

func (s *Service) Register(ctx context.Context, required domain.RegisterRequire) (*int, error) {
	if required.IsEmpty() {
		return nil, apperrors.BuildError(strconv.Itoa(http.StatusBadRequest), "required body is empty", nil, "")
	}
	var err error
	required.Password, err = GeneratePassword(required.Password)
	if err != nil {
		return nil, err
	}
	return s.repo.Register(ctx, required)
}
