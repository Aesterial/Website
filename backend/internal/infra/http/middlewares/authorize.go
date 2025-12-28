package middlewares

import (
	"ascendant/backend/internal/domain/user"
	"ascendant/backend/internal/infra/http/handlers"
	"ascendant/backend/internal/infra/http/send"
	"ascendant/backend/internal/infra/logger"
	"ascendant/backend/internal/shared/config"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func (s *MiddleService) Authorize() gin.HandlerFunc {
	return func(req *gin.Context) {
		cookie, err := handlers.GetCookie(req, config.ENV.Cookies.Name)
		if err != nil {
			logger.Debug("Failed to get cookie from request: "+err.Error(), "handlers.middleware.authorize", handlers.GetTraceID(req))
			send.Error(req, http.StatusForbidden, "failed to validate cookie")
			req.Abort()
			return
		}
		claims, err := handlers.ParseClaims(cookie)
		if err != nil {
			logger.Debug("Failed to parse claims", "handlers.middleware.authorize", handlers.GetTraceID(req))
			send.Error(req, http.StatusForbidden, "failed to validate cookie")
			req.Abort()
			return
		}
		id, err := uuid.Parse(claims.ID)
		if err != nil {
			send.Error(req, http.StatusForbidden, "failed to validate cookie")
			req.Abort()
			return
		}
		valid, err := s.sessions.IsValid(req.Request.Context(), id)
		if err != nil {
			send.Error(req, http.StatusForbidden, "failed to validate cookie")
			req.Abort()
			return
		}
		if !valid {
			send.Error(req, http.StatusForbidden, "failed to validate cookie")
			req.Abort()
			return
		}
		uid, err := s.sessions.GetUID(req.Request.Context(), id)
		if err != nil {
			send.Error(req, http.StatusForbidden, "failed to validate cookie")
			req.Abort()
			return
		}
		req.Set("user-data", user.RequestData{UID: *uid, SessionID: id})
		req.Next()
	}
}
