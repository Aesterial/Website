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
		return nil, apperrors.InvalidArguments
	}

	u, err := s.repo.GetUserByUID(ctx, id)
	if err != nil {
		if isNotFound(err) {
			return nil, apperrors.RecordNotFound
		}
		logger.Debug("error appeared: "+err.Error(), "user.get_by_id")
		return nil, apperrors.Wrap(err)
	}

	return u, nil
}

func (s *Service) GetSelf(ctx context.Context, sessionID uuid.UUID) (*user.User, error) {
	if sessionID == uuid.Nil {
		return nil, apperrors.InvalidArguments.AddErrDetails("session id is null")
	}
	uid, err := s.sessionRepo.GetUID(ctx, sessionID)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "user.get_self.uid")
		return nil, apperrors.Wrap(err)
	}
	usr, err := s.GetByID(ctx, *uid)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "user.get_self")
		return nil, err
	}
	return usr, nil
}

func (s *Service) GetUID(ctx context.Context, username string) (uint, error) {
	if username == "" {
		return 0, apperrors.RequiredDataMissing.AddErrDetails("username is empty")
	}
	uid, err := s.repo.GetUID(ctx, username)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "user.get_uid")
		return 0, apperrors.Wrap(err)
	}
	return uid, nil
}

func (s *Service) GetUsername(ctx context.Context, uid uint) (string, error) {
	if uid == 0 {
		return "", apperrors.InvalidArguments.AddErrDetails("uid is empty")
	}
	name, err := s.repo.GetUsername(ctx, uid)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "user.get_username")
		return "", apperrors.Wrap(err)
	}
	return name, nil
}

func (s *Service) GetUserLastActive(ctx context.Context, uid uint) (*time.Time, error) {
	if uid == 0 {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("uid is empty")
	}
	at, err := s.repo.GetUserLastActive(ctx, uid)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "users.get_user_last_active")
		return nil, apperrors.Wrap(err)
	}
	return at, nil
}

func (s *Service) GetUserByUsername(ctx context.Context, username string) (*user.User, error) {
	if username == "" {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("username is empty")
	}
	u, err := s.repo.GetUserByUsername(ctx, username)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "user.get_user_by_username")
		return nil, apperrors.Wrap(err)
	}
	return u, nil
}

func (s *Service) GetUserByUID(ctx context.Context, uid uint) (*user.User, error) {
	if uid == 0 {
		return nil, apperrors.InvalidArguments.AddErrDetails("uid is empty")
	}
	u, err := s.repo.GetUserByUID(ctx, uid)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "user.get_user_by_uid")
		return nil, apperrors.Wrap(err)
	}
	return u, nil
}

func (s *Service) GetAvatar(ctx context.Context, uid uint) (*user.Avatar, error) {
	if uid == 0 {
		return nil, apperrors.InvalidArguments.AddErrDetails("uid is empty")
	}
	avatar, err := s.repo.GetAvatar(ctx, uid)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "user.get_avatar")
		return nil, apperrors.Wrap(err)
	}
	return avatar, nil
}

func (s *Service) AddAvatar(ctx context.Context, uid uint, avatar user.Avatar) error {
	if uid == 0 {
		return apperrors.InvalidArguments.AddErrDetails("uid is empty")
	}
	if err := s.repo.AddAvatar(ctx, uid, avatar); err != nil {
		logger.Debug("error appeared: "+err.Error(), "user.add_avatar")
		return apperrors.Wrap(err)
	}
	return nil
}

func (s *Service) DeleteAvatar(ctx context.Context, uid uint) error {
	if uid == 0 {
		return apperrors.InvalidArguments.AddErrDetails("uid is empty")
	}
	if err := s.repo.DeleteAvatar(ctx, uid); err != nil {
		logger.Debug("error appeared: "+err.Error(), "user.delete_avatar")
		return apperrors.Wrap(err)
	}
	return nil
}

func (s *Service) UpdateDisplayName(ctx context.Context, uid uint, displayName string) error {
	if uid == 0 || displayName == "" {
		return apperrors.RequiredDataMissing.AddErrDetails("some argument is empty")
	}
	if err := s.repo.UpdateDisplayName(ctx, uid, displayName); err != nil {
		logger.Debug("error appeared: "+err.Error(), "user.update_display_name")
		return apperrors.Wrap(err)
	}
	return nil
}

