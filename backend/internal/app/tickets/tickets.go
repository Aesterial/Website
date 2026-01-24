package tickets

import (
	"Aesterial/backend/internal/app/tickets/scheduler"
	"Aesterial/backend/internal/app/mailer"
	"Aesterial/backend/internal/domain/tickets"
	"Aesterial/backend/internal/domain/user"
	"Aesterial/backend/internal/infra/logger"
	apperrors "Aesterial/backend/internal/shared/errors"
	"context"
	"time"

	"github.com/google/uuid"
)

type Service struct {
	repo tickets.Repository
}

func New(r tickets.Repository, u user.Repository, m *mailer.Service) *Service {
	scheduler.Run(r, u, time.Local, m)
	return &Service{repo: r}
}

func (s *Service) Create(ctx context.Context, requestor tickets.TicketCreationRequestor, topic tickets.TicketTopic, brief string) (*tickets.TicketCreationData, error) {
	if s == nil || s.repo == nil {
		return nil, apperrors.NotConfigured
	}
	data, err := s.repo.Create(ctx, requestor, topic, brief)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "tickets.create")
		return nil, apperrors.Wrap(err)
	}
	return data, nil
}

func (s *Service) CreateMessage(ctx context.Context, id uuid.UUID, content string, req tickets.TicketDataReq) error {
	if s == nil || s.repo == nil {
		return apperrors.NotConfigured
	}
	if err := s.repo.CreateMessage(ctx, id, content, req); err != nil {
		logger.Debug("error appeared: "+err.Error(), "tickets.create_message")
		return apperrors.Wrap(err)
	}
	return nil
}

func (s *Service) Accept(ctx context.Context, id uuid.UUID, who uint) error {
	if s == nil || s.repo == nil {
		return apperrors.NotConfigured
	}
	if err := s.repo.Accept(ctx, id, who); err != nil {
		logger.Debug("error appeared: "+err.Error(), "tickets.accept")
		return apperrors.Wrap(err)
	}
	return nil
}

func (s *Service) Info(ctx context.Context, id uuid.UUID) (*tickets.Ticket, error) {
	if s == nil || s.repo == nil {
		return nil, apperrors.NotConfigured
	}
	info, err := s.repo.Info(ctx, id)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "tickets.info")
		return nil, apperrors.Wrap(err)
	}
	return info, nil
}

func (s *Service) List(ctx context.Context) (tickets.Tickets, error) {
	if s == nil || s.repo == nil {
		return nil, apperrors.NotConfigured
	}
	list, err := s.repo.List(ctx)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "tickets.list")
		return nil, apperrors.Wrap(err)
	}
	return list, nil
}

func (s *Service) Messages(ctx context.Context, id uuid.UUID) (tickets.TicketMessages, error) {
	if s == nil || s.repo == nil {
		return nil, apperrors.NotConfigured
	}
	list, err := s.repo.Messages(ctx, id)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "tickets.messages")
		return nil, apperrors.Wrap(err)
	}
	return list, nil
}

func (s *Service) Close(ctx context.Context, id uuid.UUID, by tickets.TicketClosedBy, reason string) error {
	if s == nil || s.repo == nil {
		return apperrors.NotConfigured
	}
	if err := s.repo.Close(ctx, id, by, reason); err != nil {
		logger.Debug("error appeared: "+err.Error(), "tickets.close")
		return apperrors.Wrap(err)
	}
	return nil
}

func (s *Service) IsReqValid(ctx context.Context, id uuid.UUID, req tickets.TicketDataReq) (bool, error) {
	if s == nil || s.repo == nil {
		return false, apperrors.NotConfigured
	}
	valid, err := s.repo.IsReqValid(ctx, id, req)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "tickets.is_req_valid")
		return false, apperrors.Wrap(err)
	}
	return valid, nil
}
