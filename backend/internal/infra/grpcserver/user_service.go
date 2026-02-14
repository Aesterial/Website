package grpcserver

import (
	sessionsapp "Aesterial/backend/internal/app/info/sessions"
	userinfo "Aesterial/backend/internal/app/info/user"
	usermodifier "Aesterial/backend/internal/app/modifier/user"
	storageapp "Aesterial/backend/internal/app/storage"
	"Aesterial/backend/internal/domain/permissions"
	"Aesterial/backend/internal/domain/user"
	permpb "Aesterial/backend/internal/gen/permissions/v1"
	"Aesterial/backend/internal/gen/types/v1"
	userpb "Aesterial/backend/internal/gen/user/v1"
	"Aesterial/backend/internal/infra/logger"
	apperrors "Aesterial/backend/internal/shared/errors"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type UserService struct {
	userpb.UnimplementedUserServiceServer
	info     *userinfo.Service
	modifier *usermodifier.Service
	sessions *sessionsapp.Service
	auth     *Authenticator
	storage  *storageapp.Service
}

func NewUserService(info *userinfo.Service, modifier *usermodifier.Service, sessions *sessionsapp.Service, storage *storageapp.Service) *UserService {
	return &UserService{
		info:     info,
		modifier: modifier,
		sessions: sessions,
		auth:     NewAuthenticator(sessions, info),
		storage:  storage,
	}
}

func (s *UserService) Self(ctx context.Context, _ *emptypb.Empty) (*userpb.UserSelfResponse, error) {
	requestor, err := s.auth.RequireUser(ctx, true)
	if err != nil && !errors.Is(err, apperrors.NeedVerify) {
		logger.Debug("failed to get info about self: "+err.Error(), "")
		return nil, err
	}
	if requestor == nil {
		return nil, apperrors.Unauthenticated.AddErrDetails("user not logged in")
	}
	u, err := s.info.GetSelf(ctx, requestor.SessionID)
	if err != nil && !errors.Is(err, apperrors.NeedVerify) {
		logger.Debug("error while getting info: "+err.Error(), "")
		return nil, apperrors.Wrap(err)
	}
	traceID := TraceIDOrNew(ctx)
	logger.Info("Got information about self", "login.authorization.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	self := u.ToSelf()
	s.applyAvatarURL(ctx, self.GetPublic())
	return &userpb.UserSelfResponse{Data: self, Tracing: traceID}, nil
}

func (s *UserService) RevokeSession(ctx context.Context, req *userpb.RevokeSessionRequest) (*types.WithTracing, error) {
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil {
		return nil, err
	}
	if requestor == nil {
		return nil, apperrors.Unauthenticated.AddErrDetails("user not logged in")
	}
	if req == nil {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("request is empty")
	}
	if req.GetId() == requestor.SessionID.String() {
		return nil, apperrors.InvalidArguments
	}
	id, err := uuid.Parse(req.GetId())
	if err != nil {
		return nil, apperrors.InvalidArguments
	}
	err = s.sessions.SetRevoked(ctx, id)
	if err != nil {
		return nil, apperrors.Wrap(err)
	}
	return &types.WithTracing{Tracing: TraceIDOrNew(ctx)}, nil
}

func (s *UserService) Other(ctx context.Context, req *userpb.OtherUserRequest) (*userpb.UserPublicResponse, error) {
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil {
		return nil, err
	}
	if requestor == nil {
		return nil, apperrors.Unauthenticated.AddErrDetails("user not logged in")
	}
	if req == nil {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("request is empty")
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permissions.UsersViewProfilePublic); err != nil {
		return nil, err
	}
	u, err := s.info.GetByID(ctx, uint(req.UserID))
	if err != nil {
		return nil, apperrors.Wrap(err)
	}
	traceID := TraceIDOrNew(ctx)
	logger.Info(fmt.Sprintf("Got information about user with id: %d", req.UserID), "login.authorization.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	public := u.ToPublic()
	s.applyAvatarURL(ctx, public)
	return &userpb.UserPublicResponse{Data: public, Tracing: traceID}, nil
}

func (s *UserService) Sessions(ctx context.Context, _ *emptypb.Empty) (*userpb.UserSessionsResponse, error) {
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil {
		return nil, err
	}
	if s.sessions == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("sessions service not configured")
	}
	traceID := TraceIDOrNew(ctx)
	if requestor != nil {
		logger.Info("Requested sessions", "user.sessions.request", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.None, traceID)
	}
	list, err := s.sessions.GetSessions(ctx, requestor.UID)
	if err != nil {
		return nil, apperrors.Wrap(err)
	}
	if requestor != nil {
		logger.Info("Got sessions", "user.sessions.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	}
	return &userpb.UserSessionsResponse{Data: list.ToProto(), Tracing: traceID}, nil
}

func (s *UserService) UpdateSelfName(ctx context.Context, req *userpb.ChangeSelfNameRequest) (*types.WithTracing, error) {
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil {
		return nil, err
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permissions.UsersSettingsChangeNameOwn); err != nil {
		return nil, err
	}
	if req == nil {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("request is empty")
	}
	if s.modifier == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("modifier service not configured")
	}
	traceID := TraceIDOrNew(ctx)
	if requestor != nil {
		logger.Info("Requested self name update", "user.update_self_name.request", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.None, traceID)
	}
	if _, err := s.modifier.UpdateName(ctx, requestor.UID, req.Name); err != nil {
		return nil, apperrors.Wrap(err)
	}
	if requestor != nil {
		logger.Info("Updated self name", "user.update_self_name.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	}
	return &types.WithTracing{Tracing: traceID}, nil
}

func (s *UserService) UpdateSelfDescription(ctx context.Context, req *userpb.ChangeSelfDescriptionRequest) (*types.WithTracing, error) {
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil {
		return nil, err
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permissions.UsersSettingsChangeDescriptionOwn); err != nil {
		return nil, err
	}
	if req == nil {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("request is empty")
	}
	traceID := TraceIDOrNew(ctx)
	if requestor != nil {
		logger.Info("Requested self description update", "user.update_self_name.request", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.None, traceID)
	}
	if err := s.info.UpdateDescription(ctx, requestor.UID, req.Description); err != nil {
		return nil, apperrors.Wrap(err)
	}
	if requestor != nil {
		logger.Info("Updated self description", "user.update_self_description.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	}
	return &types.WithTracing{Tracing: traceID}, nil
}

func (s *UserService) UpdateSelfAvatar(ctx context.Context, req *userpb.Avatar) (*types.WithTracing, error) {
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil {
		return nil, err
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permissions.UsersSettingsDeleteAvatarOwn); err != nil {
		return nil, err
	}
	if req == nil {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("request is empty")
	}
	if s.modifier == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("modifier service not configured")
	}
	if s.storage == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("storage service not configured")
	}
	avatar := fromProtoAvatar(req)
	if avatar == nil || strings.TrimSpace(avatar.Key) == "" {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("avatar key is empty")
	}
	expectedPrefix := fmt.Sprintf("avatars/%d/", requestor.UID)
	if !strings.HasPrefix(avatar.Key, expectedPrefix) {
		return nil, apperrors.AccessDenied.AddErrDetails("avatar key is invalid")
	}
	exists, err := s.storage.Exists(ctx, avatar.Key)
	if err != nil {
		return nil, apperrors.ServerError.AddErrDetails("failed to validate avatar object")
	}
	if !exists {
		return nil, apperrors.RecordNotFound.AddErrDetails("avatar object not found")
	}

	traceID := TraceIDOrNew(ctx)
	if requestor != nil {
		logger.Info("Requested self avatar update", "user.update_self_avatar.request", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.None, traceID)
	}
	if _, err := s.modifier.UpdateAvatar(ctx, requestor.UID, *avatar); err != nil {
		return nil, apperrors.Wrap(err)
	}
	if requestor != nil {
		logger.Info("Updated self avatar", "user.update_self_avatar.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	}
	return &types.WithTracing{Tracing: traceID}, nil
}

func (s *UserService) Ban(ctx context.Context, req *userpb.BanUserRequest) (*types.WithTracing, error) {
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil {
		return nil, err
	}
	if requestor == nil {
		return nil, apperrors.Unauthenticated.AddErrDetails("user not logged in")
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permissions.UsersModerationBan); err != nil {
		return nil, err
	}
	traceID := TraceIDOrNew(ctx)
	can, err := s.info.CanEdit(ctx, requestor.UID, uint(req.GetUserID()))
	if err != nil {
		return nil, apperrors.Wrap(err)
	}
	if !can {
		return nil, apperrors.AccessDenied
	}
	err = s.info.Ban(ctx, user.BanInfo{Executor: requestor.UID, Target: uint(req.UserID), Reason: req.Reason, Expire: time.Now().Add(req.Duration.AsDuration())})
	if err != nil {
		return &types.WithTracing{Tracing: traceID}, apperrors.Wrap(err)
	}
	logger.Info("Banned user", "user.ban.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	return &types.WithTracing{Tracing: traceID}, nil
}

func (s *UserService) Unban(ctx context.Context, req *userpb.OtherUserRequest) (*types.WithTracing, error) {
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil {
		return nil, err
	}
	if requestor == nil {
		return nil, apperrors.Unauthenticated.AddErrDetails("user not logged in")
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permissions.UsersModerationUnban); err != nil {
		return nil, err
	}
	traceID := TraceIDOrNew(ctx)
	can, err := s.info.CanEdit(ctx, requestor.UID, uint(req.GetUserID()))
	if err != nil {
		return nil, apperrors.Wrap(err)
	}
	if !can {
		return nil, apperrors.AccessDenied
	}
	err = s.info.UnBan(ctx, uint(req.UserID))
	if err != nil {
		return &types.WithTracing{Tracing: traceID}, err
	}
	logger.Info("Unbanned user", "user.unban.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	return &types.WithTracing{Tracing: traceID}, nil
}

func (s *UserService) formateBanInfoResponse(ctx context.Context, info *user.BanInfo) (*userpb.BanInfoResponse, error) {
	executor, err := s.info.GetByID(ctx, info.Executor)
	if err != nil {
		return nil, apperrors.Wrap(err)
	}
	var expr *timestamppb.Timestamp
	if info.Expires.Valid {
		expr = timestamppb.New(info.Expires.Time)
	}
	executorProto := executor.ToPublic()
	s.applyAvatarURL(ctx, executorProto)
	return &userpb.BanInfoResponse{
		Id:       info.ID.String(),
		Executor: executorProto,
		Reason:   info.Reason,
		At:       timestamppb.New(info.At),
		Expires:  expr,
		Tracing:  TraceIDOrNew(ctx),
	}, nil
}

func (s *UserService) BanInfo(ctx context.Context, _ *emptypb.Empty) (*userpb.BanInfoResponse, error) {
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil && !(strings.Contains(strings.ToLower(strings.TrimSpace(err.Error())), "user is banned")) {
		return nil, err
	}
	if requestor == nil {
		return nil, apperrors.Unauthenticated.AddErrDetails("user not logged in")
	}
	info, err := s.info.BanInfo(ctx, requestor.UID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, apperrors.RecordNotFound.AddErrDetails("user is not banned")
		}
		return nil, apperrors.Wrap(err)
	}
	traceID := TraceIDOrNew(ctx)
	resp, err := s.formateBanInfoResponse(ctx, info)
	if err != nil {
		return nil, err
	}
	resp.Tracing = traceID
	logger.Info("Got self ban info", "user.ban_info.self.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	return resp, nil
}

func (s *UserService) BanInfoOther(ctx context.Context, req *userpb.OtherUserRequest) (*userpb.BanInfoResponse, error) {
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil {
		return nil, err
	}
	if requestor == nil {
		return nil, apperrors.Unauthenticated.AddErrDetails("user not logged in")
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permissions.UsersModerationBan); err != nil {
		return nil, err
	}
	info, err := s.info.BanInfo(ctx, uint(req.UserID))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, apperrors.RecordNotFound.AddErrDetails("user is not banned")
		}
		return nil, apperrors.Wrap(err)
	}
	traceID := TraceIDOrNew(ctx)
	resp, err := s.formateBanInfoResponse(ctx, info)
	if err != nil {
		return nil, err
	}
	resp.Tracing = traceID
	logger.Info("Got user ban info", "user.ban_info.other.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	return resp, nil
}

func (s *UserService) Users(ctx context.Context, _ *emptypb.Empty) (*userpb.UsersResponse, error) {
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil {
		return nil, err
	}
	if requestor == nil {
		return nil, apperrors.Unauthenticated.AddErrDetails("user not logged in")
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permissions.StatisticsAll); err != nil {
		return nil, err
	}
	info, err := s.info.GetList(ctx)
	if err != nil {
		return nil, apperrors.Wrap(err)
	}
	for _, u := range info {
		s.applyAvatarURL(ctx, u)
	}
	traceID := TraceIDOrNew(ctx)
	logger.Info("Got users list", "user.list.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	return &userpb.UsersResponse{Data: info, Tracing: traceID}, nil
}

func (s *UserService) DeleteSelfAvatar(ctx context.Context, _ *emptypb.Empty) (*types.WithTracing, error) {
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil {
		return nil, err
	}
	if requestor == nil {
		return nil, apperrors.Unauthenticated.AddErrDetails("user not logged in")
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permissions.UsersSettingsDeleteAvatarOwn); err != nil {
		return nil, err
	}
	if s.modifier == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("modifier service not configured")
	}
	traceID := TraceIDOrNew(ctx)
	avatar, err := s.modifier.DeleteAvatar(ctx, requestor.UID)
	if err != nil {
		return nil, err
	}
	if s.storage != nil && avatar != nil && strings.TrimSpace(avatar.Key) != "" {
		if err := s.storage.Delete(ctx, avatar.Key); err != nil {
			logger.Debug("error appeared: "+err.Error(), "user.delete_self_avatar.storage")
		}
	}
	logger.Info("Deleted self avatar", "user.delete_self_avatar.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	return &types.WithTracing{Tracing: traceID}, nil
}

func (s *UserService) DeleteUserAvatar(ctx context.Context, req *userpb.OtherUserRequest) (*types.WithTracing, error) {
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil {
		return nil, err
	}
	if requestor == nil {
		return nil, apperrors.Unauthenticated.AddErrDetails("user not logged in")
	}
	if req == nil {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("request is empty")
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permissions.UsersSettingsDeleteAvatarAny); err != nil {
		return nil, err
	}
	if s.modifier == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("modifier service not configured")
	}
	targetID := uint(req.UserID)
	if targetID == 0 {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("user id is empty")
	}
	traceID := TraceIDOrNew(ctx)
	avatar, err := s.modifier.DeleteAvatar(ctx, targetID)
	if err != nil {
		return nil, err
	}
	if s.storage != nil && avatar != nil && strings.TrimSpace(avatar.Key) != "" {
		if err := s.storage.Delete(ctx, avatar.Key); err != nil {
			logger.Debug("error appeared: "+err.Error(), "user.delete_user_avatar.storage")
		}
	}
	logger.Info("Deleted user avatar", "user.delete_user_avatar.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	return &types.WithTracing{Tracing: traceID}, nil
}

func (s *UserService) applyAvatarURL(ctx context.Context, u *userpb.UserPublic) {
	if s == nil || s.storage == nil {
		return
	}
	applyPresignedUserAvatarURL(ctx, s.storage, u)
}

func (s *UserService) HasPermissions(ctx context.Context, req *userpb.HasPermissionRequest) (*userpb.HasPermissionResponse, error) {
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil {
		return nil, err
	}
	if requestor == nil {
		return nil, apperrors.Unauthenticated.AddErrDetails("user not logged in")
	}
	if req.UserID != uint32(requestor.UID) {
		if err := s.auth.RequirePermissions(ctx, requestor.UID, permissions.UsersViewProfilePrivacy); err != nil {
			return nil, err
		}
	}
	has, err := s.info.HasPerm(ctx, uint(req.UserID), permissions.Permission(req.GetPerm()))
	if err != nil {
		return nil, apperrors.ServerError.AddErrDetails("failed to get permissions: " + err.Error())
	}
	traceID := TraceIDOrNew(ctx)
	logger.Info("Checked user permissions", "user.permissions.check.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	return &userpb.HasPermissionResponse{Has: has, Tracing: traceID}, nil
}

func (s *UserService) Permissions(ctx context.Context, req *userpb.OtherUserRequest) (*permpb.PermissionsResponse, error) {
	requestor, err := s.auth.RequireUser(ctx, true)
	if err != nil {
		return nil, err
	}
	if requestor == nil {
		return nil, apperrors.Unauthenticated.AddErrDetails("user not logged in")
	}
	if req.UserID != uint32(requestor.UID) {
		if err := s.auth.RequirePermissions(ctx, requestor.UID, permissions.UsersViewProfilePrivacy); err != nil {
			return nil, err
		}
	}
	perms, err := s.info.Perms(ctx, uint(req.UserID))
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "")
		return nil, apperrors.ServerError.AddErrDetails("failed to get perms: " + err.Error() + " for user: " + strconv.Itoa(int(requestor.UID)))
	}
	traceID := TraceIDOrNew(ctx)
	logger.Info("Got user permissions", "user.permissions.get.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	return &permpb.PermissionsResponse{Data: perms.ToProto(), Tracing: traceID}, nil
}

func (s *UserService) DeleteProfile(ctx context.Context, _ *emptypb.Empty) (*emptypb.Empty, error) {
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil {
		return nil, err
	}
	if requestor == nil {
		return nil, apperrors.Unauthenticated.AddErrDetails("user not logged in")
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permissions.UsersSettingsDeleteProfileOwn); err != nil {
		return nil, err
	}
	if err := s.info.DeleteProfile(ctx, requestor.UID); err != nil {
		logger.Debug("error on delete profile: "+err.Error(), "")
		return nil, apperrors.ServerError.AddErrDetails("failed to delete profile: " + err.Error() + " for user: " + strconv.Itoa(int(requestor.UID)))
	}
	traceID := TraceIDOrNew(ctx)
	logger.Info("Deleted profile", "user.profile.delete.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	return &emptypb.Empty{}, nil
}

func (s *UserService) ChangePerms(ctx context.Context, req *userpb.OtherUserPermsPatchRequest) (*types.WithTracing, error) {
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil {
		return nil, err
	}
	if requestor == nil {
		return nil, apperrors.Unauthenticated.AddErrDetails("user not logged in")
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permissions.All); err != nil {
		return nil, err
	}
	perm := permissions.Permission(req.GetPerm())
	if !perm.IsValid() {
		return nil, apperrors.InvalidArguments
	}
	if err := s.info.ChangePerms(ctx, requestor.UID, perm, req.GetState()); err != nil {
		logger.Debug("Error on change perms: "+err.Error(), "")
		return nil, apperrors.ServerError
	}
	traceID := TraceIDOrNew(ctx)
	logger.Info("Updated user permissions", "user.permissions.update.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	return &types.WithTracing{Tracing: traceID}, nil
}

func (s *UserService) SetRank(ctx context.Context, req *userpb.SetRankRequest) (*types.WithTracing, error) {
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil {
		return nil, err
	}
	if requestor == nil {
		return nil, apperrors.Unauthenticated.AddErrDetails("user not logged in")
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permissions.UsersModerationSetRank); err != nil {
		return nil, err
	}
	exists, err := s.info.IsExists(ctx, user.User{UID: uint(req.GetUserID())})
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, apperrors.RecordNotFound.AddErrDetails("user doesn't exists")
	}
	var expires *time.Time = nil
	if req.GetExpires() != nil {
		as := req.GetExpires().AsTime()
		expires = &as
	}
	if err := s.info.SetRank(ctx, uint(req.UserID), req.GetRank(), expires); err != nil {
		logger.Debug("Failed to set rank: "+err.Error(), "")
		return nil, apperrors.ServerError
	}
	return &types.WithTracing{Tracing: TraceIDOrNew(ctx)}, nil
}

func (s *UserService) ActivateRank(ctx context.Context, req *userpb.ActivateRankRequest) (*userpb.ActivateRankResponse, error) {
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil {
		return nil, err
	}
	if requestor == nil {
		return nil, apperrors.Unauthenticated.AddErrDetails("user not logged in")
	}
	code, err := uuid.Parse(req.GetCode())
	if err != nil {
		return nil, apperrors.InvalidArguments
	}
	rank, err := s.info.ActivateRank(ctx, requestor.UID, code)
	if err != nil {
		logger.Debug("failed to activate rank: "+err.Error(), "")
		return nil, apperrors.Wrap(err)
	}
	return &userpb.ActivateRankResponse{Rank: rank, Tracing: TraceIDOrNew(ctx)}, nil
}
