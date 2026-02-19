package tickets

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Repository interface {
	Create(context.Context, TicketCreationRequestor, TicketTopic, string) (*TicketCreationData, error)
	CreateMessage(context.Context, uuid.UUID, string, TicketDataReq) error
	Accept(context.Context, uuid.UUID, uint) error
	Accepted(context.Context, uuid.UUID) (bool, error)
	Info(context.Context, uuid.UUID) (*Ticket, error)
	IsReqValid(context.Context, uuid.UUID, TicketDataReq) (bool, error)
	List(context.Context, bool, *uint, *string) (Tickets, error)
	Messages(context.Context, uuid.UUID) (TicketMessages, error)
	MessagesAll(context.Context, uuid.UUID) (TicketMessages, error)
	MessageByID(context.Context, uuid.UUID, int64, bool) (*TicketMessage, error)
	IsMessageOwner(context.Context, uuid.UUID, int64, TicketDataReq) (bool, error)
	EditMessage(context.Context, uuid.UUID, int64, string, TicketDataReq) error
	DeleteMessage(context.Context, uuid.UUID, int64, *uint) error
	GetLatestMessage(context.Context, uuid.UUID) (*TicketMessage, error)
	User(context.Context, uuid.UUID, TicketDataReq) (*TicketUserData, error)
	Close(context.Context, uuid.UUID, TicketClosedBy, string) error
	IsClosed(context.Context, uuid.UUID) (bool, error)
	LatestAt(context.Context, uuid.UUID) (*time.Time, error)
}
