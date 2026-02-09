package grpcserver

import (
	sessionsapp "Aesterial/backend/internal/app/info/sessions"
	userapp "Aesterial/backend/internal/app/info/user"
	"Aesterial/backend/internal/app/mailer"
	storageapp "Aesterial/backend/internal/app/storage"
	"Aesterial/backend/internal/app/tickets"
	permsdomain "Aesterial/backend/internal/domain/permissions"
	ticketsdomain "Aesterial/backend/internal/domain/tickets"
	tickpb "Aesterial/backend/internal/gen/tickets/v1"
	userpb "Aesterial/backend/internal/gen/user/v1"
	"Aesterial/backend/internal/infra/logger"
	apperrors "Aesterial/backend/internal/shared/errors"
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"google.golang.org/protobuf/types/known/emptypb"
)

type TicketsService struct {
	tickpb.UnimplementedTicketsServiceServer
	auth    *Authenticator
	serv    *tickets.Service
	us      *userapp.Service
	mailer  *mailer.Service
	storage *storageapp.Service
}

func NewTicketsService(s *tickets.Service, sess *sessionsapp.Service, us *userapp.Service, m *mailer.Service, storage *storageapp.Service) *TicketsService {
	return &TicketsService{serv: s, us: us, auth: NewAuthenticator(sess, us), mailer: m, storage: storage}
}

func (t *TicketsService) canAcceptTicket(ctx context.Context, uid uint) (bool, error) {
	perms := []permsdomain.Permission{
		permsdomain.TicketsAccept,
		permsdomain.TicketsAll,
		permsdomain.TicketsViewListAny,
	}
	for _, perm := range perms {
		if err := t.auth.RequirePermissions(ctx, uid, perm); err == nil {
			return true, nil
		} else if !errors.Is(err, apperrors.AccessDenied) {
			return false, err
		}
	}
	return false, nil
}

func (t *TicketsService) canAccessAnyTicket(ctx context.Context, uid uint) (bool, error) {
	perms := []permsdomain.Permission{
		permsdomain.TicketsAll,
		permsdomain.TicketsViewListAny,
		permsdomain.TicketsAccept,
		permsdomain.TicketsMessageCreateAny,
		permsdomain.TicketsMessageCreateAll,
		permsdomain.TicketsCloseAny,
		permsdomain.TicketsCloseAll,
	}
	for _, perm := range perms {
		if err := t.auth.RequirePermissions(ctx, uid, perm); err == nil {
			return true, nil
		} else if !errors.Is(err, apperrors.AccessDenied) {
			return false, err
		}
	}
	return false, nil
}

func (t *TicketsService) hasAccess(ctx context.Context, id uuid.UUID, token *string) (bool, error) {
	var r ticketsdomain.TicketDataReq
	requestor, err := t.auth.RequireUser(ctx)
	if err != nil {
		if !errors.Is(err, apperrors.InvalidArguments) {
			return false, err
		}
	}
	if requestor != nil {
		r.UID = &requestor.UID
		canAny, err := t.canAccessAnyTicket(ctx, requestor.UID)
		if err != nil {
			return false, err
		}
		if canAny {
			return true, nil
		}
	}
	if r.UID == nil {
		r.Token = token
	}
	access, err := t.serv.IsReqValid(ctx, id, r)
	if err != nil {
		logger.Debug("failed to check is req valid: "+err.Error(), "")
		return false, apperrors.Wrap(err)
	}
	return access, nil
}

