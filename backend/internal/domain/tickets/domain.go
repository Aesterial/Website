package tickets

import (
	"Aesterial/backend/internal/domain/user"
	tickpb "Aesterial/backend/internal/gen/tickets/v1"
	userpb "Aesterial/backend/internal/gen/user/v1"
	"Aesterial/backend/internal/infra/logger"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type TicketStatus string
type TicketTopic string
type TicketClosedBy string
type TicketMessageAuthorType string

func (t TicketMessageAuthorType) String() string {
	return string(t)
}

func (t TicketMessageAuthorType) Valid() bool {
	switch t {
	case AuthorSystem, AuthorUser, AuthorStaff:
		return true
	default:
		return false
	}
}

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
	logger.Debug(fmt.Sprintf("checking topic is valid for: %s", t.String()), "")
	switch t {
	case AccountTopic, ProjectTopic, TechnicalTopic, OtherTopic:
		logger.Debug("topic is valid", "")
		return true
	default:
		logger.Debug("topic is not valid", "")
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
	InProcessStatus TicketStatus            = "в обработке"
	ClosedStatus    TicketStatus            = "закрыт"
	WaitingStatus   TicketStatus            = "ожидает"
	AccountTopic    TicketTopic             = "аккаунт и доступ"
	ProjectTopic    TicketTopic             = "проект и заявка"
	TechnicalTopic  TicketTopic             = "техническая проблема"
	OtherTopic      TicketTopic             = "другое"
	ClosedByUser    TicketClosedBy          = "user"
	ClosedByStaff   TicketClosedBy          = "staff"
	ClosedBySystem  TicketClosedBy          = "system"
	AuthorUser      TicketMessageAuthorType = "user"
	AuthorStaff     TicketMessageAuthorType = "staff"
	AuthorSystem    TicketMessageAuthorType = "system"
)

type TicketCreator struct {
	Name       string
	Email      string
	UID        *uint
	Token      *string
	Authorized bool
}

func (t TicketCreator) ToProto() *tickpb.TicketInfoCreatorST {
	var creator tickpb.TicketInfoCreatorST
	creator.Authorized = t.Authorized
	if creator.Authorized {
		var id = int32(*t.UID)
		creator.UserID = &id
	} else {
		creator.Name = &t.Name
		creator.Email = &t.Email
	}
	return &creator
}

type NullAt time.Time

func (n *NullAt) ToProto() *timestamppb.Timestamp {
	if n == nil {
		return nil
	}
	t := time.Time(*n)
	return timestamppb.New(t)
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
	AcceptedAt  *NullAt
	ClosedAt    *NullAt
	CloseBy     TicketClosedBy
	CloseReason string
}

func (t Ticket) ToProto() *tickpb.TicketInfo {
	return &tickpb.TicketInfo{
		Id:          t.Id.String(),
		Creator:     t.Creator.ToProto(),
		Acceptor:    t.Acceptor.ToPublic(),
		Status:      t.Status.String(),
		Topic:       t.Topic.String(),
		Brief:       t.Brief,
		CreatedAt:   timestamppb.New(t.CreatedAt),
		AcceptedAt:  t.AcceptedAt.ToProto(),
		ClosedAt:    t.ClosedAt.ToProto(),
		ClosedBy:    string(t.CloseBy.String()),
		CloseReason: t.CloseReason,
	}
}

type Tickets []*Ticket

func (t Tickets) ToProto() []*tickpb.TicketInfo {
	var a []*tickpb.TicketInfo
	for _, b := range t {
		a = append(a, b.ToProto())
	}
	return a
}

type TicketMessage struct {
	ID           int
	TicketID     uuid.UUID
	Author       *TicketMessageAuthor
	Content      string
	At           time.Time
	EditedAt     *time.Time
	DeletedAt    *time.Time
	DeletedByUID *uint
}

type TicketMessageAuthor struct {
	Authorized  bool
	UID         *int64
	AuthorName  *string
	AuthorEmail *string
	Type        TicketMessageAuthorType
}

func (tm TicketMessage) ToProto() *tickpb.TicketMessage {
	out := &tickpb.TicketMessage{
		Content: tm.Content,
	}
	if !tm.At.IsZero() {
		out.At = timestamppb.New(tm.At)
	}
	if tm.Author == nil {
		return out
	}
	author := &userpb.UserPublic{}
	if tm.Author.UID != nil && *tm.Author.UID > 0 {
		author.UserID = uint32(*tm.Author.UID)
	}
	name := ""
	if tm.Author.AuthorName != nil {
		name = strings.TrimSpace(*tm.Author.AuthorName)
	}
	if name == "" {
		switch tm.Author.Type {
		case AuthorStaff:
			name = "Support"
		case AuthorSystem:
			name = "System"
		case AuthorUser:
			name = "User"
		}
	}
	if name != "" {
		author.Username = name
		displayName := name
		author.Settings = &userpb.UserPublicSettings{
			DisplayName: &displayName,
		}
	}
	switch tm.Author.Type {
	case AuthorStaff:
		author.Rank = &userpb.Rank{Name: "support"}
	case AuthorSystem:
		author.Rank = &userpb.Rank{Name: "system"}
	}
	out.Author = author
	return out
}

type TicketMessages []*TicketMessage

func (tm TicketMessages) ToProto() []*tickpb.TicketMessage {
	var a []*tickpb.TicketMessage
	for _, b := range tm {
		a = append(a, b.ToProto())
	}
	return a
}

type TicketCreationData struct {
	ID    uuid.UUID
	Token *string
}

type TicketCreationRequestor struct {
	Authorized bool
	UID        *uint
	Name       string
	Email      string
	Token      *string
}

type TicketDataReq struct {
	UID   *uint
	Token *string
	Staff bool
}

type TicketUserData struct {
	Authorized bool
	UID        *uint
	Name       string
	Email      string
}
