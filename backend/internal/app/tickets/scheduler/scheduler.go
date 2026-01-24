package scheduler

import (
	"Aesterial/backend/internal/domain/tickets"
	"Aesterial/backend/internal/domain/user"
	"Aesterial/backend/internal/infra/logger"
	"Aesterial/backend/internal/shared/safe"
	"Aesterial/backend/internal/app/mailer"
	"context"
	"time"
)

func Run(repo tickets.Repository, usrepo user.Repository, loc *time.Location, s *mailer.Service) (stop func()) {
	if loc == nil {
		loc = time.Local
	}

	ctx, cancel := context.WithCancel(context.Background())

	safe.Go("tickets.scheduler.close", func() {
		ticker := time.NewTicker(10 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				ts, err := repo.List(ctx)
				if err != nil {
					logger.Error(
						"Failed to list tickets: "+err.Error(),
						"system.tickets.scheduler",
						logger.EventActor{Type: logger.System, ID: 0},
						logger.Failure,
					)
					continue
				}

				now := time.Now().In(loc)

				for _, t := range ts {
					at, err := repo.LatestAt(ctx, t.Id) 
					if err != nil {
						logger.Error(
							"Failed to get latest message time: "+err.Error(),
							"system.tickets.scheduler",
							logger.EventActor{Type: logger.System, ID: 0},
							logger.Failure,
						)
						continue
					}
					if at == nil {
						continue
					}

					last := at.In(loc)
					if now.Sub(last) >= 48*time.Hour {
						if err := repo.Close(ctx, t.Id, tickets.ClosedBySystem, "ticket expired"); err != nil {
							logger.Error(
								"Failed to close ticket: "+err.Error(),
								"system.tickets.scheduler",
								logger.EventActor{Type: logger.System, ID: 0},
								logger.Failure,
							)
							continue
						}
						var email string
						if t.Creator.Authorized {
							em, err := usrepo.GetEmail(ctx, *t.Creator.UID)
							if err != nil {
								logger.Error(
									"Failed to close ticket: "+err.Error(),
									"system.tickets.scheduler",
									logger.EventActor{Type: logger.System, ID: 0},
									logger.Failure,
								)
								continue
							}
							if em != nil {
								email = em.Address
							}
						} else {
							email = t.Creator.Email
						}
						_, err = s.SendTicketClose(ctx, email, t.Id.String(), "ticket expired")
						if err != nil {
							logger.Error(
								"Failed to close ticket: "+err.Error(),
								"system.tickets.scheduler",
								logger.EventActor{Type: logger.System, ID: 0},
								logger.Failure,
							)
							continue
						}
					}
				}
			}
		}
	})

	return cancel
}