func (s *Service) SetEmailVerifiedByAddress(ctx context.Context, email string, verified bool) error {
	if strings.TrimSpace(email) == "" {
		return apperrors.RequiredDataMissing.AddErrDetails("email is empty")
	}
	if err := s.repo.SetEmailVerifiedByAddress(ctx, email, verified); err != nil {
		logger.Debug("error appeared: "+err.Error(), "user.set_email_verified")
		return apperrors.Wrap(err)
	}
	return nil
}

func (s *Service) UpdatePasswordByEmail(ctx context.Context, email string, passwordHash string) error {
	if strings.TrimSpace(email) == "" || passwordHash == "" {
		return apperrors.RequiredDataMissing.AddErrDetails("email or password is empty")
	}
	if err := s.repo.UpdatePasswordByEmail(ctx, email, passwordHash); err != nil {
		logger.Debug("error appeared: "+err.Error(), "user.update_password")
		return apperrors.Wrap(err)
	}
	return nil
}

func (s *Service) IsExists(ctx context.Context, user user.User) (bool, error) {
	if user.UID == 0 {
		return false, apperrors.InvalidArguments.AddErrDetails("user uid is empty")
	}
	exists, err := s.repo.IsExists(ctx, user)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "user.is_exists")
		return false, apperrors.Wrap(err)
	}
	return exists, nil
}

func (s *Service) GetSettings(ctx context.Context, uid uint) (*user.Settings, error) {
	if uid == 0 {
		return nil, apperrors.InvalidArguments.AddErrDetails("uid is empty")
	}
	settings, err := s.repo.GetSettings(ctx, uid)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "user.get_settings")
		return nil, apperrors.Wrap(err)
	}
	return settings, nil
}

func (s *Service) GetJoinedAT(ctx context.Context, uid uint) (*time.Time, error) {
	if uid == 0 {
		return nil, apperrors.InvalidArguments.AddErrDetails("uid is empty")
	}
	at, err := s.repo.GetJoinedAT(ctx, uid)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "user.get_joined_at")
		return nil, apperrors.Wrap(err)
	}
	return at, nil
}

func (s *Service) GetRank(ctx context.Context, uid uint) (*rank.UserRank, error) {
	if uid == 0 {
		return nil, apperrors.InvalidArguments.AddErrDetails("uid is empty")
	}
	r, err := s.repo.GetRank(ctx, uid)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "user.get_rank")
		return nil, apperrors.Wrap(err)
	}
	return r, nil
}

func (s *Service) GetEmail(ctx context.Context, uid uint) (*user.Email, error) {
	if uid == 0 {
		return nil, apperrors.InvalidArguments.AddErrDetails("uid is empty")
	}
	email, err := s.repo.GetEmail(ctx, uid)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "user.get_email")
		return nil, apperrors.Wrap(err)
	}
	return email, nil
}

func (s *Service) IsBanned(ctx context.Context, uid uint) (bool, *user.BanInfo, error) {
	if uid == 0 {
		return false, nil, apperrors.InvalidArguments.AddErrDetails("uid is empty")
	}
	banned, info, err := s.repo.IsBanned(ctx, uid)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "user.is_banned")
		return false, nil, apperrors.Wrap(err)
	}
	return banned, info, nil
}

func (s *Service) Ban(ctx context.Context, info user.BanInfo) error {
	if info.Empty() {
		logger.Debug(fmt.Sprintf("target: %d, reason: %s", info.Target, info.Reason), "a")
		return apperrors.RequiredDataMissing.AddErrDetails("argument is empty")
	}
	if err := s.repo.Ban(ctx, info); err != nil {
		logger.Debug("error appeared: "+err.Error(), "user.ban")
		return apperrors.Wrap(err)
	}
	return nil
}

func (s *Service) UnBan(ctx context.Context, uid uint) error {
	if uid == 0 {
		return apperrors.RequiredDataMissing.AddErrDetails("argument is empty")
	}
	if err := s.repo.UnBan(ctx, uid); err != nil {
		logger.Debug("error appeared: "+err.Error(), "user.unban")
		return apperrors.Wrap(err)
	}
	return nil
}

