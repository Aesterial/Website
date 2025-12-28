package middlewares

import (
	"ascendant/backend/internal/shared/config"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func (s *MiddleService) CORS() gin.HandlerFunc {
	allowedOrigins := strings.TrimSpace(config.ENV.CORS.AllowedOrigins)
	allowAll := allowedOrigins == "" || allowedOrigins == "*"
	origins := map[string]struct{}{}
	if !allowAll {
		for _, origin := range strings.Split(allowedOrigins, ",") {
			origin = strings.TrimSpace(origin)
			if origin == "" {
				continue
			}
			origins[origin] = struct{}{}
		}
		if len(origins) == 0 {
			allowAll = true
		}
	}

	allowCredentials := config.ENV.CORS.AllowCredentials
	allowMethods := "GET,POST,PUT,PATCH,DELETE,OPTIONS"
	defaultAllowHeaders := "Content-Type,Authorization"
	maxAge := "86400"

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		allowedOrigin := origin != "" && (allowAll || isOriginAllowed(origin, origins))
		if allowedOrigin {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Vary", "Origin")
			if allowCredentials {
				c.Header("Access-Control-Allow-Credentials", "true")
			}
		}

		if c.Request.Method == http.MethodOptions {
			if allowedOrigin {
				c.Header("Access-Control-Allow-Methods", allowMethods)
				reqHeaders := c.GetHeader("Access-Control-Request-Headers")
				if reqHeaders != "" {
					c.Header("Access-Control-Allow-Headers", reqHeaders)
				} else {
					c.Header("Access-Control-Allow-Headers", defaultAllowHeaders)
				}
				c.Header("Access-Control-Max-Age", maxAge)
			}
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

func isOriginAllowed(origin string, origins map[string]struct{}) bool {
	_, ok := origins[origin]
	return ok
}
