package tickets

import (
	"ascendant/backend/internal/domain/tickets"
	"context"

	"github.com/google/uuid"
)

type Service struct {
	repo tickets.Repository
}

func New(r tickets.Repository) *Service {
	return &Service{repo: r}
}

func (s *Service) Create(ctx context.Context, name, email string, topic tickets.TicketTopic, brief string) (*uuid.UUID, error) {
	return s.repo.Create(ctx, name, email, topic, brief)
}

func (s *Service) CreateMessage(ctx context.Context, id uuid.UUID, content string, author uint) error {
	return s.repo.CreateMessage(ctx, id, content, author)
}

func (s *Service) Accept(ctx context.Context, id uuid.UUID, who uint) error  {
	return s.repo.Accept(ctx, id, who)
}

func (s *Service) Info(ctx context.Context, id uuid.UUID) (*tickets.Ticket, error) {
	return s.repo.Info(ctx, id)
}

func (s *Service) List(ctx context.Context) (tickets.Tickets, error)  {
	return s.repo.List(ctx)
}

func (s *Service) Messages(ctx context.Context, id uuid.UUID) (tickets.TicketMessages, error) {
	return s.repo.Messages(ctx, id)
}

func (s *Service) Close(ctx context.Context, id uuid.UUID, by tickets.TicketClosedBy, reason string) error {
	return s.repo.Close(ctx, id, by, reason)
}