func (s *Service) BanInfo(ctx context.Context, uid uint) (*user.BanInfo, error) {
	if uid == 0 {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("argument is empty")
	}
	info, err := s.repo.BanInfo(ctx, uid)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "user.ban_info")
		return nil, apperrors.Wrap(err)
	}
	return info, nil
}

func (s *Service) GetList(ctx context.Context) ([]*userpb.UserPublic, error) {
	list, err := s.repo.GetList(ctx)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "user.get_list")
		return nil, apperrors.Wrap(err)
	}
	return list, nil
}

func (s *Service) GetUserSessionLiveTime(ctx context.Context, uid uint) (*user.SessionTime, error) {
	if uid == 0 {
		return nil, apperrors.InvalidArguments.AddErrDetails("uid is null")
	}
	live, err := s.repo.GetUserSessionLiveTime(ctx, uid)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "user.get_user_session_live_time")
		return nil, apperrors.Wrap(err)
	}
	return live, nil
}

func (s *Service) HasPerm(ctx context.Context, uid uint, perm permissions.Permission) (bool, error) {
	if uid == 0 {
		return false, apperrors.InvalidArguments.AddErrDetails("uid is empty")
	}
	if strings.TrimSpace(perm.String()) == "" {
		return false, apperrors.RequiredDataMissing.AddErrDetails("permission is empty")
	}
	has, err := s.repo.HasPerm(ctx, uid, perm)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "user.has_perm")
		return false, apperrors.Wrap(err)
	}
	return has, nil
}

func (s *Service) HasAllPerms(ctx context.Context, uid uint, perms ...permissions.Permission) (bool, error) {
	if uid == 0 {
		return false, apperrors.InvalidArguments.AddErrDetails("uid is empty")
	}
	ok, err := s.repo.HasAllPerms(ctx, uid, perms...)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "user.has_all_perms")
		return false, apperrors.Wrap(err)
	}
	return ok, nil
}

func (s *Service) Perms(ctx context.Context, uid uint) (*permissions.Permissions, error) {
	if uid == 0 {
		return nil, apperrors.InvalidArguments.AddErrDetails("uid is empty")
	}
	perms, err := s.repo.Perms(ctx, uid)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "user.perms")
		return nil, apperrors.Wrap(err)
	}
	return perms, nil
}

func (s *Service) ChangePerms(ctx context.Context, uid uint, perm permissions.Permission, state bool) error {
	if uid == 0 {
		return apperrors.InvalidArguments.AddErrDetails("uid is empty")
	}
	if strings.TrimSpace(perm.String()) == "" {
		return apperrors.RequiredDataMissing.AddErrDetails("permission is empty")
	}
	if err := s.repo.ChangePerms(ctx, uid, perm, state); err != nil {
		logger.Debug("error appeared: "+err.Error(), "user.change_perms")
		return apperrors.Wrap(err)
	}
	return nil
}

func (s *Service) DeleteProfile(ctx context.Context, id uint) error {
	if id == 0 {
		return apperrors.InvalidArguments
	}
	if err := s.repo.DeleteProfile(ctx, id); err != nil {
		return apperrors.Wrap(err)
	}
	return nil
}

func (s *Service) SetRank(ctx context.Context, id uint, rank string, expires *time.Time) error {
	if id == 0 || rank == "" {
		return apperrors.InvalidArguments
	}
	if err := s.repo.SetRank(ctx, id, rank, expires); err != nil {
		return apperrors.Wrap(err)
	}
	return nil
}

/*
 * 	SetCodeUsed(ctx context.Context, hash string) error
	GetRecoveryCodes(ctx context.Context, uid uint) ([]string, error)
	CascadeRecoveryCodes(ctx context.Context, uid uint, codes []string) error
	AppendRecoveryCodes(ctx context.Context, uid uint, cds []string) error
	SetConfirmed(ctx context.Context, uid uint) error
	SetPendingTOTP(ctx context.Context, uid uint, pending string) error
	IsTOTPEnabled(ctx context.Context, uid uint) (bool, error)
*/

func (s *Service) SetCodeUsed(ctx context.Context, hash string) error {
	if hash == "" {
		return apperrors.InvalidArguments
	}
	if err := s.repo.SetCodeUsed(ctx, hash); err != nil {
		logger.Debug("error on setting code used: "+err.Error(), "")
		return apperrors.Wrap(err)
	}
	return nil
}

