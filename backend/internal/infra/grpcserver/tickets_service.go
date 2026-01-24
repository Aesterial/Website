package grpcserver

import (
	sessionsapp "Aesterial/backend/internal/app/info/sessions"
	userapp "Aesterial/backend/internal/app/info/user"
	"Aesterial/backend/internal/app/tickets"
	permsdomain "Aesterial/backend/internal/domain/permissions"
	ticketsdomain "Aesterial/backend/internal/domain/tickets"
	tickpb "Aesterial/backend/internal/gen/tickets/v1"
	"Aesterial/backend/internal/infra/logger"
	apperrors "Aesterial/backend/internal/shared/errors"
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/google/uuid"
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
		return nil, apperrors.NotConfigured.AddErrDetails("projects service not configured")
	}
	if req == nil {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("request is empty")
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
		logger.Debug("error in creation ticket: "+err.Error(), "")
		return nil, apperrors.Wrap(err)
	}
	if data == nil {
		return nil, apperrors.ServerError.AddErrDetails("failed to create ticket")
	}
	return &tickpb.CreateResponse{
		Id:      data.ID.String(),
		Token:   data.Token,
		Tracing: TraceIDOrNew(ctx),
	}, nil
}

func (t *TicketsService) Info(ctx context.Context, req *tickpb.TicketInfoRequest) (*tickpb.TicketInfoResponse, error) {
	if t == nil || t.serv == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("projects service not configured")
	}
	if req == nil {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("request is empty")
	}
	id, err := uuid.Parse(req.GetId())
	if err != nil {
		return nil, apperrors.InvalidArguments.AddErrDetails("id is not correct")
	}
	info, err := t.serv.Info(ctx, id)
	if err != nil {
		logger.Debug("failed to get info about ticket: "+err.Error(), "")
		return nil, apperrors.Wrap(err)
	}
	return &tickpb.TicketInfoResponse{Ticket: info.ToProto(), Tracing: TraceIDOrNew(ctx)}, nil
}

func (t *TicketsService) Messages(ctx context.Context, req *tickpb.TicketInfoRequest) (*tickpb.TicketMessagesResponse, error) {
	if t == nil || t.serv == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("projects service not configured")
	}
	if req == nil {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("request is empty")
	}
	id, err := uuid.Parse(req.GetId())
	if err != nil {
		return nil, apperrors.InvalidArguments.AddErrDetails("id is not correct")
	}
	list, err := t.serv.Messages(ctx, id)
	if err != nil {
		return nil, apperrors.Wrap(err)
	}
	return &tickpb.TicketMessagesResponse{List: list.ToProto(), Tracing: TraceIDOrNew(ctx)}, nil
}

func (t *TicketsService) MessageCreate(ctx context.Context, req *tickpb.TicketMessageCreate) (*tickpb.EmptyResponse, error) {
	if t == nil || t.serv == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("projects service not configured")
	}
	if req == nil {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("request is empty")
	}
	id, err := uuid.Parse(req.GetId())
	if err != nil {
		return nil, apperrors.InvalidArguments.AddErrDetails("id is not correct")
	}
	var dataReq ticketsdomain.TicketDataReq
	if authUser, err := t.auth.RequireUser(ctx); err == nil && authUser != nil {
		dataReq.UID = &authUser.UID
	} else {
		token := req.GetToken()
		if token == "" {
			return nil, apperrors.RequiredDataMissing.AddErrDetails("token is required")
		}
		dataReq.Token = &token
	}
	if err := t.serv.CreateMessage(ctx, id, req.Content, dataReq); err != nil {
		logger.Debug(fmt.Sprintf("failed to create message: %s", err.Error()), "")
		return nil, apperrors.Wrap(err)
	}
	return &tickpb.EmptyResponse{Tracing: TraceIDOrNew(ctx)}, nil
}

func (t *TicketsService) CloseTicket(ctx context.Context, req *tickpb.CloseTicketRequest) (*tickpb.EmptyResponse, error) {
	if t == nil || t.serv == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("projects service not configured")
	}
	if req == nil {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("request is empty")
	}
	id, err := uuid.Parse(req.GetId())
	if err != nil {
		return nil, apperrors.InvalidArguments.AddErrDetails("id is not correct")
	}
	if err := t.serv.Close(ctx, id, ticketsdomain.ClosedBySystem, "some reason"); err != nil {
		return nil, apperrors.Wrap(err)
	}
	return &tickpb.EmptyResponse{Tracing: TraceIDOrNew(ctx)}, nil
}

func (t *TicketsService) List(ctx context.Context, _ *emptypb.Empty) (*tickpb.TicketsListResponse, error) {
	if t == nil || t.serv == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("projects service not configured")
	}
	list, err := t.serv.List(ctx)
	if err != nil {
		logger.Debug("failed to get list of tickets: "+err.Error(), "")
		return nil, apperrors.Wrap(err)
	}
	return &tickpb.TicketsListResponse{List: list.ToProto(), Tracing: TraceIDOrNew(ctx)}, nil
}

func (t *TicketsService) AcceptTicket(ctx context.Context, req *tickpb.TicketInfoRequest) (*tickpb.EmptyResponse, error) {
	if t == nil || t.serv == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("projects service not configured")
	}
	if req == nil {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("request is empty")
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
		return nil, apperrors.InvalidArguments.AddErrDetails("id is not correct")
	}
	if err := t.serv.Accept(ctx, id, requestor.UID); err != nil {
		return nil, apperrors.Wrap(err)
	}
	return &tickpb.EmptyResponse{Tracing: TraceIDOrNew(ctx)}, nil
}

func (t *TicketsService) Tickets(ctx context.Context, _ *emptypb.Empty) (*tickpb.UserTicketsResponse, error) {
	if t == nil || t.serv == nil {
		return nil, apperrors.NotConfigured
	}
	requestor, err := t.auth.RequireUser(ctx)
	if err != nil {
		return nil, err
	}
	list, err := t.serv.List(ctx)
	if err != nil {
		return nil, err
	}
	resp := make(ticketsdomain.Tickets, 0, len(list))
	for _, l := range list {
	    if l.Creator.UID != nil && *l.Creator.UID == requestor.UID {
	        resp = append(resp, l)
	    }
	}
	return &tickpb.UserTicketsResponse{Tickets: resp.ToProto(), Tracing: TraceIDOrNew(ctx)}, nil
}

// Только для не авторизованных пользователей
func (t *TicketsService) IsValid(ctx context.Context, req *tickpb.IsValidRequest) (*tickpb.IsValidResponse, error) {
	if t == nil || t.serv == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("projects service not configured")
	}
	if req == nil {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("request is empty")
	}
	requestor, err := t.auth.RequireUser(ctx)
	if err == nil || requestor != nil {
		return nil, apperrors.InvalidArguments.AddErrDetails("user registered")
	}
	id, err := uuid.Parse(req.GetId())
	if err != nil {
		return nil, apperrors.InvalidArguments.AddErrDetails("id is not correct")
	}
	token := req.GetToken()
	if token == "" {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("token is required")
	}
	exists, err := t.serv.IsReqValid(ctx, id, ticketsdomain.TicketDataReq{
		Token: &token,
	})
	if err != nil {
		logger.Debug("failed to check is requestor valid: "+err.Error(), "")
		return nil, apperrors.Wrap(err)
	}
	return &tickpb.IsValidResponse{Valid: exists, Tracing: TraceIDOrNew(ctx)}, nil
}
