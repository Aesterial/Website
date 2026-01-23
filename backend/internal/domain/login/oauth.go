package login

import "strings"

type OAuthService string

const (
	OAuthServiceVK OAuthService = "vk"
)

func (s OAuthService) String() string {
	return string(s)
}

func (s OAuthService) IsValid() bool {
	switch strings.ToLower(strings.TrimSpace(s.String())) {
	case string(OAuthServiceVK):
		return true
	default:
		return false
	}
}
