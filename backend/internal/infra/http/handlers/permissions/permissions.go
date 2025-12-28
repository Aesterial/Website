package permissions

import "ascendant/backend/internal/app/info/permissions"

type Handler struct {
	service *permissions.Service
}

func New(service *permissions.Service) *Handler {
	return &Handler{service: service}
}
