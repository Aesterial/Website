package submissions

import (
	"github.com/google/uuid"
)

type Submission struct {
	ID        int64
	ProjectID uuid.UUID
	State     string
}

func (s Submission) IsActive() bool {
	return s.State == "active"
}

func (s Submission) IsDeclined() bool {
	return s.State == "declined"
}

func (s Submission) IsWaiting() bool {
	return s.State == "waiting"
}
