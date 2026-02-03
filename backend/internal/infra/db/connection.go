package db

import (
	"Aesterial/backend/internal/app/config"
	"Aesterial/backend/internal/infra/logger"
	"database/sql"
	"fmt"
	"net/url"
	"strings"

	_ "github.com/lib/pq"
)

func NewConnection() (*sql.DB, error) {
	db := config.Get().Database
	if strings.TrimSpace(db.URL) != "" {
		dsn, err := normalizeDatabaseURL(db.URL)
		if err != nil {
			return nil, fmt.Errorf("invalid DATABASE_URL: %w", err)
		}
		logger.Debug("connecting to db: "+dsn, "")
		return sql.Open("postgres", dsn)
	}
	dburl := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable", db.Host, db.Port, db.User, db.Password, db.Name)
	return sql.Open("postgres", dburl)
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
