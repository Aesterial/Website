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
	"strconv"
	"strings"

	"github.com/google/uuid"
)

type Service struct {
	repo submissions.Repository
	proj projects.Repository
	usrs user.Repository
}

func New(repo submissions.Repository) *Service {
	return &Service{repo: repo}
}

func toGenProject(p *projects.Project) *projpb.Project {
	convAvatars := func() []*userpb.Avatar {
		var photos []*userpb.Avatar
		for _, av := range p.Info.Photos {
			photos = append(photos, av.ToPublic())
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
		id, err := uuid.Parse(strconv.Itoa(int(v.ID)))
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
		project.Author = author.ToPublic()
		response = append(response, &submpb.ListResponseTarget{Info: project, State: v.State})
	}
	return response, nil
}

func (s *Service) GetActive(ctx context.Context) ([]*submpb.ListResponseTarget, error) {
	data, err := s.GetList(ctx)
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
