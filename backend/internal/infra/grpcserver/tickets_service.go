package grpcserver

import (
	sessionsapp "Aesterial/backend/internal/app/info/sessions"
	userapp "Aesterial/backend/internal/app/info/user"
	"Aesterial/backend/internal/app/tickets"
	permsdomain "Aesterial/backend/internal/domain/permissions"
	ticketsdomain "Aesterial/backend/internal/domain/tickets"
	tickpb "Aesterial/backend/internal/gen/tickets/v1"
	"Aesterial/backend/internal/infra/logger"
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
)

type TicketsService struct {
	tickpb.UnimplementedTicketsServiceServer
	auth *Authenticator
	serv *tickets.Service
}

func NewTicketsService(s *tickets.Service, sess *sessionsapp.Service, us *userapp.Service) *TicketsService {
	return &TicketsService{serv: s, auth: NewAuthenticator(sess, us)}
}

func (t *TicketsService) Create(ctx context.Context, req *tickpb.CreateRequest) (*tickpb.CreateResponse, error) {
	if t == nil || t.serv == nil {
		return nil, status.Error(codes.Internal, "projects service not configured")
	}
	if req == nil {
		return nil, status.Error(codes.InvalidArgument, "request is empty")
	}
	requestor := ticketsdomain.TicketCreationRequestor{
		Name:  req.GetName(),
		Email: req.GetEmail(),
	}
	if authUser, err := t.auth.RequireUser(ctx); err == nil && authUser != nil {
		requestor.Authorized = true
		requestor.UID = &authUser.UID
	}
	data, err := t.serv.Create(ctx, requestor, ticketsdomain.TicketTopic(strings.ToLower(req.GetTopic())), req.GetBrief())
	if err != nil {
		if err.Error() == "topic is not valid" {
			return nil, status.Error(codes.InvalidArgument, "invalid topic")
		}
		logger.Debug("error in creation ticket: "+err.Error(), "")
		return nil, status.Error(codes.Internal, "failed to create ticket")
	}
	if data == nil {
		return nil, status.Error(codes.Internal, "failed to create ticket")
	}
	return &tickpb.CreateResponse{
		Id:      data.ID.String(),
		Token:   data.Token,
		Tracing: TraceIDOrNew(ctx),
	}, nil
}

func (t *TicketsService) Info(ctx context.Context, req *tickpb.TicketInfoRequest) (*tickpb.TicketInfoResponse, error) {
	if t == nil || t.serv == nil {
		return nil, status.Error(codes.Internal, "projects service not configured")
	}
	if req == nil {
		return nil, status.Error(codes.InvalidArgument, "request is empty")
	}
	id, err := uuid.Parse(req.GetId())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "id is not correct")
	}
	info, err := t.serv.Info(ctx, id)
	if err != nil {
		logger.Debug("failed to get info about ticket: "+err.Error(), "")
		return nil, status.Error(codes.Internal, "failed to get information about ticket")
	}
	return &tickpb.TicketInfoResponse{Ticket: info.ToProto(), Tracing: TraceIDOrNew(ctx)}, nil
}

func (t *TicketsService) Messages(ctx context.Context, req *tickpb.TicketInfoRequest) (*tickpb.TicketMessagesResponse, error) {
	if t == nil || t.serv == nil {
		return nil, status.Error(codes.Internal, "projects service not configured")
	}
	if req == nil {
		return nil, status.Error(codes.InvalidArgument, "request is empty")
	}
	id, err := uuid.Parse(req.GetId())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "id is not correct")
	}
	list, err := t.serv.Messages(ctx, id)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get messages list")
	}
	return &tickpb.TicketMessagesResponse{List: list.ToProto(), Tracing: TraceIDOrNew(ctx)}, nil
}