func (t *TicketsService) hydrateMessageAuthors(ctx context.Context, list []*tickpb.TicketMessage) {
	if len(list) == 0 {
		return
	}
	cache := make(map[uint32]*userpb.UserPublic)
	for _, message := range list {
		if message == nil || message.Author == nil {
			continue
		}
		uid := message.Author.UserID
		if uid == 0 || t == nil || t.us == nil {
			applyPresignedUserAvatarURL(ctx, t.storage, message.Author)
			continue
		}
		if cached, ok := cache[uid]; ok {
			message.Author = cached
			continue
		}
		user, err := t.us.GetByID(ctx, uint(uid))
		if err != nil || user == nil {
			applyPresignedUserAvatarURL(ctx, t.storage, message.Author)
			continue
		}
		public := user.ToPublic()
		applyPresignedUserAvatarURL(ctx, t.storage, public)
		cache[uid] = public
		message.Author = public
	}
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
	authUser, err := t.auth.RequireUser(ctx)
	if err == nil && authUser != nil {
		requestor.Authorized = true
		requestor.UID = &authUser.UID
	}
	if err != nil && !errors.Is(err, apperrors.AccessDenied) {
		return nil, apperrors.Wrap(err)
	}
	if req.GetBrief() == "" || req.GetContent() == "" || req.GetTopic() == "" {
		return nil, apperrors.InvalidArguments
	}
	data, err := t.serv.Create(ctx, requestor, ticketsdomain.TicketTopic(strings.ToLower(req.GetTopic())), req.GetBrief(), req.GetContent())
	if err != nil {
		logger.Debug("error in creation ticket: "+err.Error(), "")
		return nil, apperrors.Wrap(err)
	}
	if data == nil {
		return nil, apperrors.ServerError.AddErrDetails("failed to create ticket")
	}
	traceID := TraceIDOrNew(ctx)
	if requestor.UID != nil {
		logger.Info("Created ticket", "tickets.create.success", logger.EventActor{Type: logger.User, ID: *requestor.UID}, logger.Success, traceID)
	}
	return &tickpb.CreateResponse{
		Id:      data.ID.String(),
		Token:   data.Token,
		Tracing: traceID,
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
	access, err := t.hasAccess(ctx, id, req.Token)
	if err != nil {
		return nil, apperrors.Wrap(err)
	}
	if !access {
		return nil, apperrors.AccessDenied
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
	access, err := t.hasAccess(ctx, id, req.Token)
	if err != nil {
		return nil, apperrors.Wrap(err)
	}
	if !access {
		return nil, apperrors.AccessDenied
	}
	list, err := t.serv.Messages(ctx, id)
	if err != nil {
		return nil, apperrors.Wrap(err)
	}
	protoList := list.ToProto()
	t.hydrateMessageAuthors(ctx, protoList)
	return &tickpb.TicketMessagesResponse{List: protoList, Tracing: TraceIDOrNew(ctx)}, nil
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
		isOwner, err := t.serv.IsReqValid(ctx, id, dataReq)
		if err != nil {
			return nil, apperrors.Wrap(err)
		}
		if !isOwner {
			canAny := t.auth.RequirePermissions(ctx, authUser.UID, permsdomain.TicketsMessageCreateAny) == nil
			if !canAny {
				canAny = t.auth.RequirePermissions(ctx, authUser.UID, permsdomain.TicketsMessageCreateAll) == nil
			}
			if !canAny {
				if err := t.auth.RequirePermissions(ctx, authUser.UID, permsdomain.TicketsMessageCreateAccepted); err != nil {
					return nil, err
				}
				info, err := t.serv.Info(ctx, id)
				if err != nil {
					return nil, apperrors.Wrap(err)
				}
				if info == nil || info.Acceptor == nil || info.Acceptor.UID != authUser.UID {
					return nil, apperrors.AccessDenied
				}
			}
			dataReq.Staff = true
		}
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
	if dataReq.Staff {
		ticket, err := t.serv.Info(ctx, id)
		if err != nil {
			logger.Debug("failed to receive ticket information: "+err.Error(), "")
			return nil, apperrors.Wrap(err)
		}
		var email string
		if ticket.Creator.Authorized {
			em, err := t.us.GetEmail(ctx, *ticket.Creator.UID)
			if err != nil {
				logger.Debug("Failed to get user email: "+err.Error(), "")
				return nil, apperrors.Wrap(err)
			}
			email = em.Address
		} else {
			email = ticket.Creator.Email
		}
		sender, err := t.us.GetUsername(ctx, *dataReq.UID)
		if err != nil {
			logger.Debug("failed to get username: "+err.Error(), "")
			return nil, apperrors.Wrap(err)
		}
		mailCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		if _, err := t.mailer.SendTicketMessage(mailCtx, email, id.String(), sender, req.Content); err != nil {
			logger.Debug("failed to send ticket message: "+err.Error(), "")
		}
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
	requestor, err := t.auth.RequireUser(ctx)
	if err != nil || requestor == nil {
		return nil, err
	}
	var list ticketsdomain.Tickets
	if err := t.auth.RequirePermissions(ctx, requestor.UID, permsdomain.TicketsViewListAny); err != nil {
		return nil, err
	}
	list, err = t.serv.List(ctx, false, nil, nil)
	if err != nil {
		return nil, apperrors.Wrap(err)
	}
	return &tickpb.TicketsListResponse{List: list.ToProto(), Tracing: TraceIDOrNew(ctx)}, nil
}

func (t *TicketsService) Self(ctx context.Context, _ *emptypb.Empty) (*tickpb.TicketsListResponse, error) {
	if t == nil || t.serv == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("projects service not configured")
	}
	requestor, err := t.auth.RequireUser(ctx)
	if err != nil || requestor == nil {
		return nil, err
	}
	var list ticketsdomain.Tickets
	list, err = t.serv.List(ctx, true, &requestor.UID, nil)
	if err != nil {
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
	canAccept, err := t.canAcceptTicket(ctx, requestor.UID)
	if err != nil {
		return nil, err
	}
	if !canAccept {
		return nil, apperrors.AccessDenied
	}
	id, err := uuid.Parse(req.GetId())
	if err != nil {
		return nil, apperrors.InvalidArguments.AddErrDetails("id is not correct")
	}
	if err := t.serv.Accept(ctx, id, requestor.UID); err != nil {
		return nil, apperrors.Wrap(err)
	}
	traceID := TraceIDOrNew(ctx)
	logger.Info("Accepted ticket", "tickets.accept.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	return &tickpb.EmptyResponse{Tracing: traceID}, nil
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
		if requestor != nil {
			traceID := TraceIDOrNew(ctx)
			logger.Info("Registered user attempted ticket validation", "tickets.validate.registered", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
		}
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
