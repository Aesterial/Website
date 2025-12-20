package login

import (
	domain "ascendant/backend/internal/domain/login"

	"golang.org/x/crypto/bcrypt"
)

type Service struct {
	repo domain.Repository
}

func New(repo domain.Repository) *Service {
	return &Service{repo: repo}
}

func GeneratePassword(v string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(v), bcrypt.DefaultCost)
	return string(hash), err
}
