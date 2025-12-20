package loggerservice

import (
	"ascendant/backend/internal/infra/logger"
	"ascendant/backend/internal/shared/safe"
	"context"
	"time"
)

type Service struct {
	repo logger.Repository
}

func New(repo logger.Repository) *Service {
	return &Service{repo}
}

func (s *Service) Append(ctx context.Context, event logger.Event) error {
	return s.repo.Append(ctx, event)
}

func (s *Service) GetList(ctx context.Context, limit uint, offset uint) ([]*logger.Event, error) {
	return s.repo.GetList(ctx, limit, offset)
}
func (s *Service) Start(ctx context.Context, delta time.Duration) {
	safe.Go("logger.service.loop", func() {
		ticker := time.NewTicker(delta)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return

			case <-ticker.C:
				events := logger.DrainEvents()

				failed := make([]*logger.Event, 0, len(events))

				for _, event := range events {
					if event == nil {
						continue
					}

					ev := *event
					if err := s.Append(ctx, ev); err != nil {
						logger.Error(
							"failed to save event: "+err.Error(),
							"logger.service.loop",
							logger.EventActor{Type: logger.System, ID: 0},
							logger.Failure,
						)
						failed = append(failed, event)
					}
				}

				if len(failed) > 0 {
					logger.PushEvents(failed...)
				}
			}
		}
	})
}
