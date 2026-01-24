package grpcserver

import (
	sessionsapp "Aesterial/backend/internal/app/info/sessions"
	userapp "Aesterial/backend/internal/app/info/user"
	rankapp "Aesterial/backend/internal/app/rank"
	storageapp "Aesterial/backend/internal/app/storage"
	permsdomain "Aesterial/backend/internal/domain/permissions"
	permspb "Aesterial/backend/internal/gen/permissions/v1"
	rankpb "Aesterial/backend/internal/gen/ranks/v1"
	"Aesterial/backend/internal/infra/logger"
	apperrors "Aesterial/backend/internal/shared/errors"
	"context"
	"database/sql"
	"errors"
	"strconv"
	"strings"

	"google.golang.org/protobuf/types/known/emptypb"
)

type RanksService struct {
	rankpb.UnimplementedRanksServiceServer
	ranks   *rankapp.Service
	auth    *Authenticator
	users   *userapp.Service
	storage *storageapp.Service
}

func NewRanksService(ranks *rankapp.Service, sess *sessionsapp.Service, users *userapp.Service, storage *storageapp.Service) *RanksService {
	return &RanksService{
		ranks:   ranks,
		auth:    NewAuthenticator(sess, users),
		users:   users,
		storage: storage,
	}
}

func (s *RanksService) Create(ctx context.Context, req *rankpb.CreateRequest) (*rankpb.EmptyResponse, error) {
	if s == nil || s.ranks == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("ranks service not configured")
	}
	if req == nil {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("request is empty")
	}
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil || requestor == nil {
		return nil, err
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permsdomain.RanksAdd); err != nil {
		return nil, err
	}
	name := strings.TrimSpace(req.GetName())
	if name == "" {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("rank name is empty")
	}
	//color, err := parseRankColor(req.GetColor())
	//if err != nil {
	//	return nil, status.Error(codes.InvalidArgument, err.Error())
	//}
	color := req.GetColor()
	description := strings.TrimSpace(req.GetDescription())
	if description == "" {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("rank description is empty")
	}
	var perms *permsdomain.Permissions
	if req.GetPermissions() != nil {
		perms = (&permsdomain.Permissions{}).Merge(req.GetPermissions())
	}
	if err := s.ranks.Create(ctx, name, int(color), description, perms); err != nil {
		return nil, apperrors.Wrap(err)
	}
	traceID := TraceIDOrNew(ctx)
	logger.Info("Created rank", "ranks.create.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	return &rankpb.EmptyResponse{Tracing: traceID}, nil
}

func (s *RanksService) Patch(ctx context.Context, req *rankpb.PatchRequest) (*rankpb.EmptyResponse, error) {
	if s == nil || s.ranks == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("ranks service not configured")
	}
	if req == nil {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("request is empty")
	}
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil || requestor == nil {
		return nil, err
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permsdomain.RanksEdit); err != nil {
		return nil, err
	}
	name := strings.TrimSpace(req.GetName())
	if name == "" {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("rank name is empty")
	}
	changed := false
	if req.NewName != nil {
		newName := strings.TrimSpace(req.GetNewName())
		if newName == "" {
			return nil, apperrors.RequiredDataMissing.AddErrDetails("rank new name is empty")
		}
		if err := s.ranks.Edit(ctx, name, "name", newName); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return nil, apperrors.RecordNotFound.AddErrDetails("rank not found")
			}
			return nil, apperrors.Wrap(err)
		}
		name = newName
		changed = true
	}
	if req.Description != nil {
		description := strings.TrimSpace(req.GetDescription())
		if description == "" {
			return nil, apperrors.RequiredDataMissing.AddErrDetails("rank description is empty")
		}
		if err := s.ranks.Edit(ctx, name, "description", description); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return nil, apperrors.RecordNotFound.AddErrDetails("rank not found")
			}
			return nil, apperrors.Wrap(err)
		}
		changed = true
	}
	if req.Color != nil {
		//color, err := parseRankColor(req.GetColor())
		//if err != nil {
		//	return nil, status.Error(codes.InvalidArgument, err.Error())
		//}
		color := req.GetColor()
		if err := s.ranks.Edit(ctx, name, "color", color); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return nil, apperrors.RecordNotFound.AddErrDetails("rank not found")
			}
			return nil, apperrors.Wrap(err)
		}
		changed = true
	}
	if !changed {
		return nil, apperrors.InvalidArguments.AddErrDetails("nothing to update")
	}
	traceID := TraceIDOrNew(ctx)
	logger.Info("Updated rank", "ranks.patch.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	return &rankpb.EmptyResponse{Tracing: traceID}, nil
}

func (s *RanksService) Delete(ctx context.Context, req *rankpb.NameRequest) (*rankpb.EmptyResponse, error) {
	if s == nil || s.ranks == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("ranks service not configured")
	}
	if req == nil {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("request is empty")
	}
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil || requestor == nil {
		return nil, err
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permsdomain.RanksDelete); err != nil {
		return nil, err
	}
	name := strings.TrimSpace(req.GetName())
	if name == "" {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("rank name is empty")
	}
	if err := s.ranks.Delete(ctx, name); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, apperrors.RecordNotFound.AddErrDetails("rank not found")
		}
		return nil, apperrors.Wrap(err)
	}
	traceID := TraceIDOrNew(ctx)
	logger.Info("Deleted rank", "ranks.delete.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	return &rankpb.EmptyResponse{Tracing: traceID}, nil
}

