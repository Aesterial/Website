package grpcserver

import (
	permissionsapp "ascendant/backend/internal/app/info/permissions"
	sessionsapp "ascendant/backend/internal/app/info/sessions"
	userapp "ascendant/backend/internal/app/info/user"
	"ascendant/backend/internal/app/tickets"
	ticketsdomain "ascendant/backend/internal/domain/tickets"
	tickpb "ascendant/backend/internal/gen/tickets/v1"
	"ascendant/backend/internal/infra/logger"
	"context"

	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type TicketsService struct {
	tickpb.UnimplementedTicketsServiceServer
	auth *Authenticator
	serv *tickets.Service
}

func NewTicketsService(s *tickets.Service, sess *sessionsapp.Service, perms *permissionsapp.Service, us *userapp.Service) *TicketsService {
	return &TicketsService{serv: s, auth: NewAuthenticator(sess, perms, us)}
}

func (t *TicketsService) Create(ctx context.Context, req *tickpb.CreateRequest) (*tickpb.CreateResponse, error) {
	if t == nil || t.serv == nil {
		return nil, status.Error(codes.Internal, "projects service not configured")
	}
	if req == nil {
		return nil, status.Error(codes.InvalidArgument, "request is empty")
	}
	id, err := t.serv.Create(ctx, req.GetName(), req.GetEmail(), ticketsdomain.TicketTopic(req.GetTopic()), req.GetBrief())
	if err != nil {
		logger.Debug("error in creation ticket: " + err.Error(), "")
		return nil, status.Error(codes.Internal, "failed to create ticket")
	}
	if id == nil {
		return nil, status.Error(codes.Internal, "failed to create ticket")
	}
	return &tickpb.CreateResponse{Id: id.String(), Tracing: TraceIDOrNew(ctx)}, nil
}

func (t *TicketsService) Info(ctx context.Context, req *tickpb.TicketInfoRequest) (*tickpb.TicketInfoResponse, error) {
	if t == nil || t.serv == nil {
		return nil, status.Error(codes.Internal, "projects service not configured")
	}
	if req == nil {
		return nil, status.Error(codes.InvalidArgument, "request is empty")
	}
	id, err := uuid.Parse(req.Id)
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "id is not correct")
	}
	info, err := t.serv.Info(ctx, id)
	if err != nil {
		logger.Debug("failed to get info about ticket: " + err.Error(), "")
		return nil, status.Error(codes.Internal, "failed to get information about ticket")
	}
	return &tickpb.TicketInfoResponse{Ticket: info.ToProto(), Tracing: TraceIDOrNew(ctx)}, nil
}