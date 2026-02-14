package submissions

import (
	"Aesterial/backend/internal/app/config"
	"Aesterial/backend/internal/domain/projects"
	"Aesterial/backend/internal/domain/submissions"
	"Aesterial/backend/internal/domain/user"
	submpb "Aesterial/backend/internal/gen/submissions/v1"
	"Aesterial/backend/internal/infra/logger"
	apperrors "Aesterial/backend/internal/shared/errors"
	"Aesterial/backend/internal/shared/safe"
	"context"
	"strings"
	"sync"
	"time"
)

const (
	defaultHydrationWorkers = 16
	defaultHydrationTimeout = 15 * time.Second
)

type Service struct {
	repo submissions.Repository
	proj projects.Repository
	usrs user.Repository
}

func New(repo submissions.Repository, proj projects.Repository, usrs user.Repository) *Service {
	return &Service{repo: repo, proj: proj, usrs: usrs}
}

func (s *Service) GetList(ctx context.Context) ([]*submpb.Target, error) {
	data, err := s.repo.GetList(ctx)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "submissions.get_list")
		return nil, apperrors.Wrap(err)
	}
	if len(data) == 0 {
		return []*submpb.Target{}, nil
	}

	maxWorkers, hydrationTimeout := submissionsHydrationSettings()
	workers := len(data)
	if workers > maxWorkers {
		workers = maxWorkers
	}

	response := make([]*submpb.Target, len(data))
	sem := make(chan struct{}, workers)
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	var wg sync.WaitGroup
	var once sync.Once
	var firstErr error

	setErr := func(err error, logTag string) {
		if err == nil {
			return
		}
		once.Do(func() {
			logger.Debug("error appeared: "+err.Error(), logTag)
			firstErr = apperrors.Wrap(err)
			cancel()
		})
	}

	for i, v := range data {
		i, v := i, v
		wg.Add(1)
		go func() {
			defer wg.Done()
			select {
			case sem <- struct{}{}:
			case <-ctx.Done():
				return
			}
			defer func() { <-sem }()

			if v == nil {
				return
			}

			target, err := safe.GoAsync[*submpb.Target](ctx, hydrationTimeout, func(taskCtx context.Context) (*submpb.Target, error) {
				p, err := s.proj.GetProject(taskCtx, v.ProjectID)
				if err != nil {
					return nil, err
				}
				if p == nil || p.Author == nil {
					return nil, apperrors.RecordNotFound
				}

				author, err := s.usrs.GetUserByUID(taskCtx, p.Author.UID)
				if err != nil {
					return nil, err
				}
				p.Author = author

				reason := ""
				if v.Reason != nil {
					reason = *v.Reason
				}
				return &submpb.Target{
					Id:     int32(v.ID),
					Info:   p.ToProto(),
					State:  v.State,
					Reason: reason,
				}, nil
			})
			if err != nil {
				setErr(err, "submissions.get_list.hydrate")
				return
			}
			response[i] = target
		}()
	}

	wg.Wait()

	if firstErr != nil {
		return nil, firstErr
	}

	filtered := response[:0]
	for _, item := range response {
		if item != nil {
			filtered = append(filtered, item)
		}
	}
	return filtered, nil
}

func (s *Service) GetByID(ctx context.Context, id int32) (*submpb.Target, error) {
	info, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	pr, err := s.proj.GetProject(ctx, info.ProjectID)
	if err != nil {
		return nil, err
	}
	var reason string
	if info.Reason != nil {
		reason = *info.Reason
	}
	return &submpb.Target{Id: int32(info.ID), Info: pr.ToProto(), State: info.State, Reason: reason}, nil
}

func (s *Service) GetActive(ctx context.Context) ([]*submpb.Target, error) {
	data, err := s.GetList(ctx)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "submissions.get_active")
		return nil, err
	}
	var response []*submpb.Target
	for _, v := range data {
		if strings.ToLower(v.State) == "active" {
			response = append(response, v)
		}
	}
	return response, nil
}

func (s *Service) Approve(ctx context.Context, id int32) error {
	if id == 0 {
		return apperrors.InvalidArguments.AddErrDetails("invalid id")
	}
	if err := s.repo.Approve(ctx, id); err != nil {
		logger.Debug("error appeared: "+err.Error(), "submissions.approve")
		return apperrors.Wrap(err)
	}
	return nil
}

func (s *Service) Decline(ctx context.Context, id int32, reason string) error {
	if id == 0 || reason == "" {
		return apperrors.InvalidArguments.AddErrDetails("invalid data")
	}
	if err := s.repo.Decline(ctx, id, reason); err != nil {
		logger.Debug("error appeared: "+err.Error(), "submissions.decline")
		return apperrors.Wrap(err)
	}
	return nil
}

func submissionsHydrationSettings() (int, time.Duration) {
	cfg := config.Get().Async

	workers := cfg.SubmissionsHydrationWorkers
	if workers < 1 {
		workers = defaultHydrationWorkers
	}

	timeout := time.Duration(cfg.SubmissionsHydrationTimeoutSeconds) * time.Second
	if timeout <= 0 {
		timeout = defaultHydrationTimeout
	}

	return workers, timeout
}
