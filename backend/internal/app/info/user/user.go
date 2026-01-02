package user

import (
	"ascendant/backend/internal/domain/sessions"
	"ascendant/backend/internal/domain/user"
	apperrors "ascendant/backend/internal/shared/errors"
	"context"
	"errors"
	"strconv"
	"strings"

	"github.com/google/uuid"
)

type Service struct {
	repo        user.Repository
	sessionRepo sessions.Repository
}

func New(repo user.Repository, sessionRepo sessions.Repository) *Service {
	return &Service{repo: repo, sessionRepo: sessionRepo}
}

func (s *Service) GetByID(ctx context.Context, id uint) (*user.User, error) {
	if id == 0 {
		return nil, apperrors.BuildError(
			"InvalidUserID",
			"user id must be greater than zero",
			map[string]string{"userID": "must be greater than zero"},
			"",
		)
	}

	u, err := s.repo.GetUserByUID(ctx, id)
	if err != nil {
		if isNotFound(err) {
			return nil, apperrors.UserNotFound(strconv.FormatUint(uint64(id), 10), "")
		}
		return nil, err
	}

	return u, nil
}

func (s *Service) GetSelf(ctx context.Context, sessionID uuid.UUID) (*user.User, error) {
	if sessionID == uuid.Nil {
		return nil, errors.New("session id is null")
	}
	uid, err := s.sessionRepo.GetUID(ctx, sessionID)
	if err != nil {
		return nil, err
	}
	usr, err := s.GetByID(ctx, *uid)
	if err != nil {
		return nil, err
	}
	return usr, nil
}

func (s *Service) IsBanned(ctx context.Context, uid uint) (bool, *user.BanInfo, error) {
	if uid == 0 {
		return false, nil, errors.New("uid is empty")
	}
	return s.repo.IsBanned(ctx, uid)
}

func (s *Service) Ban(ctx context.Context, info user.BanInfo) error {
	if info.Empty() {
		return errors.New("argument is empty")
	}
	return s.repo.Ban(ctx, info)
}

func (s *Service) UnBan(ctx context.Context, uid uint) error {
	if uid == 0 {
		return nil
	}
	return s.repo.UnBan(ctx, uid)
}

func (s *Service) GetUserSessionLiveTime(ctx context.Context, uid uint) (*user.SessionTime, error) {
	if uid == 0 {
		return nil, errors.New("uid is null")
	}
	return s.repo.GetUserSessionLiveTime(ctx, uid)
}

func isNotFound(err error) bool {
	if err == nil {
		return false
	}
	return strings.EqualFold(err.Error(), "user not found")
}
