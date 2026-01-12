package tickets

import (
	"ascendant/backend/internal/domain/user"
	tickpb "ascendant/backend/internal/gen/tickets/v1"
	"time"

	"github.com/google/uuid"
)

type TicketStatus string
type TicketTopic string
type TicketClosedBy string

func (t TicketStatus) String() string {
	return string(t)
}

func (t TicketStatus) Valid() bool {
	switch t {
	case InProcessStatus, ClosedStatus, WaitingStatus:
		return true
	default:	
		return false
	}
}

func (t TicketTopic) String() string {
	return string(t)
}

func (t TicketTopic) Valid() bool {
	switch t {
	case AccountTopic, ProjectTopic, TechnicalTopic, OtherTopic:
		return true
	default:
		return false
	}
}

func (t TicketClosedBy) String() string {
	return string(t)
}

func (t TicketClosedBy) Valid() bool {
	switch t {
	case ClosedByUser, ClosedByStaff, ClosedBySystem:
		return true
	default:
		return false
	}
}

const (
	InProcessStatus TicketStatus   = "в обработке"
	ClosedStatus    TicketStatus   = "закрыт"
	WaitingStatus   TicketStatus   = "ожидает"
	AccountTopic    TicketTopic    = "аккаунт и доступ"
	ProjectTopic    TicketTopic    = "проект и заявка"
	TechnicalTopic  TicketTopic    = "техническая проблема"
	OtherTopic      TicketTopic    = "другое"
	ClosedByUser    TicketClosedBy = "user"
	ClosedByStaff   TicketClosedBy = "staff"
	ClosedBySystem  TicketClosedBy = "system"
)

type TicketCreator struct {
	Name  string
	Email string
}

type Ticket struct {
	Id          uuid.UUID
	Creator     TicketCreator
	Mcount      int
	Acceptor    *user.User
	Status      TicketStatus
	Topic       TicketTopic
	Brief       string
	CreatedAt   time.Time
	AcceptedAt  *time.Time
	ClosedAt    *time.Time
	CloseBy     TicketClosedBy
	CloseReason string
}

func (t *Ticket) ToProto() *tickpb.TicketInfo {
	return &tickpb.TicketInfo{
		
	}
}

type Tickets []*Ticket

func (t *Tickets) ToProto() {

}

type TicketMessage struct {
	ID      int
	Author  uint
	Content string
	At      time.Time
}

type TicketMessages []*TicketMessage

func (tm *TicketMessages) ToProto() {

}
