package projects

import (
	projpb "ascendant/backend/internal/gen/projects/v1"
	"time"

	"ascendant/backend/internal/domain/user"

	"github.com/google/uuid"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type projectLocation struct {
	City   string
	Street string
	House  string
}

type ProjectCategory string

func (p ProjectCategory) String() string {
	return string(p)
}

func (p ProjectCategory) ToProto() projpb.ProjectCategory {
	switch p {
	default:
		return projpb.ProjectCategory_OTHER
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
			City:   p.Location.City,
			Street: p.Location.Street,
			House:  p.Location.House,
		},
	}
}

type ProjectVoteStatus string

func (p ProjectVoteStatus) String() string {
	return string(p)
}

func (p ProjectVoteStatus) ToProto() projpb.ProjectVoteStatus {
	switch p {
	case "closed":
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
	proj.Info = p.Info.ToProto()
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
