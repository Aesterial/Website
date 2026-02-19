package grpcserver_test

import (
	"context"
	"testing"
	"time"

	"Aesterial/backend/internal/app/mailer"
	ticketsapp "Aesterial/backend/internal/app/tickets"
	ticketsdomain "Aesterial/backend/internal/domain/tickets"
	tickpb "Aesterial/backend/internal/gen/tickets/v1"
	grpcserver "Aesterial/backend/internal/infra/grpcserver"
	apperrors "Aesterial/backend/internal/shared/errors"

	"github.com/google/uuid"
)

type ticketsRepoStub struct {
	createData *ticketsdomain.TicketCreationData
	createErr  error
}

func (t *ticketsRepoStub) Create(context.Context, ticketsdomain.TicketCreationRequestor, ticketsdomain.TicketTopic, string) (*ticketsdomain.TicketCreationData, error) {
	return t.createData, t.createErr
}

func (t *ticketsRepoStub) CreateMessage(context.Context, uuid.UUID, string, ticketsdomain.TicketDataReq) error {
	return nil
}

func (t *ticketsRepoStub) Accept(context.Context, uuid.UUID, uint) error {
	return nil
}

func (t *ticketsRepoStub) Accepted(context.Context, uuid.UUID) (bool, error) {
	return false, nil
}

func (t *ticketsRepoStub) Info(context.Context, uuid.UUID) (*ticketsdomain.Ticket, error) {
	return nil, nil
}

func (t *ticketsRepoStub) IsReqValid(context.Context, uuid.UUID, ticketsdomain.TicketDataReq) (bool, error) {
	return true, nil
}

func (t *ticketsRepoStub) List(context.Context, bool, *uint, *string) (ticketsdomain.Tickets, error) {
	return nil, nil
}

func (t *ticketsRepoStub) Messages(context.Context, uuid.UUID) (ticketsdomain.TicketMessages, error) {
	return nil, nil
}

func (t *ticketsRepoStub) MessagesAll(context.Context, uuid.UUID) (ticketsdomain.TicketMessages, error) {
	return nil, nil
}

func (t *ticketsRepoStub) MessageByID(context.Context, uuid.UUID, int64, bool) (*ticketsdomain.TicketMessage, error) {
	return nil, nil
}

func (t *ticketsRepoStub) IsMessageOwner(context.Context, uuid.UUID, int64, ticketsdomain.TicketDataReq) (bool, error) {
	return true, nil
}

func (t *ticketsRepoStub) EditMessage(context.Context, uuid.UUID, int64, string, ticketsdomain.TicketDataReq) error {
	return nil
}

func (t *ticketsRepoStub) DeleteMessage(context.Context, uuid.UUID, int64, *uint) error {
	return nil
}

func (t *ticketsRepoStub) GetLatestMessage(context.Context, uuid.UUID) (*ticketsdomain.TicketMessage, error) {
	return nil, nil
}

func (t *ticketsRepoStub) User(context.Context, uuid.UUID, ticketsdomain.TicketDataReq) (*ticketsdomain.TicketUserData, error) {
	return nil, nil
}

func (t *ticketsRepoStub) Close(context.Context, uuid.UUID, ticketsdomain.TicketClosedBy, string) error {
	return nil
}

func (t *ticketsRepoStub) LatestAt(context.Context, uuid.UUID) (*time.Time, error) {
	return nil, nil
}

func (t *ticketsRepoStub) IsClosed(context.Context, uuid.UUID) (bool, error) {
	return false, nil
}

func TestTicketsServiceCreateSuccess(t *testing.T) {
	ctx, sessionsSvc, userSvc, _, _ := newAuthDeps(t, 10)
	token := "token-1"
	repo := &ticketsRepoStub{createData: &ticketsdomain.TicketCreationData{ID: uuid.New(), Token: &token}}
	svc := grpcserver.NewTicketsService(ticketsapp.New(repo, &authUserRepoStub{}, mailer.New(mailer.Config{})), sessionsSvc, userSvc, nil, nil)

	resp, err := svc.Create(ctx, &tickpb.CreateRequest{Name: "Bob", Email: "bob@example.com", Topic: "other", Brief: "help", Content: "please help"})
	if err != nil {
		t.Fatalf("Create() error: %v", err)
	}
	if resp == nil || resp.Id == "" || resp.Token == nil || *resp.Token != token {
		t.Fatalf("unexpected response: %+v", resp)
	}
}

func TestTicketsServiceMessageCreateRequiresToken(t *testing.T) {
	_, sessionsSvc, userSvc, _, _ := newAuthDeps(t, 10)
	repo := &ticketsRepoStub{}
	svc := grpcserver.NewTicketsService(ticketsapp.New(repo, &authUserRepoStub{}, mailer.New(mailer.Config{})), sessionsSvc, userSvc, nil, nil)

	_, err := svc.MessageCreate(context.Background(), &tickpb.TicketMessageCreate{Id: uuid.New().String()})
	assertAppError(t, err, apperrors.RequiredDataMissing)
}
