package grpcserver

import (
	"Aesterial/backend/internal/app/info/sessions"
	userapp "Aesterial/backend/internal/app/info/user"
	"Aesterial/backend/internal/app/maintenance"
	maintdomain "Aesterial/backend/internal/domain/maintenance"
	permsdomain "Aesterial/backend/internal/domain/permissions"
	maintpb "Aesterial/backend/internal/gen/maintenance/v1"
	"Aesterial/backend/internal/gen/types/v1"
	"Aesterial/backend/internal/infra/logger"
	apperrors "Aesterial/backend/internal/shared/errors"
	"time"

	"context"
	"strings"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
)

type MaintenanceService struct {
	maintpb.UnimplementedMaintenanceServiceServer
	serv *maintenance.Service
	auth *Authenticator
}

const maintenanceNotActiveMessage = "maintenance is not active"

type maintenanceNotActiveError struct{}

func (maintenanceNotActiveError) Error() string {
	return maintenanceNotActiveMessage
}

func (maintenanceNotActiveError) GRPCStatus() *status.Status {
	return status.New(codes.Unavailable, maintenanceNotActiveMessage)
}

func (maintenanceNotActiveError) Unwrap() error {
	return apperrors.Unavailable.AddErrDetails(maintenanceNotActiveMessage)
}

func NewMaintenanceService(s *maintenance.Service, ses *sessions.Service, us *userapp.Service) *MaintenanceService {
	return &MaintenanceService{serv: s, auth: NewAuthenticator(ses, us)}
}

func (s *MaintenanceService) IsActive(ctx context.Context, _ *emptypb.Empty) (*maintpb.IsSomethingResponse, error) {
	if s == nil || s.serv == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("maintenance service is not configured")
	}
	active, err := s.serv.CheckIsActive(ctx)
	if err != nil {
		logger.Debug("failed to check: "+err.Error(), "")
		return nil, apperrors.ServerError.AddErrDetails("failed to check")
	}
	return &maintpb.IsSomethingResponse{Has: active, Tracing: TraceIDOrNew(ctx)}, nil
}

func (s *MaintenanceService) IsPlanned(ctx context.Context, _ *emptypb.Empty) (*maintpb.IsSomethingResponse, error) {
	if s == nil || s.serv == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("maintenance service is not configured")
	}
	planned, err := s.serv.IsPlanned(ctx)
	if err != nil {
		return nil, apperrors.ServerError.AddErrDetails("failed to check")
	}
	return &maintpb.IsSomethingResponse{Has: planned, Tracing: TraceIDOrNew(ctx)}, nil
}

func (s *MaintenanceService) Data(ctx context.Context, _ *emptypb.Empty) (*maintpb.DataResponse, error) {
	if s == nil || s.serv == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("maintenance service is not configured")
	}
	data, err := s.serv.GetData(ctx)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), maintenanceNotActiveMessage) {
			return nil, maintenanceNotActiveError{}
		}
		logger.Debug("Failed to get maintenance data: "+err.Error(), "")
		return nil, apperrors.ServerError.AddErrDetails("failed to get data")
	}
	resp := data.ToProto()
	resp.Tracing = TraceIDOrNew(ctx)
	return resp, nil
}

func (s *MaintenanceService) Start(ctx context.Context, req *maintpb.CreateRequest) (*types.WithTracing, error) {
	if s == nil || s.serv == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("maintenance service is not configured")
	}
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil || requestor == nil {
		if err != nil {
			logger.Debug("Error while getting user: "+err.Error(), "")
		}
		return nil, apperrors.Unauthenticated.AddErrDetails("user not authenticated")
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permsdomain.RanksPermissionsChange); err != nil {
		return nil, err
	}
	if err := s.serv.Start(ctx, maintdomain.CreateST{Description: req.Description, Scope: req.Scope, PlannedStart: time.Time{}, PlannedEnd: req.WillEnd.AsTime()}, requestor.UID); err != nil {
		logger.Debug("failed to create maintenance: "+err.Error(), "")
		return nil, apperrors.ServerError.AddErrDetails("failed to create maintenance")
	}
	traceID := TraceIDOrNew(ctx)
	logger.Info("Started maintenance", "maintenance.start.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	return &types.WithTracing{Tracing: traceID}, nil
}

func (s *MaintenanceService) StartPlanned(ctx context.Context, req *maintpb.CreateRequest) (*types.WithTracing, error) {
	if s == nil || s.serv == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("maintenance service is not configured")
	}
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil || requestor == nil {
		if err != nil {
			logger.Debug("Error while getting user: "+err.Error(), "")
		}
		return nil, apperrors.Unauthenticated.AddErrDetails("user not authenticated")
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permsdomain.RanksPermissionsChange); err != nil {
		return nil, err
	}
	if err := s.serv.Start(ctx, maintdomain.CreateST{Description: req.Description, Scope: req.Scope, PlannedStart: req.WillStart.AsTime(), PlannedEnd: req.WillEnd.AsTime()}, requestor.UID); err != nil {
		return nil, apperrors.ServerError.AddErrDetails("failed to create maintenance")
	}
	traceID := TraceIDOrNew(ctx)
	logger.Info("Started planned maintenance", "maintenance.start_planned.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	return &types.WithTracing{Tracing: traceID}, nil
}

func (s *MaintenanceService) Edit(ctx context.Context, req *maintpb.EditRequest) (*types.WithTracing, error) {
	if s == nil || s.serv == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("maintenance service is not configured")
	}
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil || requestor == nil {
		if err != nil {
			logger.Debug("Error while getting user: "+err.Error(), "")
		}
		return nil, apperrors.Unauthenticated.AddErrDetails("user not authenticated")
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permsdomain.RanksPermissionsChange); err != nil {
		return nil, err
	}
	if err := s.serv.Edit(ctx, maintdomain.EditST{Description: req.Description, Scope: req.Scope}); err != nil {
		return nil, apperrors.ServerError.AddErrDetails("failed to edit maintenance")
	}
	traceID := TraceIDOrNew(ctx)
	logger.Info("Edited maintenance", "maintenance.edit.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	return &types.WithTracing{Tracing: traceID}, nil
}

func (s *MaintenanceService) Complete(ctx context.Context, _ *emptypb.Empty) (*types.WithTracing, error) {
	if s == nil || s.serv == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("maintenance service is not configured")
	}
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil || requestor == nil {
		if err != nil {
			logger.Debug("Error while getting user: "+err.Error(), "")
		}
		return nil, apperrors.Unauthenticated.AddErrDetails("user not authenticated")
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permsdomain.RanksPermissionsChange); err != nil {
		return nil, err
	}
	if err := s.serv.Complete(ctx); err != nil {
		return nil, apperrors.ServerError.AddErrDetails("failed to complete maintenance")
	}
	traceID := TraceIDOrNew(ctx)
	logger.Info("Completed maintenance", "maintenance.complete.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	return &types.WithTracing{Tracing: traceID}, nil
}
