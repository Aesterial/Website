package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	GRPC GRPCConfig
	SMTP SMTPConfig
}

type GRPCConfig struct {
	Addr string
}

type SMTPConfig struct {
	Host        string
	Port        int
	User        string
	Pass        string
	FromName    string
	FromEmail   string
	ReplyTo     string
	Secure      bool
	StartTLS    bool
	DialTimeout time.Duration
	SendTimeout time.Duration
}

func Load() (Config, error) {
	grpcAddr := strings.TrimSpace(envOrDefault("GRPC_ADDR", ":50051"))
	if grpcAddr == "" {
		return Config{}, fmt.Errorf("GRPC_ADDR is empty")
	}

	smtpHost := strings.TrimSpace(os.Getenv("SMTP_HOST"))
	if smtpHost == "" {
		return Config{}, fmt.Errorf("SMTP_HOST is required")
	}

	smtpPort, err := envInt("SMTP_PORT", 587)
	if err != nil {
		return Config{}, err
	}

	smtpUser := strings.TrimSpace(os.Getenv("SMTP_USER"))
	if smtpUser == "" {
		return Config{}, fmt.Errorf("SMTP_USER is required")
	}

	smtpPass := os.Getenv("SMTP_PASS")
	if strings.TrimSpace(smtpPass) == "" {
		return Config{}, fmt.Errorf("SMTP_PASS is required")
	}

	fromEmail := strings.TrimSpace(envOrDefault("SMTP_FROM_EMAIL", smtpUser))
	if fromEmail == "" {
		return Config{}, fmt.Errorf("SMTP_FROM_EMAIL is empty")
	}

	replyTo := strings.TrimSpace(envOrDefault("SMTP_REPLY_TO", fromEmail))
	fromName := strings.TrimSpace(envOrDefault("SMTP_FROM_NAME", "Aesterial Mail Proxy"))

	smtpSecure, err := envBool("SMTP_SECURE", false)
	if err != nil {
		return Config{}, err
	}

	smtpStartTLS, err := envBool("SMTP_STARTTLS", true)
	if err != nil {
		return Config{}, err
	}

	if smtpSecure && smtpStartTLS {
		return Config{}, fmt.Errorf("SMTP_SECURE and SMTP_STARTTLS cannot be enabled together")
	}

	dialTimeout, err := envDuration("SMTP_DIAL_TIMEOUT", 10*time.Second)
	if err != nil {
		return Config{}, err
	}

	sendTimeout, err := envDuration("SMTP_SEND_TIMEOUT", 30*time.Second)
	if err != nil {
		return Config{}, err
	}

	return Config{
		GRPC: GRPCConfig{
			Addr: grpcAddr,
		},
		SMTP: SMTPConfig{
			Host:        smtpHost,
			Port:        smtpPort,
			User:        smtpUser,
			Pass:        smtpPass,
			FromName:    fromName,
			FromEmail:   fromEmail,
			ReplyTo:     replyTo,
			Secure:      smtpSecure,
			StartTLS:    smtpStartTLS,
			DialTimeout: dialTimeout,
			SendTimeout: sendTimeout,
		},
	}, nil
}

func envOrDefault(key string, defaultValue string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return defaultValue
	}
	return value
}

func envInt(key string, defaultValue int) (int, error) {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return defaultValue, nil
	}

	result, err := strconv.Atoi(value)
	if err != nil {
		return 0, fmt.Errorf("%s must be int: %w", key, err)
	}

	if result <= 0 {
		return 0, fmt.Errorf("%s must be > 0", key)
	}

	return result, nil
}

func envBool(key string, defaultValue bool) (bool, error) {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return defaultValue, nil
	}

	result, err := strconv.ParseBool(value)
	if err != nil {
		return false, fmt.Errorf("%s must be bool: %w", key, err)
	}

	return result, nil
}

func envDuration(key string, defaultValue time.Duration) (time.Duration, error) {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return defaultValue, nil
	}

	result, err := time.ParseDuration(value)
	if err != nil {
		return 0, fmt.Errorf("%s must be duration (example: 10s): %w", key, err)
	}

	if result <= 0 {
		return 0, fmt.Errorf("%s must be > 0", key)
	}

	return result, nil
}