func (s *RanksService) Get(ctx context.Context, req *rankpb.NameRequest) (*rankpb.RankResponse, error) {
	if s == nil || s.ranks == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("ranks service not configured")
	}
	if req == nil {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("request is empty")
	}
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil || requestor == nil {
		return nil, err
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permsdomain.RanksAll); err != nil {
		return nil, err
	}
	name := strings.TrimSpace(req.GetName())
	if name == "" {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("rank name is empty")
	}
	rank, err := s.ranks.Get(ctx, name)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, apperrors.RecordNotFound.AddErrDetails("rank not found")
		}
		return nil, apperrors.Wrap(err)
	}
	traceID := TraceIDOrNew(ctx)
	logger.Info("Got rank", "ranks.get.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	return &rankpb.RankResponse{Data: rank.ToProto(), Tracing: traceID}, nil
}

func (s *RanksService) List(ctx context.Context, _ *emptypb.Empty) (*rankpb.RanksResponse, error) {
	if s == nil || s.ranks == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("ranks service not configured")
	}
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil || requestor == nil {
		return nil, err
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permsdomain.RanksAll); err != nil {
		return nil, err
	}
	list, err := s.ranks.List(ctx)
	if err != nil {
		return nil, apperrors.Wrap(err)
	}
	traceID := TraceIDOrNew(ctx)
	logger.Info("Got ranks list", "ranks.list.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	resp := &rankpb.RanksResponse{Tracing: traceID}
	for _, r := range list {
		if r == nil {
			continue
		}
		resp.Ranks = append(resp.Ranks, r.ToProto())
	}
	return resp, nil
}

func (s *RanksService) Users(ctx context.Context, req *rankpb.NameRequest) (*rankpb.UsersResponse, error) {
	if s == nil || s.ranks == nil || s.users == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("ranks service not configured")
	}
	if req == nil {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("request is empty")
	}
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil || requestor == nil {
		return nil, err
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permsdomain.RanksAll); err != nil {
		return nil, err
	}
	name := strings.TrimSpace(req.GetName())
	if name == "" {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("rank name is empty")
	}
	ids, err := s.ranks.UsersWithRank(ctx, name)
	if err != nil {
		return nil, apperrors.Wrap(err)
	}
	traceID := TraceIDOrNew(ctx)
	logger.Info("Got users with rank", "ranks.users.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	resp := &rankpb.UsersResponse{Tracing: traceID}
	for _, uid := range ids {
		if uid == nil || *uid == 0 {
			continue
		}
		u, err := s.users.GetByID(ctx, *uid)
		if err != nil {
			return nil, apperrors.Wrap(err)
		}
		public := u.ToPublic()
		applyPresignedUserAvatarURL(ctx, s.storage, public)
		resp.Users = append(resp.Users, public)
	}
	resp.Len = uint32(len(resp.Users))
	return resp, nil
}

func (s *RanksService) Perms(ctx context.Context, req *rankpb.NameRequest) (*permspb.PermissionsResponse, error) {
	if s == nil || s.ranks == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("ranks service not configured")
	}
	if req == nil {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("request is empty")
	}
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil || requestor == nil {
		return nil, err
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permsdomain.RanksPermissionsChange); err != nil {
		return nil, err
	}
	name := strings.TrimSpace(req.GetName())
	if name == "" {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("rank name is empty")
	}
	perms, err := s.ranks.Perms(ctx, name)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, apperrors.RecordNotFound.AddErrDetails("rank not found")
		}
		return nil, apperrors.Wrap(err)
	}
	traceID := TraceIDOrNew(ctx)
	logger.Info("Got rank permissions", "ranks.perms.get.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	return &permspb.PermissionsResponse{Data: perms.ToProto(), Tracing: traceID}, nil
}

func (s *RanksService) PermsPatch(ctx context.Context, req *rankpb.PermsPatchRequest) (*rankpb.EmptyResponse, error) {
	if s == nil || s.ranks == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("ranks service not configured")
	}
	if req == nil {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("request is empty")
	}
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil || requestor == nil {
		return nil, err
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permsdomain.RanksPermissionsChange); err != nil {
		return nil, err
	}
	name := strings.TrimSpace(req.GetName())
	if name == "" {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("rank name is empty")
	}
	perm := strings.TrimSpace(req.GetPerm())
	if perm == "" {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("permission is empty")
	}
	if err := s.ranks.ChangePerms(ctx, name, permsdomain.Permission(perm), req.GetState()); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, apperrors.RecordNotFound.AddErrDetails("rank not found")
		}
		return nil, apperrors.Wrap(err)
	}
	traceID := TraceIDOrNew(ctx)
	logger.Info("Updated rank permissions", "ranks.perms.patch.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	return &rankpb.EmptyResponse{Tracing: traceID}, nil
}

func parseRankColor(raw string) (int, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return 0, apperrors.InvalidArguments.AddErrDetails("rank color is empty")
	}
	if strings.HasPrefix(trimmed, "#") {
		trimmed = trimmed[1:]
	}
	base := 10
	lowered := strings.ToLower(trimmed)
	if strings.HasPrefix(lowered, "0x") {
		base = 0
	} else {
		for _, r := range trimmed {
			if (r >= 'a' && r <= 'f') || (r >= 'A' && r <= 'F') {
				base = 16
				break
			}
		}
	}
	val, err := strconv.ParseInt(trimmed, base, 32)
	if err != nil {
		return 0, apperrors.InvalidArguments.AddErrDetails("invalid rank color")
	}
	if val <= 0 {
		return 0, apperrors.InvalidArguments.AddErrDetails("rank color is empty")
	}
	return int(val), nil
}