func (s *Service) GetRecoveryCodes(ctx context.Context, uid uint) ([]string, error) {
	if uid == 0 {
		return nil, apperrors.InvalidArguments
	}
	list, err := s.repo.GetRecoveryCodes(ctx, uid)
	if err != nil {
		return nil, apperrors.Wrap(err)
	}
	return list, nil
}

func (s *Service) CascadeRecoveryCodes(ctx context.Context, uid uint, codes []string) error {
	if uid == 0 || len(codes) == 0 {
		return apperrors.InvalidArguments
	}
	if err := s.repo.CascadeRecoveryCodes(ctx, uid, codes); err != nil {
		return apperrors.Wrap(err)
	}
	return nil
}

func (s *Service) AppendRecoveryCodes(ctx context.Context, uid uint, codes []string) error {
	if uid == 0 || len(codes) == 0 {
		return apperrors.InvalidArguments
	}
	if err := s.repo.AppendRecoveryCodes(ctx, uid, codes); err != nil {
		return apperrors.Wrap(err)
	}
	return nil
}

func (s *Service) SetConfirmed(ctx context.Context, uid uint) error {
	if uid == 0 {
		return apperrors.InvalidArguments
	}
	if err := s.repo.SetConfirmed(ctx, uid); err != nil {
		return apperrors.Wrap(err)
	}
	return nil
}

func (s *Service) SetPendingTOTP(ctx context.Context, uid uint, pending string) error {
	if uid == 0 || pending == "" {
		return apperrors.InvalidArguments
	}
	if err := s.repo.SetPendingTOTP(ctx, uid, pending); err != nil {
		return apperrors.Wrap(err)
	}
	return nil
}

func (s *Service) GetPendingTOTP(ctx context.Context, uid uint) (*string, error) {
	if uid == 0 {
		return nil, apperrors.InvalidArguments
	}
	return s.repo.GetPendingTOTP(ctx, uid)
}

func (s *Service) IsTOTPEnabled(ctx context.Context, uid uint) (bool, error) {
	if uid == 0 {
		return false, apperrors.InvalidArguments
	}
	return s.repo.IsTOTPEnabled(ctx, uid)
}

func (s *Service) ResetTOTP(ctx context.Context, uid uint) error {
	if uid == 0 {
		return apperrors.InvalidArguments
	}
	return s.repo.ResetTOTP(ctx, uid)
}

func (s *Service) IsValidRecovery(ctx context.Context, uid uint, code string) (bool, error) {
	if uid == 0 || code == "" {
		return false, apperrors.InvalidArguments
	}
	return s.repo.IsValidRecovery(ctx, uid, code)
}

func (s *Service) GetTOTPSecret(ctx context.Context, uid uint) (string, error) {
	if uid == 0 {
		return "", apperrors.InvalidArguments
	}
	return s.repo.GetTOTPSecret(ctx, uid)
}

func (s *Service) GetTOTPLastStep(ctx context.Context, uid uint) (*int64, error) {
	if uid == 0 {
		return nil, apperrors.InvalidArguments
	}
	return s.repo.GetTOTPLastStep(ctx, uid)
}

func (s *Service) SetTOTPLastStep(ctx context.Context, uid uint, step int64) error {
	if uid == 0 || step == 0 {
		return apperrors.InvalidArguments
	}
	return s.repo.SetTOTPLastStep(ctx, uid, step)
}

func (s *Service) IsTOTPending(ctx context.Context, uid uint) (bool, error) {
	if uid == 0 {
		return false, apperrors.InvalidArguments
	}
	return s.repo.IsTOTPending(ctx, uid)
}

func (s *Service) CanEdit(ctx context.Context, user uint, target uint) (bool, error) {
	if user == 0 || target == 0 {
		return false, apperrors.InvalidArguments
	}
	return s.repo.CanEdit(ctx, user, target)
}

func isNotFound(err error) bool {
	if err == nil {
		return false
	}
	var appErr apperrors.ErrorST
	if errors.As(err, &appErr) {
		return appErr.Is(apperrors.RecordNotFound)
	}
	return strings.EqualFold(err.Error(), "user not found")
}
