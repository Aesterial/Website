package config

import (
	domain "ascendant/backend/internal/domain/config"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

var env domain.Environment

func envValue(keys ...string) string {
	for _, key := range keys {
		if key == "" {
			continue
		}
		raw := strings.TrimSpace(os.Getenv(key))
		if raw != "" {
			return raw
		}
	}
	return ""
}

func parseBool(key string, def bool) bool {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return def
	}
	b, err := strconv.ParseBool(raw)
	if err != nil {
		return def
	}
	return b
}

func parseInt(key string, def int) int {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return def
	}
	val, err := strconv.Atoi(raw)
	if err != nil {
		return def
	}
	return val
}

func ensure() {
	_ = godotenv.Load(".env")

	startPort := envValue("START_PORT", "BOOT_PORT")
	grpcPort := envValue("START_GRPC_PORT", "GRPC_PORT")
	if grpcPort == "" {
		grpcPort = startPort
	}
	httpPort := envValue("START_HTTP_PORT", "HTTP_PORT")

	databaseURL := envValue("DATABASE_URL")
	database := domain.Database{
		URL: databaseURL,
	}
	if databaseURL == "" {
		database.Name = envValue("POSTGRES_DB")
		database.Host = envValue("POSTGRES_HOST")
		database.Port = envValue("POSTGRES_PORT")
		database.User = envValue("POSTGRES_USER")
		database.Password = envValue("POSTGRES_PASSWORD")
	}

	env = domain.Environment{
		Database: database,
		TLS: domain.TLS{
			Use:      parseBool("TLS_USE", false),
			KeyPath:  envValue("TLS_KEY_PATH", "TLS_KEYPATH"),
			CertPath: envValue("TLS_CERT_PATH", "TLS_CERTPATH"),
		},
		Cookies: domain.Cookies{
			Name:     envValue("COOKIES_NAME"),
			Secret:   envValue("COOKIES_SECRET"),
			Domain:   envValue("COOKIES_DOMAIN"),
			SameSite: envValue("COOKIES_SAMESITE", "COOKIES_SAME_SITE"),
			Secure:   parseBool("COOKIES_SECURE", false),
		},
		Cors: domain.CORS{
			AllowedOrigins: strings.Split(envValue("CORS_ALLOWED_ORIGINS"), ","),
		},
		Startup: domain.Startup{
			Port:     startPort,
			GRPCPort: grpcPort,
			HTTPPort: httpPort,
		},
		Services: domain.Services{
			IPService: envValue("SERVICES_IP", "BOOT_IPSERVICE"),
		},
		Storage: domain.Storage{
			Endpoint:          envValue("STORAGE_ENDPOINT"),
			Region:            envValue("STORAGE_REGION"),
			Bucket:            envValue("STORAGE_BUCKET"),
			AccessKey:         envValue("STORAGE_ACCESS_KEY"),
			SecretKey:         envValue("STORAGE_SECRET_KEY"),
			UseSSL:            parseBool("STORAGE_USE_SSL", false),
			ForcePathStyle:    parseBool("STORAGE_FORCE_PATH_STYLE", false),
			PresignTTLSeconds: parseInt("STORAGE_PRESIGN_TTL_SECONDS", 900),
		},
		Mailer: domain.Mailer{
			ApiKey: envValue("MAILER_API_KEY"),
			Email:  envValue("MAILER_FROM_EMAIL"),
			Name:   envValue("MAILER_FROM_NAME"),
		},
	}
	env.MarkLoaded()
}

func Get() domain.Environment {
	if !env.Loaded() {
		ensure()
	}
	return env
}
