package sessions

import (
	userpb "Aesterial/backend/internal/gen/user/v1"
	"time"

	"github.com/google/uuid"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type Session struct {
	ID          uuid.UUID
	UID         uint
	Created     time.Time
	LastSeenAt  time.Time
	Expires     time.Time
	Revoked     bool
	MfaComplete bool
	AgentHash   string
}

func (s *Session) ToProto() *userpb.Session {
	if s == nil {
		return nil
	}
	var session = &userpb.Session{}
	session.Uuid = s.ID.String()
	session.Created = timestamppb.New(s.Created)
	session.LastSeen = timestamppb.New(s.LastSeenAt)
	session.Hash = s.AgentHash
	return session
}

type Sessions []*Session

func (s *Sessions) ToProto() []*userpb.Session {
	if s == nil {
		return nil
	}
	var list []*userpb.Session
	for _, l := range *s {
		list = append(list, l.ToProto())
	}
	return list
}

type Cookie struct {
	ID uuid.UUID
}
