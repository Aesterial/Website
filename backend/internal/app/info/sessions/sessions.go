package sessions

import (
	"Aesterial/backend/internal/domain/sessions"
	"Aesterial/backend/internal/infra/logger"
	apperrors "Aesterial/backend/internal/shared/errors"
	"context"
	"time"

	"github.com/google/uuid"
)

type Service struct {
	repo sessions.Repository
}

func New(repo sessions.Repository) *Service {
	return &Service{repo: repo}
}

func isValid(sessionID uuid.UUID) bool {
	if sessionID == uuid.Nil {
		return false
	}
	if _, err := uuid.Parse(sessionID.String()); err != nil {
		return false
	}
	return true
}

func (s *Service) IsValid(ctx context.Context, sessionID uuid.UUID) (bool, error) {
	if !isValid(sessionID) {
		return false, nil
	}
	return s.repo.IsValid(ctx, sessionID)
}

func (s *Service) GetSession(ctx context.Context, sessionID uuid.UUID) (*sessions.Session, error) {
	if !isValid(sessionID) {
		return nil, apperrors.InvalidArguments.AddErrDetails("invalid session id")
	}
	session, err := s.repo.GetSession(ctx, sessionID)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "sessions.get_session")
		return nil, apperrors.Wrap(err)
	}
	return session, nil
}

func (s *Service) GetSessions(ctx context.Context, uid uint) (*sessions.Sessions, error) {
	if uid == 0 {
		return nil, apperrors.InvalidArguments.AddErrDetails("uid is null")
	}
	list, err := s.repo.GetSessions(ctx, uid)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "sessions.get_sessions")
		return nil, apperrors.Wrap(err)
	}
	return list, nil
}

func (s *Service) GetUID(ctx context.Context, sessionID uuid.UUID) (*uint, error) {
	if !isValid(sessionID) {
		return nil, apperrors.InvalidArguments.AddErrDetails("invalid session id")
	}
	uid, err := s.repo.GetUID(ctx, sessionID)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "sessions.get_uid")
		return nil, apperrors.Wrap(err)
	}
	return uid, nil
}

func (s *Service) SetRevoked(ctx context.Context, sessionID uuid.UUID) error {
	if !isValid(sessionID) {
		return apperrors.InvalidArguments.AddErrDetails("invalid session id")
	}
	if err := s.repo.SetRevoked(ctx, sessionID); err != nil {
		logger.Debug("error appeared: "+err.Error(), "sessions.set_revoked")
		return apperrors.Wrap(err)
	}
	return nil
}

func (s *Service) AddSession(ctx context.Context, sessionID uuid.UUID, agentHash string, expires time.Time, uid uint) error {
	if !isValid(sessionID) {
		return apperrors.InvalidArguments.AddErrDetails("invalid session id")
	}
	if uid == 0 {
		return apperrors.InvalidArguments.AddErrDetails("uid is null")
	}
	if expires.IsZero() {
		return apperrors.InvalidArguments.AddErrDetails("expires is null")
	}
	if agentHash == "" {
		return apperrors.RequiredDataMissing.AddErrDetails("agent_hash is null")
	}
	if err := s.repo.AddSession(ctx, sessionID, agentHash, expires, uid); err != nil {
		logger.Debug("error appeared: "+err.Error(), "sessions.add_session")
		return apperrors.Wrap(err)
	}
	return nil
}
func (s *Service) UpdateLastSeen(ctx context.Context, sessionID uuid.UUID) error {
	if !isValid(sessionID) {
		return apperrors.InvalidArguments.AddErrDetails("invalid session id")
	}
	if err := s.repo.UpdateLastSeen(ctx, sessionID); err != nil {
		logger.Debug("error appeared: "+err.Error(), "sessions.update_last_seen")
		return apperrors.Wrap(err)
	}
	return nil
}

/*
 * SetMFACompleted(ctx context.Context, sessionID uuid.UUID) error
	ResetMFAs(ctx context.Context, uid uint) error
*/

func (s *Service) SetMFACompleted(ctx context.Context, sessionID uuid.UUID) error {
	if !isValid(sessionID) {
		return apperrors.InvalidArguments
	}
	return s.repo.SetMFACompleted(ctx, sessionID)
}

func (s *Service) ResetMFAs(ctx context.Context, uid uint) error {
	return s.repo.ResetMFAs(ctx, uid)
}
