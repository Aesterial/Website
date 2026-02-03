package grpcserver

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestExchangeVKCodeRequest(t *testing.T) {
	prevEndpoint := vkTokenEndpoint
	t.Cleanup(func() {
		vkTokenEndpoint = prevEndpoint
	})

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("unexpected method: got %s, want %s", r.Method, http.MethodPost)
		}
		if r.URL.RawQuery != "" {
			t.Errorf("unexpected query params: %q", r.URL.RawQuery)
		}
		contentType := r.Header.Get("Content-Type")
		if !strings.HasPrefix(contentType, "application/x-www-form-urlencoded") {
			t.Errorf("unexpected content-type: %q", contentType)
		}
		if err := r.ParseForm(); err != nil {
			t.Fatalf("parse form: %v", err)
		}

		if got := r.PostForm.Get("client_id"); got != "client-id" {
			t.Errorf("client_id mismatch: got %q", got)
		}
		if got := r.PostForm.Get("client_secret"); got != "client-secret" {
			t.Errorf("client_secret mismatch: got %q", got)
		}
		if got := r.PostForm.Get("grant_type"); got != "authorization_code" {
			t.Errorf("grant_type mismatch: got %q", got)
		}
		if got := r.PostForm.Get("code"); got != "auth-code" {
			t.Errorf("code mismatch: got %q", got)
		}
		if got := r.PostForm.Get("redirect_uri"); got != "https://aesterial.xyz/login/vk-callback" {
			t.Errorf("redirect_uri mismatch: got %q", got)
		}
		if got := r.PostForm.Get("code_verifier"); got != "code-verifier" {
			t.Errorf("code_verifier mismatch: got %q", got)
		}
		if got := r.PostForm.Get("device_id"); got != "device-id" {
			t.Errorf("device_id mismatch: got %q", got)
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"access_token":"token","email":"user@example.com","user_id":123}`)
	}))
	defer server.Close()

	vkTokenEndpoint = server.URL
	cfg := vkConfig{
		clientID:     "client-id",
		clientSecret: "client-secret",
		redirectURI:  "https://aesterial.xyz/login/vk-callback",
	}

	if _, err := exchangeVKCode(context.Background(), cfg, "auth-code", "code-verifier", "device-id"); err != nil {
		t.Fatalf("exchangeVKCode() error: %v", err)
	}
}