func (t *TicketsService) MessageCreate(ctx context.Context, req *tickpb.TicketMessageCreate) (*tickpb.EmptyResponse, error) {
	if t == nil || t.serv == nil {
		return nil, status.Error(codes.Internal, "projects service not configured")
	}
	if req == nil {
		return nil, status.Error(codes.InvalidArgument, "request is empty")
	}
	id, err := uuid.Parse(req.GetId())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "id is not correct")
	}
	var dataReq ticketsdomain.TicketDataReq
	if authUser, err := t.auth.RequireUser(ctx); err == nil && authUser != nil {
		dataReq.UID = &authUser.UID
	} else {
		token := req.GetToken()
		if token == "" {
			return nil, status.Error(codes.InvalidArgument, "token is required")
		}
		dataReq.Token = &token
	}
	if err := t.serv.CreateMessage(ctx, id, req.Content, dataReq); err != nil {
		logger.Debug(fmt.Sprintf("failed to create message: %s", err.Error()), "")
		return nil, status.Error(codes.Internal, "failed to create")
	}
	return &tickpb.EmptyResponse{Tracing: TraceIDOrNew(ctx)}, nil
}

func (t *TicketsService) CloseTicket(ctx context.Context, req *tickpb.CloseTicketRequest) (*tickpb.EmptyResponse, error) {
	if t == nil || t.serv == nil {
		return nil, status.Error(codes.Internal, "projects service not configured")
	}
	if req == nil {
		return nil, status.Error(codes.InvalidArgument, "request is empty")
	}
	id, err := uuid.Parse(req.GetId())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "id is not correct")
	}
	if err := t.serv.Close(ctx, id, ticketsdomain.ClosedBySystem, "some reason"); err != nil {
		return nil, status.Error(codes.Internal, "failed to close tickt")
	}
	return &tickpb.EmptyResponse{Tracing: TraceIDOrNew(ctx)}, nil
}

func (t *TicketsService) List(ctx context.Context, _ *emptypb.Empty) (*tickpb.TicketsListResponse, error) {
	if t == nil || t.serv == nil {
		return nil, status.Error(codes.Internal, "projects service not configured")
	}
	list, err := t.serv.List(ctx)
	if err != nil {
		logger.Debug("failed to get list of tickets: "+err.Error(), "")
		return nil, status.Error(codes.Internal, "Failed to get")
	}
	return &tickpb.TicketsListResponse{List: list.ToProto(), Tracing: TraceIDOrNew(ctx)}, nil
}

func (t *TicketsService) AcceptTicket(ctx context.Context, req *tickpb.TicketInfoRequest) (*tickpb.EmptyResponse, error) {
	if t == nil || t.serv == nil {
		return nil, status.Error(codes.Internal, "projects service not configured")
	}
	if req == nil {
		return nil, status.Error(codes.InvalidArgument, "request is empty")
	}
	requestor, err := t.auth.RequireUser(ctx)
	if err != nil || requestor == nil {
		return nil, err
	}
	if err := t.auth.RequirePermissions(ctx, requestor.UID, permsdomain.TicketsAccept); err != nil {
		return nil, err
	}
	id, err := uuid.Parse(req.GetId())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "id is not correct")
	}
	if err := t.serv.Accept(ctx, id, requestor.UID); err != nil {
		if err.Error() == "ticket already accepted" {
			return nil, status.Error(codes.AlreadyExists, "ticket already accepted")
		}
		return nil, status.Error(codes.Internal, "Failed to accept")
	}
	return &tickpb.EmptyResponse{Tracing: TraceIDOrNew(ctx)}, nil
}

// Только для не авторизованных пользователей
func (t *TicketsService) IsValid(ctx context.Context, req *tickpb.IsValidRequest) (*tickpb.IsValidResponse, error) {
	if t == nil || t.serv == nil {
		return nil, status.Error(codes.Internal, "projects service not configured")
	}
	if req == nil {
		return nil, status.Error(codes.InvalidArgument, "request is empty")
	}
	requestor, err := t.auth.RequireUser(ctx)
	if err == nil || requestor != nil {
		return nil, status.Error(codes.InvalidArgument, "user registered")
	}
	id, err := uuid.Parse(req.GetId())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "id is not correct")
	}
	token := req.GetToken()
	if token == "" {
		return nil, status.Error(codes.InvalidArgument, "token is required")
	}
	exists, err := t.serv.IsReqValid(ctx, id, ticketsdomain.TicketDataReq{
		Token: &token,
	})
	if err != nil {
		logger.Debug("failed to check is requestor valid: "+err.Error(), "")
		return nil, status.Error(codes.Internal, "failed to check")
	}
	return &tickpb.IsValidResponse{Valid: exists, Tracing: TraceIDOrNew(ctx)}, nil
}
