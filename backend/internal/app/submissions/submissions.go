package submissions

import (
	"ascendant/backend/internal/domain/projects"
	"ascendant/backend/internal/domain/submissions"
	"ascendant/backend/internal/domain/user"
	projpb "ascendant/backend/internal/gen/projects/v1"
	submpb "ascendant/backend/internal/gen/submissions/v1"
	userpb "ascendant/backend/internal/gen/user/v1"
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type Service struct {
	repo submissions.Repository
	proj projects.Repository
	usrs user.Repository
}

func New(repo submissions.Repository) *Service {
	return &Service{repo: repo}
}

func toAvatar(av *user.Avatar) *userpb.Avatar {
	if av == nil {
		return nil
	}
	var avatar userpb.Avatar
	avatar.ContentType = av.ContentType.String
	avatar.Data = av.Data
	return &avatar
}

func toUserPublic(usr *user.User) *userpb.UserPublic {
	return &userpb.UserPublic{
		UserID:   uint32(usr.UID),
		Username: usr.Username,
		Rank:     &userpb.Rank{Name: usr.Rank.Name, Expires: timestamppb.New(*usr.Rank.Expires)},
		Settings: &userpb.UserSettings{
			DisplayName:     usr.Settings.DisplayName,
			Avatar:          toAvatar(usr.Settings.Avatar),
			SessionLiveTime: int32(usr.Settings.SessionLiveTime),
		},
		JoinedAt: timestamppb.New(usr.Joined),
	}
}

func toGenProject(p *projects.Project) *projpb.Project {
	convAvatars := func() []*userpb.Avatar {
		var photos []*userpb.Avatar
		for _, av := range p.Info.Photos {
			photos = append(photos, toAvatar(av))
		}
		return photos
	}
	cat := func() projpb.ProjectCategory {
		var c projpb.ProjectCategory
		if v, ok := projpb.ProjectCategory_value[p.Info.Category]; ok {
			c = projpb.ProjectCategory(v)
		} else {
			c = projpb.ProjectCategory_UNSPECIFIED
		}
		return c
	}
	return &projpb.Project{
		Id: p.ID.String(),
		Info: &projpb.ProjectInfo{
			Title:       p.Info.Title,
			Description: p.Info.Description,
			Photos:      convAvatars(),
			Category:    cat(),
			Location: &projpb.ProjectLocation{
				City:   p.Info.Location.City,
				Street: p.Info.Location.Street,
				House:  p.Info.Location.House,
			},
		},
	}
}

func (s *Service) GetList(ctx context.Context) ([]*submpb.ListResponseTarget, error) {
	data, err := s.repo.GetList(ctx)
	if err != nil {
		return nil, err
	}
	var response []*submpb.ListResponseTarget
	for _, v := range data {
		id, err := uuid.Parse(v.Info.Id)
		if err != nil {
			return nil, err
		}
		p, err := s.proj.GetProject(ctx, id)
		if err != nil {
			return nil, err
		}
		author, err := s.usrs.GetUserByUID(ctx, p.Author)
		if err != nil {
			return nil, err
		}
		project := toGenProject(p)
		project.Author = toUserPublic(author)
		response = append(response, &submpb.ListResponseTarget{Info: project, State: v.State})
	}
	return response, nil
}

func (s *Service) GetActive(ctx context.Context) ([]*submpb.ListResponseTarget, error) {
	data, err := s.repo.GetList(ctx)
	if err != nil {
		return nil, err
	}
	var response []*submpb.ListResponseTarget
	for _, v := range data {
		if strings.ToLower(v.State) == "active" {
			response = append(response, v)
		}
	}
	return response, nil
}

func (s *Service) Approve(ctx context.Context, id uuid.UUID) error {
	if id == uuid.Nil {
		return errors.New("invalid id")
	}
	return s.repo.Approve(ctx, id)
}

func (s *Service) Decline(ctx context.Context, id uuid.UUID, reason string) error {
	if id == uuid.Nil || reason == "" {
		return errors.New("invalid data")
	}
	return s.repo.Decline(ctx, id, reason)
}
