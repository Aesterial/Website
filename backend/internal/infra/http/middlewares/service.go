package middlewares

import (
	"ascendant/backend/internal/domain/permissions"
	"ascendant/backend/internal/domain/sessions"

	"github.com/gin-gonic/gin"
)

type MiddleService struct {
	sessions    sessions.Repository
	permissions permissions.Repository
}

func New(repo sessions.Repository, perms permissions.Repository) *MiddleService {
	return &MiddleService{repo, perms}
}

func (s *MiddleService) Register(serv *gin.Engine) *gin.RouterGroup {
	serv.Use(s.CORS())
	serv.Use(s.Tracing())
	priv := serv.Group("")
	priv.Use(s.Authorize())
	return priv
}
