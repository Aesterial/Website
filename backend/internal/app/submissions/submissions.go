package submissions

import (
	"Aesterial/backend/internal/domain/projects"
	"Aesterial/backend/internal/domain/submissions"
	"Aesterial/backend/internal/domain/user"
	projpb "Aesterial/backend/internal/gen/projects/v1"
	submpb "Aesterial/backend/internal/gen/submissions/v1"
	userpb "Aesterial/backend/internal/gen/user/v1"
	"Aesterial/backend/internal/infra/logger"
	apperrors "Aesterial/backend/internal/shared/errors"
	"context"
	"strings"
)

const (
	projectCategoryImprovement   = "\u0431\u043B\u0430\u0433\u043E\u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E"
	projectCategoryRoadsSidewalk = "\u0434\u043E\u0440\u043E\u0433\u0438 \u0438 \u0442\u0440\u043E\u0442\u0443\u0430\u0440\u044B"
	projectCategoryLighting      = "\u043E\u0441\u0432\u0435\u0449\u0435\u043D\u0438\u0435"
	projectCategoryPlaygrounds   = "\u0434\u0435\u0442\u0441\u043A\u0438\u0435 \u043F\u043B\u043E\u0449\u0430\u0434\u043A\u0438"
	projectCategoryParks         = "\u043F\u0430\u0440\u043A\u0438 \u0438 \u0441\u043A\u0432\u0435\u0440\u044B"
	projectCategoryOther         = "\u0434\u0440\u0443\u0433\u043E\u0435"
)

type Service struct {
	repo submissions.Repository
	proj projects.Repository
	usrs user.Repository
}

func New(repo submissions.Repository, proj projects.Repository, usrs user.Repository) *Service {
	return &Service{repo: repo, proj: proj, usrs: usrs}
}

// toGenProject переводит тип проекта из стандартного в тот, что запрашивает gRPC.
//
// Deprecated: используйте projects.Project.ToProto() вместо toGenProject(*projects.Project).
func toGenProject(p *projects.Project) *projpb.Project {
	convAvatars := func() []*userpb.Avatar {
		var photos []*userpb.Avatar
		for _, av := range p.Info.Photos {
			photos = append(photos, av.ToPublic())
		}
		return photos
	}
	cat := func() projpb.ProjectCategory {
		if v, ok := projpb.ProjectCategory_value[p.Info.Category.String()]; ok {
			return projpb.ProjectCategory(v)
		}
		switch strings.ToLower(strings.TrimSpace(p.Info.Category.String())) {
		case projectCategoryImprovement:
			return projpb.ProjectCategory_IMPROVEMENT
		case projectCategoryRoadsSidewalk:
			return projpb.ProjectCategory_ROADSIDEWALKS
		case projectCategoryLighting:
			return projpb.ProjectCategory_LIGHTING
		case projectCategoryPlaygrounds:
			return projpb.ProjectCategory_PLAYGROUNDS
		case projectCategoryParks:
			return projpb.ProjectCategory_PARKS
		case projectCategoryOther:
			return projpb.ProjectCategory_OTHER
		default:
			return projpb.ProjectCategory_UNSPECIFIED
		}
	}
	return &projpb.Project{
		Id: p.ID.String(),
		Details: &projpb.ProjectInfo{
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
		logger.Debug("error appeared: "+err.Error(), "submissions.get_list")
		return nil, apperrors.Wrap(err)
	}
	var response []*submpb.ListResponseTarget
	for _, v := range data {
		p, err := s.proj.GetProject(ctx, v.ProjectID)
		if err != nil {
			logger.Debug("error appeared: "+err.Error(), "submissions.get_list.project")
			return nil, apperrors.Wrap(err)
		}
		author, err := s.usrs.GetUserByUID(ctx, p.Author.UID)
		if err != nil {
			logger.Debug("error appeared: "+err.Error(), "submissions.get_list.author")
			return nil, apperrors.Wrap(err)
		}
		p.Author = author
		reason := ""
		if v.Reason != nil {
			reason = *v.Reason
		}
		response = append(response, &submpb.ListResponseTarget{
			Id:     int32(v.ID),
			Info:   p.ToProto(),
			State:  v.State,
			Reason: reason,
		})
	}
	return response, nil
}

func (s *Service) GetActive(ctx context.Context) ([]*submpb.ListResponseTarget, error) {
	data, err := s.GetList(ctx)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "submissions.get_active")
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

func (s *Service) Approve(ctx context.Context, id int32) error {
	if id == 0 {
		return apperrors.InvalidArguments.AddErrDetails("invalid id")
	}
	if err := s.repo.Approve(ctx, id); err != nil {
		logger.Debug("error appeared: "+err.Error(), "submissions.approve")
		return apperrors.Wrap(err)
	}
	return nil
}

func (s *Service) Decline(ctx context.Context, id int32, reason string) error {
	if id == 0 || reason == "" {
		return apperrors.InvalidArguments.AddErrDetails("invalid data")
	}
	if err := s.repo.Decline(ctx, id, reason); err != nil {
		logger.Debug("error appeared: "+err.Error(), "submissions.decline")
		return apperrors.Wrap(err)
	}
	return nil
}
