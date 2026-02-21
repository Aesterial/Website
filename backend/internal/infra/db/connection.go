package db

import (
	"Aesterial/backend/internal/app/config"
	"context"
	"fmt"
	"net/url"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

func NewConnection() (*pgxpool.Pool, error) {
	db := config.Get().Database
	if strings.TrimSpace(db.URL) != "" {
		dsn, err := normalizeDatabaseURL(db.URL)
		if err != nil {
			return nil, fmt.Errorf("invalid DATABASE_URL: %w", err)
		}
		return pgxpool.New(context.Background(), dsn)
	}
	dburl := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable", db.Host, db.Port, db.User, db.Password, db.Name)
	return pgxpool.New(context.Background(), dburl)
}

func normalizeDatabaseURL(raw string) (string, error) {
	u, err := url.Parse(raw)
	if err != nil {
		return "", err
	}
	if u.User != nil {
		username := u.User.Username()
		if password, ok := u.User.Password(); ok {
			u.User = url.UserPassword(username, password)
		} else {
			u.User = url.User(username)
		}
	}
	return u.String(), nil
}
