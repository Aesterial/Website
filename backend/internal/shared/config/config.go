package config

import (
	"ascendant/backend/internal/infra/logger"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

func Ensure() {
	if err := godotenv.Load(".env"); err != nil {
		logger.Warning(
			"Enviroment settings from .env not loaded: "+err.Error(),
			"system.env.load",
			logger.EventActor{Type: logger.System, ID: 0},
			logger.Failure,
		)
	}

	ENV.Database.Host = os.Getenv("DATABASE_HOST")
	ENV.Database.Port = os.Getenv("DATABASE_PORT")
	ENV.Database.Name = os.Getenv("DATABASE_NAME")
	ENV.Database.User = os.Getenv("DATABASE_USER")
	ENV.Database.Pass = os.Getenv("DATABASE_PASS")

	ENV.TLS.CertPath = os.Getenv("TLS_CERTPATH")
	ENV.TLS.KeyPath = os.Getenv("TLS_KEYPATH")

	ENV.Cookies.Name = os.Getenv("COOKIES_NAME")
	ENV.Cookies.Secret = os.Getenv("COOKIES_SECRET")
	ENV.Cookies.Domain = os.Getenv("COOKIES_DOMAIN")
	ENV.Cookies.SameSite = os.Getenv("COOKIES_SAME_SITE")
	ENV.Cookies.Secure = os.Getenv("COOKIES_SECURE") == "true"

	ENV.CORS.AllowedOrigins = os.Getenv("CORS_ALLOWED_ORIGINS")
	ENV.CORS.AllowCredentials = parseBoolEnv("CORS_ALLOW_CREDENTIALS", true)

	ENV.Boot.Port = os.Getenv("BOOT_PORT")
	ENV.Boot.IpService = os.Getenv("BOOT_IPSERVICE")
	ENV.Boot.UseTLS = parseBoolEnv("BOOT_USETLS", false)
}

func parseBoolEnv(key string, def bool) bool {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return def
	}
	b, err := strconv.ParseBool(raw)
	if err != nil {
		logger.Warning(
			"Invalid bool in ENV "+key+": "+raw,
			"system.env.parse_bool",
			logger.EventActor{Type: logger.System, ID: 0},
			logger.Failure,
		)
		return def
	}
	return b
}
