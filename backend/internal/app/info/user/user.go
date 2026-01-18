package user

import (
	"Aesterial/backend/internal/domain/permissions"
	"Aesterial/backend/internal/domain/rank"
	"Aesterial/backend/internal/domain/sessions"
	"Aesterial/backend/internal/domain/user"
	userpb "Aesterial/backend/internal/gen/user/v1"
	"Aesterial/backend/internal/infra/logger"
	apperrors "Aesterial/backend/internal/shared/errors"
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

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

func (s *Service) GetUID(ctx context.Context, username string) (uint, error) {
	if username == "" {
		return 0, errors.New("username is empty")
	}
	return s.repo.GetUID(ctx, username)
}

func (s *Service) GetUsername(ctx context.Context, uid uint) (string, error) {
	if uid == 0 {
		return "", errors.New("uid is empty")
	}
	return s.repo.GetUsername(ctx, uid)
}

func (s *Service) GetUserByUsername(ctx context.Context, username string) (*user.User, error) {
	if username == "" {
		return nil, errors.New("username is empty")
	}
	return s.repo.GetUserByUsername(ctx, username)
}

func (s *Service) GetUserByUID(ctx context.Context, uid uint) (*user.User, error) {
	if uid == 0 {
		return nil, errors.New("uid is empty")
	}
	return s.repo.GetUserByUID(ctx, uid)
}

func (s *Service) GetAvatar(ctx context.Context, uid uint) (*user.Avatar, error) {
	if uid == 0 {
		return nil, errors.New("uid is empty")
	}
	return s.repo.GetAvatar(ctx, uid)
}

func (s *Service) AddAvatar(ctx context.Context, uid uint, avatar user.Avatar) error {
	if uid == 0 {
		return errors.New("uid is empty")
	}
	return s.repo.AddAvatar(ctx, uid, avatar)
}

func (s *Service) UpdateDisplayName(ctx context.Context, uid uint, displayName string) error {
	if uid == 0 || displayName == "" {
		return errors.New("some argument is empty")
	}
	return s.repo.UpdateDisplayName(ctx, uid, displayName)
}

func (s *Service) SetEmailVerifiedByAddress(ctx context.Context, email string, verified bool) error {
	if strings.TrimSpace(email) == "" {
		return errors.New("email is empty")
	}
	return s.repo.SetEmailVerifiedByAddress(ctx, email, verified)
}

func (s *Service) UpdatePasswordByEmail(ctx context.Context, email string, passwordHash string) error {
	if strings.TrimSpace(email) == "" || passwordHash == "" {
		return errors.New("email or password is empty")
	}
	return s.repo.UpdatePasswordByEmail(ctx, email, passwordHash)
}

func (s *Service) IsExists(ctx context.Context, user user.User) (bool, error) {
	if user.UID == 0 {
		return false, errors.New("user uid is empty")
	}
	return s.repo.IsExists(ctx, user)
}

func (s *Service) GetSettings(ctx context.Context, uid uint) (*user.Settings, error) {
	if uid == 0 {
		return nil, errors.New("uid is empty")
	}
	return s.repo.GetSettings(ctx, uid)
}

func (s *Service) GetJoinedAT(ctx context.Context, uid uint) (*time.Time, error) {
	if uid == 0 {
		return nil, errors.New("uid is empty")
	}
	return s.repo.GetJoinedAT(ctx, uid)
}

func (s *Service) GetRank(ctx context.Context, uid uint) (*rank.UserRank, error) {
	if uid == 0 {
		return nil, errors.New("uid is empty")
	}
	return s.repo.GetRank(ctx, uid)
}

func (s *Service) GetEmail(ctx context.Context, uid uint) (*user.Email, error) {
	if uid == 0 {
		return nil, errors.New("uid is empty")
	}
	return s.repo.GetEmail(ctx, uid)
}

func (s *Service) IsBanned(ctx context.Context, uid uint) (bool, *user.BanInfo, error) {
	if uid == 0 {
		return false, nil, errors.New("uid is empty")
	}
	return s.repo.IsBanned(ctx, uid)
}

func (s *Service) Ban(ctx context.Context, info user.BanInfo) error {
	if info.Empty() {
		logger.Debug(fmt.Sprintf("target: %d, reason: %s", info.Target, info.Reason), "a")
		return errors.New("argument is empty")
	}
	return s.repo.Ban(ctx, info)
}

func (s *Service) UnBan(ctx context.Context, uid uint) error {
	if uid == 0 {
		return errors.New("argument is empty")
	}
	return s.repo.UnBan(ctx, uid)
}

func (s *Service) BanInfo(ctx context.Context, uid uint) (*user.BanInfo, error) {
	if uid == 0 {
		return nil, errors.New("argument is empty")
	}
	return s.repo.BanInfo(ctx, uid)
}

func (s *Service) GetList(ctx context.Context) ([]*userpb.UserPublic, error) {
	return s.repo.GetList(ctx)
}

func (s *Service) GetUserSessionLiveTime(ctx context.Context, uid uint) (*user.SessionTime, error) {
	if uid == 0 {
		return nil, errors.New("uid is null")
	}
	return s.repo.GetUserSessionLiveTime(ctx, uid)
}

func (s *Service) HasPerm(ctx context.Context, uid uint, perm permissions.Permission) (bool, error) {
	if uid == 0 {
		return false, errors.New("uid is empty")
	}
	if strings.TrimSpace(perm.String()) == "" {
		return false, errors.New("permission is empty")
	}
	return s.repo.HasPerm(ctx, uid, perm)
}

func (s *Service) HasAllPerms(ctx context.Context, uid uint, perms ...permissions.Permission) (bool, error) {
	if uid == 0 {
		return false, errors.New("uid is empty")
	}
	return s.repo.HasAllPerms(ctx, uid, perms...)
}

func (s *Service) Perms(ctx context.Context, uid uint) (*permissions.Permissions, error) {
	if uid == 0 {
		return nil, errors.New("uid is empty")
	}
	return s.repo.Perms(ctx, uid)
}

func (s *Service) ChangePerms(ctx context.Context, uid uint, perm permissions.Permission, state bool) error {
	if uid == 0 {
		return errors.New("uid is empty")
	}
	if strings.TrimSpace(perm.String()) == "" {
		return errors.New("permission is empty")
	}
	return s.repo.ChangePerms(ctx, uid, perm, state)
}

func isNotFound(err error) bool {
	if err == nil {
		return false
	}
	return strings.EqualFold(err.Error(), "user not found")
}
