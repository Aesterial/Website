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
	Type    Type
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
	return n.Type.Valid() && n.Scope.Valid() && !n.Created.IsZero()
}

func (n *Notification) Proto() *notifypb.Notification {
	if n == nil {
		return nil
	}
	if !n.IsValid() {
		return nil
	}
	var readed, expires time.Time
	if n.Readed != nil {
		readed = *n.Readed
	}
	if n.Expires != nil {
		expires = *n.Expires
	}
	return &notifypb.Notification{
		Id:      n.ID.String(),
		Type:    n.Type.String(),
		Scope:   n.Scope.String(),
		Created: timestamppb.New(n.Created),
		Readed:  timestamppb.New(readed),
		Expires: timestamppb.New(expires),
	}
}

type Notifications []*Notification

func (n Notifications) Proto() []*notifypb.Notification {
	var list []*notifypb.Notification
	for _, element := range n {
		list = append(list, element.Proto())
	}
	return list
}
