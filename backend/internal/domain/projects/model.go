package projects

import (
	projpb "Aesterial/backend/internal/gen/projects/v1"
	"fmt"
	"strings"
	"time"

	"Aesterial/backend/internal/domain/user"

	"github.com/google/uuid"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type projectLocation struct {
	City      string
	Latitude  float64
	Longitude float64
}

type ProjectCategory string

func (p ProjectCategory) String() string {
	return string(p)
}

const (
	otherCategory       ProjectCategory = "другое"
	parksCategory       ProjectCategory = "парки и скверы"
	playgroundsCategory ProjectCategory = "детские площадки"
	lightingCategory    ProjectCategory = "освещение"
	roadsCategory       ProjectCategory = "дороги и тротуары"
	improvementCategory ProjectCategory = "благоустройство"
)

func (p ProjectCategory) ToProto() projpb.ProjectCategory {
	switch p {
	case parksCategory:
		return projpb.ProjectCategory_PARKS
	case playgroundsCategory:
		return projpb.ProjectCategory_PLAYGROUNDS
	case lightingCategory:
		return projpb.ProjectCategory_LIGHTING
	case roadsCategory:
		return projpb.ProjectCategory_ROADSIDEWALKS
	case improvementCategory:
		return projpb.ProjectCategory_IMPROVEMENT
	case otherCategory:
		return projpb.ProjectCategory_OTHER
	default:
		return projpb.ProjectCategory_UNKNOWN
	}
}

type projectInfo struct {
	Title       string
	Description string
	Photos      user.Avatars
	Category    ProjectCategory
	Location    projectLocation
}

func (p projectInfo) ToProto() *projpb.ProjectInfo {
	return &projpb.ProjectInfo{
		Title:       p.Title,
		Description: p.Description,
		Photos:      p.Photos.ToProto(),
		Category:    p.Category.ToProto(),
		Location: &projpb.ProjectLocation{
			City:      p.Location.City,
			Latitude:  p.Location.Latitude,
			Longitude: p.Location.Longitude,
		},
	}
}

type ProjectVoteStatus string

const (
	Archived     ProjectVoteStatus = "archived"
	Implementing ProjectVoteStatus = "implementing"
	InProgress   ProjectVoteStatus = "vote in progress"
	Closed       ProjectVoteStatus = "closed"
	Published    ProjectVoteStatus = "published"
	OnModeration ProjectVoteStatus = "in moderation"
)

func (p ProjectVoteStatus) String() string {
	return string(p)
}

func (p ProjectVoteStatus) ToProto() projpb.ProjectVoteStatus {
	switch p {
	case OnModeration:
		return projpb.ProjectVoteStatus_INMODERATION
	case Published:
		return projpb.ProjectVoteStatus_PUBLISHED
	case InProgress:
		return projpb.ProjectVoteStatus_PROGRESS
	case Implementing:
		return projpb.ProjectVoteStatus_IMPLEMENTING
	case Closed:
		return projpb.ProjectVoteStatus_CLOSED
	default:
		return projpb.ProjectVoteStatus_ARCHIVED
	}
}

type Project struct {
	ID     uuid.UUID
	Author *user.User
	Info   projectInfo
	Status ProjectVoteStatus
	Likes  int
	Liked  *user.Users
	At     time.Time
}

func (p *Project) ToProto() *projpb.Project {
	var proj projpb.Project
	proj.Id = p.ID.String()
	proj.Author = p.Author.ToPublic()
	if p.Liked != nil {
		proj.Liked = p.Liked.ToPublic()
	}
	proj.LikesCount = int32(p.Likes)
	proj.CreatedAt = timestamppb.New(p.At)
	proj.Status = p.Status.ToProto()
	proj.Details = p.Info.ToProto()
	return &proj
}

type Projects []*Project

func (p Projects) ToProto() []*projpb.Project {
	var projects []*projpb.Project
	for _, project := range p {
		projects = append(projects, project.ToProto())
	}
	return projects
}

type ProjectOption func(*ProjectQuery)

type ProjectQuery struct {
	Where []string
	Args  []any
}

func (q *ProjectQuery) addWhere(cond string, args ...any) {
	placeholder := fmt.Sprintf("$%d", len(q.Args)+1)
	q.Where = append(q.Where, fmt.Sprintf(cond, placeholder))
	q.Args = append(q.Args, args...)
}

func WithStatus(status string) ProjectOption {
	return func(q *ProjectQuery) {
		q.addWhere("p.status = %s", status)
	}
}

func WithOwnerID(ownerID uuid.UUID) ProjectOption {
	return func(q *ProjectQuery) {
		q.addWhere("p.owner_id = %s", ownerID)
	}
}

func WithStatuses(statuses ...string) ProjectOption {
	return func(q *ProjectQuery) {
		if len(statuses) == 0 {
			return
		}
		ph := make([]string, 0, len(statuses))
		for _, s := range statuses {
			placeholder := fmt.Sprintf("$%d", len(q.Args)+1)
			ph = append(ph, placeholder)
			q.Args = append(q.Args, s)
		}
		q.Where = append(q.Where, "p.status IN ("+strings.Join(ph, ", ")+")")
	}
}
