package maintenance

import (
	"time"

	"Aesterial/backend/internal/domain/user"
	"Aesterial/backend/internal/gen/maintenance/v1"

	"github.com/google/uuid"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type Status string

func (s Status) String() string {
	return string(s)
}

type Scope string

func (s Scope) String() string {
	return string(s)
}

type Type string

func (t Type) String() string {
	return string(t)
}

const (
	ScheduledStatus Status = "scheduled"
	ProgressStatus  Status = "in progress"
	CompletedStatus Status = "completed"
	CancelledStatus Status = "cancelled"
	AllScope        Scope  = "all"
	AuthScope       Scope  = "auth"
	ProjectsScope   Scope  = "projects"
	EmergencyType   Type   = "emergency"
	PlannedType     Type   = "planned"
)

type PlannedAt struct {
	Start time.Time
	End   time.Time
}

type Actual struct {
	Start time.Time
	End   time.Time
}

type Information struct {
	ID          uuid.UUID
	Description string
	Status      Status
	Scope       Scope
	Type        Type
	Planned     *PlannedAt
	Actual      Actual
	CreatedAt   time.Time
	CalledBy    *user.User
}

type Informations []*Information

func (i Information) ToProto() *maintenance.Maintenace {
	var planned = func() *maintenance.MaintenaceStamp {
		if i.Planned == nil {
			return nil
		}
		return &maintenance.MaintenaceStamp{Start: timestamppb.New(i.Planned.Start), End: timestamppb.New(i.Planned.End)}
	}()
	return &maintenance.Maintenace{
		Id:          i.ID.String(),
		Description: i.Description,
		Status:      i.Status.String(),
		Scope:       i.Scope.String(),
		Type:        i.Type.String(),
		Planned:     planned,
		Actual: &maintenance.MaintenaceStamp{
			Start: timestamppb.New(i.Actual.Start),
			End:   timestamppb.New(i.Actual.End),
		},
		CreatedAt: timestamppb.New(i.CreatedAt),
		Creator:   i.CalledBy.ToPublic(),
	}
}

func (i Informations) ToProto() []*maintenance.Maintenace {
	var list []*maintenance.Maintenace
	for _, element := range i {
		list = append(list, element.ToProto())
	}
	return list
}

func (i Informations) CanStart(mark time.Time) (uuid.UUID, bool) {
	var found bool
	var id uuid.UUID
	for _, element := range i {
		if element.Planned.Start.Before(mark) {
			if element.Status == ScheduledStatus {
				id = element.ID
				found = true
			}
		}
		if found {
			break
		}
	}
	return id, found
}

type CreateST struct {
	Description  string
	Scope        *string
	PlannedStart time.Time
	PlannedEnd   time.Time
}

type EditST struct {
	Description *string
	Scope       *string
}
