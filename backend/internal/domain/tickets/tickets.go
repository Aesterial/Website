package tickets

import (
	"context"

	"github.com/google/uuid"
)

type Repository interface {
	Create(context.Context, string, string, TicketTopic, string) (*uuid.UUID, error)
	CreateMessage(context.Context, uuid.UUID, string, uint) error
	Accept(context.Context, uuid.UUID, uint) error
	Info(context.Context, uuid.UUID) (*Ticket, error)
	List(context.Context) (Tickets, error)
	Messages(context.Context, uuid.UUID) (TicketMessages, error)
	Close(context.Context, uuid.UUID, TicketClosedBy, string) error
}