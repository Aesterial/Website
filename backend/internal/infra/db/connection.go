package db

import (
	"ascendant/backend/internal/app/config"
	"ascendant/backend/internal/infra/logger"
	"database/sql"
	"fmt"
	"strings"

	_ "github.com/lib/pq"
)

func NewConnection() (*sql.DB, error) {
	db := config.Get().Database
	if strings.TrimSpace(db.URL) != "" {
		logger.Debug("connecting to db: " + db.URL, "")
		return sql.Open("postgres", db.URL)
	}
	dburl := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable", db.Host, db.Port, db.User, db.Password, db.Name)
	logger.Debug(dburl, "")
	return sql.Open("postgres", dburl)
}
