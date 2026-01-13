package db

import (
	"ascendant/backend/internal/app/config"
	"database/sql"
	"fmt"
	"strings"

	_ "github.com/lib/pq"
)

func NewConnection() (*sql.DB, error) {
	db := config.Get().Database
	if strings.TrimSpace(db.URL) != "" {
		return sql.Open("postgres", db.URL)
	}
	return sql.Open("postgres", fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable", db.Host, db.Port, db.User, db.Password, db.Name))
}
