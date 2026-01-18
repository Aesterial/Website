package rank

import (
	rankpb "Aesterial/backend/internal/gen/ranks/v1"
	userpb "Aesterial/backend/internal/gen/user/v1"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"
)

type Rank struct {
	Name        string
	Color       int
	Description string
	AddedAt     time.Time
}

type UserRank struct {
	Rank
	Expires *time.Time
}

func (r *UserRank) Expired() bool {
	if r.Expires == nil {
		return false
	}
	return time.Now().After(*r.Expires)
}

func (r *UserRank) ToProtoUser() *userpb.Rank {
	expires := func() *timestamppb.Timestamp {
		if r.Expires == nil {
			return nil
		}
		return timestamppb.New(*r.Expires)
	}
	return &userpb.Rank{
		Name:    r.Name,
		Color:   uint32(r.Color),
		Expires: expires(),
	}
}

func (r *Rank) ToProto() *rankpb.Rank {
	added := func() *timestamppb.Timestamp {
		if r.AddedAt.IsZero() {
			return nil
		}
		return timestamppb.New(r.AddedAt)
	}
	return &rankpb.Rank{
		Name:        r.Name,
		Color:       uint32(r.Color),
		Description: r.Description,
		Added:       added(),
	}
}
