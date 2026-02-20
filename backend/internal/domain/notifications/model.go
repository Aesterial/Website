package notifications

import (
	notifypb "Aesterial/backend/internal/gen/notifications/v1"
	"time"

	"github.com/google/uuid"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type Type string
type Scope string

const (
	Message   Type  = "message"
	Notify    Type  = "notify"
	User      Scope = "user"
	Broadcast Scope = "broadcast"
	Segment   Scope = "segment"
)

func (t Type) String() string {
	return string(t)
}

func (t Type) Valid() bool {
	switch t {
	case Message, Notify:
		return true
	default:
		return false
	}
}

func (s Scope) String() string {
	return string(s)
}

func (s Scope) Valid() bool {
	switch s {
	case User, Broadcast, Segment:
		return true
	default:
		return false
	}
}

type Target struct {
	User *uint
	Rank *string
}

func (t Target) RankValid() bool {
	return t.Rank != nil
}

func (t Target) UserValid() bool {
	return t.User != nil
}

type Notification struct {
	ID      uuid.UUID
	Scope   Scope
	Body    string
	Target  Target
	Created time.Time
	Expires *time.Time
	Readed  *time.Time
}

func (n *Notification) HasUser() bool {
	return n.Scope == User || n.Target.UserValid()
}

func (n *Notification) IsValid() bool {
	return n.Scope.Valid() && !n.Created.IsZero()
}

func (n *Notification) Proto() *notifypb.Notification {
	if n == nil {
		return nil
	}
	if !n.IsValid() {
		return nil
	}

	p := &notifypb.Notification{
		Id:      n.ID.String(),
		Scope:   n.Scope.String(),
		Body:    n.Body,
		Created: timestamppb.New(n.Created),
	}

	if n.Readed != nil {
		p.Readed = timestamppb.New(*n.Readed)
	}

	if n.Expires != nil {
		p.Expires = timestamppb.New(*n.Expires)
	}

	if n.Target.User != nil {
		id := uint64(*n.Target.User)
		p.UserId = &id
	}

	if n.Target.Rank != nil {
		p.Rank = n.Target.Rank
	}

	return p
}

type Notifications []*Notification

func (n Notifications) Proto() []*notifypb.Notification {
	var list []*notifypb.Notification
	for _, element := range n {
		list = append(list, element.Proto())
	}
	return list
}
