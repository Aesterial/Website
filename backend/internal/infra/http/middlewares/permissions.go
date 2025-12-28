package middlewares

import (
	"ascendant/backend/internal/domain/permissions"
	"ascendant/backend/internal/infra/http/handlers"
	"ascendant/backend/internal/infra/http/send"
	"net/http"

	"github.com/gin-gonic/gin"
)

func (s *MiddleService) RequirePermissions(need ...permissions.Permission) gin.HandlerFunc {
	return func(c *gin.Context) {
		usr, err := handlers.GetUser(c)
		if err != nil {
			send.Error(c, http.StatusForbidden, "forbidden")
			c.Abort()
			return
		}
		ok, err := s.permissions.HasAll(c, usr.UID, need...)
		if err != nil {
			send.Error(c, http.StatusForbidden, "forbidden")
			c.Abort()
			return
		}
		if !ok {
			send.Error(c, http.StatusForbidden, "forbidden")
			c.Abort()
			return
		}
	}
}
