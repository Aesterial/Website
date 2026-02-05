package login

import (
	"Aesterial/backend/internal/domain/login"
	"Aesterial/backend/internal/infra/logger"
	apperrors "Aesterial/backend/internal/shared/errors"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"strings"
	"time"

	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"
	"golang.org/x/crypto/bcrypt"

	qrcode "github.com/skip2/go-qrcode"
)

func (s *Service) generateTOTP(issuer string, email string) (*login.TOTPData, error) {
	key, err := totp.Generate(totp.GenerateOpts{Issuer: issuer, AccountName: email, Period: 30, Digits: otp.DigitsSix, Algorithm: otp.AlgorithmSHA1})
	if err != nil {
		return nil, err
	}
	secret := key.Secret()
	otpauthURL := key.URL()
	png, err := qrcode.Encode(otpauthURL, qrcode.Medium, 256)
	if err != nil {
		return nil, err
	}
	b64 := base64.StdEncoding.EncodeToString(png)
	url := "data:image/png;base64," + b64
	return &login.TOTPData{QR: url, URL: otpauthURL, Secret: secret}, nil
}

func (s *Service) generateRecoveryCodes() ([]string, []string, error) {
	recovery := make([]string, 0, 8)
	hashes := make([]string, 0, 8)

	for i := 0; i < 8; i++ {
		raw := make([]byte, 10)
		if _, err := rand.Read(raw); err != nil {
			return nil, nil, err
		}

		plain := hex.EncodeToString(raw)

		hash, err := bcrypt.GenerateFromPassword([]byte(plain), bcrypt.DefaultCost)
		if err != nil {
			return nil, nil, err
		}

		recovery = append(recovery, plain)
		hashes = append(hashes, string(hash))
	}

	return recovery, hashes, nil
}

func (s *Service) normalizeCode(code string) string {
	code = strings.TrimSpace(code)
	code = strings.ReplaceAll(code, " ", "")
	return code
}

func (s *Service) validateTOTP(code string, secret string) error {
	ok, err := totp.ValidateCustom(code, secret, time.Now(), totp.ValidateOpts{
		Period:    30,
		Skew:      0,
		Digits:    6,
		Algorithm: otp.AlgorithmSHA1,
	})
	if err != nil {
		return err
	}
	if !ok {
		return apperrors.InvalidArguments
	}
	return nil
}

func (s *Service) SetupTOTP(ctx context.Context, uid uint) (*login.TOTPData, error) {
	email, err := s.User.GetEmail(ctx, uid)
	if err != nil {
		return nil, err
	}
	if email == nil {
		return nil, apperrors.RecordNotFound
	}
	enabled, err := s.User.IsTOTPEnabled(ctx, uid)
	if err != nil {
		return nil, err
	}
	if enabled {
		return nil, apperrors.Conflict
	}
	data, err := s.generateTOTP("aesterial", email.Address)
	if err != nil {
		return nil, err
	}
	if err := s.User.SetPendingTOTP(ctx, uid, data.Secret); err != nil {
		return nil, err
	}
	data.Secret = ""
	return data, nil
}

func (s *Service) ConfirmTOTP(ctx context.Context, uid uint, code string) (bool, []string, error) {
	secret, err := s.User.GetPendingTOTP(ctx, uid)
	if err != nil {
		return false, nil, err
	}
	if secret == nil {
		return false, nil, apperrors.RecordNotFound
	}
	code = s.normalizeCode(code)
	if err := s.validateTOTP(code, *secret); err != nil {
		return false, nil, err
	}
	free, hash, err := s.generateRecoveryCodes()
	if err != nil {
		return false, nil, err
	}
	if err := s.User.SetConfirmed(ctx, uid); err != nil {
		return false, nil, err
	}
	strhash := func() []string {
		var list []string
		for _, h := range hash {
			list = append(list, string(h))
		}
		return list
	}()
	if err := s.User.AppendRecoveryCodes(ctx, uid, strhash); err != nil {
		return false, nil, err
	}
	if err := s.User.SetTOTPLastStep(ctx, uid, s.currentStep(time.Now(), 30)); err != nil {
		return false, nil, err
	}
	return true, free, nil
}

func (s *Service) currentStep(now time.Time, period int64) int64 {
	return now.Unix() / period
}

func (s *Service) CheckTOTP(ctx context.Context, uid uint, code string) (bool, error) {
	now := time.Now()
	enabled, err := s.User.IsTOTPEnabled(ctx, uid)
	if err != nil {
		return false, err
	}
	if !enabled {
		logger.Debug("totp is not enabled", "")
		return false, apperrors.InvalidArguments
	}
	secret, err := s.User.GetTOTPSecret(ctx, uid)
	if err != nil {
		logger.Debug("failed to receive totp secret: "+err.Error(), "")
		return false, err
	}
	lastStep, err := s.User.GetTOTPLastStep(ctx, uid)
	if err != nil {
		logger.Debug("", "")
		return false, err
	}
	ok, err := totp.ValidateCustom(code, secret, now, totp.ValidateOpts{
		Period:    30,
		Skew:      0,
		Digits:    6,
		Algorithm: otp.AlgorithmSHA1,
	})
	if err != nil {
		return false, err
	}
	if !ok {
		return false, apperrors.InvalidArguments
	}
	step := s.currentStep(now, 30)
	if lastStep != nil && step <= *lastStep {
		return false, apperrors.AlreadyUsed
	}
	if err := s.User.SetTOTPLastStep(ctx, uid, step); err != nil {
		return false, err
	}
	return true, nil
}

func (s *Service) ResetTOTPRecovery(ctx context.Context, uid uint, code string) (bool, error) {
	code = s.normalizeCode(code)
	valid, err := s.User.IsValidRecovery(ctx, uid, code)
	if err != nil {
		return false, err
	}
	if !valid {
		logger.Debug("Code is invalid", "")
		secret, err := s.User.GetTOTPSecret(ctx, uid)
		if err != nil {
			return false, err
		}
		if err := s.validateTOTP(code, secret); err != nil {
			return false, apperrors.InvalidArguments
		}
	}
	if err := s.User.ResetTOTP(ctx, uid); err != nil {
		logger.Debug("failed to reset: "+err.Error(), "")
		return false, err
	}
	codes, err := s.User.GetRecoveryCodes(ctx, uid)
	if err != nil {
		return false, err
	}
	if err := s.User.CascadeRecoveryCodes(ctx, uid, codes); err != nil {
		return false, err
	}
	return true, nil
}
