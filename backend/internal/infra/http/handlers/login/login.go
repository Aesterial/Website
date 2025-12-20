package login

import (
	login "ascendant/backend/internal/app/auth"
	logindomain "ascendant/backend/internal/domain/login"
	"ascendant/backend/internal/infra/http/send"
	"net/http"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *login.Service
}

func New(service *login.Service) *Handler {
	return &Handler{
		service: service,
	}
}

func (h *Handler) Register(req *gin.Context) {
	var require logindomain.RegisterRequire
	if err := req.ShouldBindJSON(&require); err != nil {
		send.Error(req, http.StatusBadRequest, err)
		return
	}
	if _, err := h.service.Register(req.Request.Context(), require); err != nil {
		send.Error(req, http.StatusInternalServerError, err)
		return
	}
	send.OK(req, gin.H{"data": "registered"})
}

func (h *Handler) Authorization(req *gin.Context) {
	var require logindomain.AuthorizationRequire
	if err := req.ShouldBindJSON(&require); err != nil {
		send.Error(req, http.StatusBadRequest, err)
		return
	}
	if _, err := h.service.Authorization(req.Request.Context(), require); err != nil {
		send.Error(req, http.StatusInternalServerError, err)
		return
	}
	send.OK(req, gin.H{"data": "authorization"})
}
