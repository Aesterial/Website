package projects

import (
	"time"

	"github.com/google/uuid"
)
import "ascendant/backend/internal/domain/user"

type projectLocation struct {
	City   string
	Street string
	House  string
}

type projectInfo struct {
	Title       string
	Description string
	Photos      []*user.Avatar
	Category    string
	Location    projectLocation
}

type Project struct {
	ID     uuid.UUID
	Author uint
	Info   projectInfo
	Likes  int
	At     time.Time
}
