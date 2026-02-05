package scheduler

import (
	"Aesterial/backend/internal/domain/maintenance"
	"Aesterial/backend/internal/infra/logger"
	"Aesterial/backend/internal/shared/safe"
	"context"
	"time"
)

func Start(repo maintenance.Repository, ttl time.Duration) (stop func()) {
	ctx, cancel := context.WithCancel(context.Background())
	safe.Go("maintenance scheduler", func() {
		ticker := time.NewTicker(ttl)
		defer ticker.Stop()
		for range ticker.C {
			list, err := repo.GetList(ctx)
			if err != nil {
				logger.Debug("failed to get list: "+err.Error(), "")
				continue
			}
			id, can := list.CanStart(time.Now())
			if !can {
				continue
			}
			if err := repo.SetActive(ctx, id); err != nil {
				logger.Debug("error while setting maintenance to 'in progress': "+err.Error(), "")
				continue
			}
		}
	})
	return cancel
}
