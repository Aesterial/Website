package db

import (
	appconfig "Aesterial/backend/internal/app/config"
	"Aesterial/backend/internal/domain/login"
	"Aesterial/backend/internal/domain/maintenance"
	"Aesterial/backend/internal/domain/notifications"
	"Aesterial/backend/internal/domain/permissions"
	projectdomain "Aesterial/backend/internal/domain/projects"
	"Aesterial/backend/internal/domain/rank"
	"Aesterial/backend/internal/domain/sessions"
	"Aesterial/backend/internal/domain/statistics"
	"Aesterial/backend/internal/domain/submissions"
	"Aesterial/backend/internal/domain/tickets"
	"Aesterial/backend/internal/domain/verification"
	notifypb "Aesterial/backend/internal/gen/notifications/v1"
	userpb "Aesterial/backend/internal/gen/user/v1"
	dbqueries "Aesterial/backend/internal/infra/db/queries"
	"encoding/json"
	"fmt"
	"sort"

	"Aesterial/backend/internal/domain/user"
	statpb "Aesterial/backend/internal/gen/statistics/v1"
	"Aesterial/backend/internal/infra/logger"
	apperrors "Aesterial/backend/internal/shared/errors"
	"Aesterial/backend/internal/shared/safe"
	"context"
	"crypto/rand"
	"database/sql"
	"errors"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
	"google.golang.org/protobuf/types/known/structpb"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type UserRepository struct {
	DB *pgxpool.Pool
	Q  *dbqueries.Queries
}
type RanksRepository struct {
	DB *pgxpool.Pool
	Q  *dbqueries.Queries
}
type LoggerRepository struct {
	DB *pgxpool.Pool
	Q  *dbqueries.Queries
}
type LoginRepository struct {
	DB *pgxpool.Pool
	Q  *dbqueries.Queries
}

type SessionsRepository struct {
	DB *pgxpool.Pool
	Q  *dbqueries.Queries
}

type ProjectsRepository struct {
	DB *pgxpool.Pool
	Q  *dbqueries.Queries
}

type StatisticsRepository struct {
	DB *pgxpool.Pool
	Q  *dbqueries.Queries
}

type SubmissionsRepository struct {
	DB *pgxpool.Pool
	Q  *dbqueries.Queries
}

type VerificationRepository struct {
	DB *pgxpool.Pool
	Q  *dbqueries.Queries
}

type MaintenanceRepository struct {
	DB *pgxpool.Pool
	Q  *dbqueries.Queries
}

type TicketsRepository struct {
	DB *pgxpool.Pool
	Q  *dbqueries.Queries
}

type NotificationsRepository struct {
	DB *pgxpool.Pool
	Q  *dbqueries.Queries
}

var _ user.Repository = (*UserRepository)(nil)

func NewUserRepository(db *pgxpool.Pool) *UserRepository {
	return &UserRepository{DB: db, Q: dbqueries.New(db)}
}
func NewRanksRepository(db *pgxpool.Pool) *RanksRepository {
	return &RanksRepository{DB: db, Q: dbqueries.New(db)}
}
func NewLoggerRepository(db *pgxpool.Pool) *LoggerRepository {
	return &LoggerRepository{DB: db, Q: dbqueries.New(db)}
}
func NewLoginRepository(db *pgxpool.Pool) *LoginRepository {
	return &LoginRepository{DB: db, Q: dbqueries.New(db)}
}
func NewSessionsRepository(db *pgxpool.Pool) *SessionsRepository {
	return &SessionsRepository{DB: db, Q: dbqueries.New(db)}
}
func NewStatisticsRepository(db *pgxpool.Pool) *StatisticsRepository {
	return &StatisticsRepository{DB: db, Q: dbqueries.New(db)}
}
func NewProjectsRepository(db *pgxpool.Pool) *ProjectsRepository {
	return &ProjectsRepository{DB: db, Q: dbqueries.New(db)}
}
func NewSubmissionRepository(db *pgxpool.Pool) *SubmissionsRepository {
	return &SubmissionsRepository{DB: db, Q: dbqueries.New(db)}
}
func NewVerificationRepository(db *pgxpool.Pool) *VerificationRepository {
	return &VerificationRepository{DB: db, Q: dbqueries.New(db)}
}
func NewMaintenanceRepository(db *pgxpool.Pool) *MaintenanceRepository {
	return &MaintenanceRepository{DB: db, Q: dbqueries.New(db)}
}
func NewTicketsRepository(db *pgxpool.Pool) *TicketsRepository {
	return &TicketsRepository{DB: db, Q: dbqueries.New(db)}
}
func NewNotificationsRepository(db *pgxpool.Pool) *NotificationsRepository {
	return &NotificationsRepository{DB: db, Q: dbqueries.New(db)}
}

type compositeField struct {
	Value string
	Valid bool
}

func parseComposite(raw string) ([]compositeField, error) {
	if raw == "" {
		return nil, apperrors.InvalidArguments.AddErrDetails("composite value is empty")
	}
	if raw[0] != '(' || raw[len(raw)-1] != ')' {
		return nil, fmt.Errorf("invalid composite value: %q", raw)
	}
	raw = raw[1 : len(raw)-1]
	var fields []compositeField
	var buf strings.Builder
	inQuotes := false
	escape := false
	depth := 0
	fieldQuoted := false

	flush := func() {
		val := buf.String()
		if val == "" && !fieldQuoted {
			fields = append(fields, compositeField{Valid: false})
		} else {
			fields = append(fields, compositeField{Value: val, Valid: true})
		}
		buf.Reset()
		fieldQuoted = false
	}

	for i := 0; i < len(raw); i++ {
		ch := raw[i]
		if inQuotes {
			if escape {
				buf.WriteByte(ch)
				escape = false
				continue
			}
			if ch == '\\' {
				escape = true
				continue
			}
			if ch == '"' {
				inQuotes = false
				continue
			}
			buf.WriteByte(ch)
			continue
		}
		switch ch {
		case '"':
			inQuotes = true
			if depth == 0 {
				fieldQuoted = true
			}
		case '(':
			depth++
			buf.WriteByte(ch)
		case ')':
			if depth > 0 {
				depth--
			}
			buf.WriteByte(ch)
		case ',':
			if depth == 0 {
				flush()
			} else {
				buf.WriteByte(ch)
			}
		default:
			buf.WriteByte(ch)
		}
	}
	flush()
	return fields, nil
}

func parsePostgresBool(raw string) (bool, error) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "t", "true", "1", "yes", "y":
		return true, nil
	case "f", "false", "0", "no", "n":
		return false, nil
	default:
		return false, fmt.Errorf("invalid bool value: %q", raw)
	}
}

func parsePostgresTime(raw string) (time.Time, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return time.Time{}, apperrors.InvalidArguments.AddErrDetails("time value is empty")
	}
	layouts := []string{
		"2006-01-02 15:04:05.999999999Z07:00",
		"2006-01-02 15:04:05Z07:00",
		"2006-01-02 15:04:05.999999999Z07",
		"2006-01-02 15:04:05Z07",
		"2006-01-02T15:04:05.999999999Z07:00",
		"2006-01-02T15:04:05Z07:00",
		"2006-01-02T15:04:05.999999999Z07",
		"2006-01-02T15:04:05Z07",
	}
	for _, layout := range layouts {
		if t, err := time.Parse(layout, raw); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("unsupported time format: %q", raw)
}

const usersAvatarsByUIDsQuery = `
SELECT a.user_id, a.object_key, a.content_type, a.size_bytes, a.updated_at
FROM user_avatars a
WHERE a.user_id = ANY($1::bigint[])
ORDER BY a.user_id, a.updated_at DESC
`

const usersBansByUIDsQuery = `
SELECT DISTINCT b.target
FROM bans b
WHERE b.target = ANY($1::bigint[])
`

func parseRowsToUsers(ctx context.Context, rows pgx.Rows, db *pgxpool.Pool) (user.Users, error) {
	var usrs user.Users
	uniqueUIDs := make(map[uint]struct{})
	uids := make([]uint, 0, 16)
	cols := rows.FieldDescriptions()
	defer func() {
		rows.Close()
	}()
	for rows.Next() {
		var usr = user.User{Settings: &user.Settings{Avatar: &user.Avatar{}}, Rank: &rank.UserRank{}, Email: &user.Email{}}
		switch len(cols) {
		case 3:
			if err := rows.Scan(&usr.UID, &usr.Username, &usr.Joined); err != nil {
				return nil, err
			}
		case 7:
			var emailAddress sql.NullString
			var emailVerified sql.NullBool
			var rankName sql.NullString
			var rankExpires sql.NullTime
			if err := rows.Scan(&usr.UID, &usr.Username, &emailAddress, &emailVerified, &rankName, &rankExpires, &usr.Joined); err != nil {
				return nil, err
			}
			if emailAddress.Valid {
				usr.Email.Address = emailAddress.String
			}
			if emailVerified.Valid {
				usr.Email.Verified = emailVerified.Bool
			}
			if rankName.Valid {
				usr.Rank.Name = rankName.String
			}
			if rankExpires.Valid {
				usr.Rank.Expires = &rankExpires.Time
			}
		case 8:
			var emailRaw sql.NullString
			var settingsRaw sql.NullString
			var rankRaw sql.NullString
			var permissionsRaw sql.NullString
			var password sql.NullString
			if err := rows.Scan(&usr.UID, &usr.Username, &emailRaw, &settingsRaw, &rankRaw, &permissionsRaw, &usr.Joined, &password); err != nil {
				return nil, err
			}
			password.String = ""

			if emailRaw.Valid {
				fields, err := parseComposite(emailRaw.String)
				if err != nil {
					return nil, err
				}
				if len(fields) < 2 {
					return nil, fmt.Errorf("email composite has %d fields", len(fields))
				}
				if fields[0].Valid {
					usr.Email.Address = fields[0].Value
				}
				if fields[1].Valid {
					verified, err := parsePostgresBool(fields[1].Value)
					if err != nil {
						return nil, err
					}
					usr.Email.Verified = verified
				}
			}

			if settingsRaw.Valid {
				fields, err := parseComposite(settingsRaw.String)
				if err != nil {
					return nil, err
				}
				if len(fields) >= 1 && fields[0].Valid {
					displayName := strings.TrimSpace(fields[0].Value)
					if displayName != "" {
						usr.Settings.DisplayName = &displayName
					}
				}
				if len(fields) >= 4 && fields[3].Valid && fields[3].Value != "" {
					liveTime, err := strconv.Atoi(fields[3].Value)
					if err != nil {
						logger.Debug("error on parsing user sessions live time, value: "+fields[2].Value, "")
						return nil, err
					}
					usr.Settings.SessionLiveTime = liveTime
				}
			}

			if rankRaw.Valid {
				fields, err := parseComposite(rankRaw.String)
				if err != nil {
					return nil, err
				}
				if len(fields) >= 1 && fields[0].Valid {
					usr.Rank.Name = fields[0].Value
				}
				if len(fields) >= 2 && fields[1].Valid && fields[1].Value != "" {
					expiresAt, err := parsePostgresTime(fields[1].Value)
					if err != nil {
						return nil, err
					}
					usr.Rank.Expires = &expiresAt
				}
			}
			_ = permissionsRaw

		case 14:
			var emailRaw sql.NullString
			var settingsRaw sql.NullString
			var rankRaw sql.NullString
			var permissionsRaw sql.NullString
			var password sql.NullString

			var totpEnabled bool
			var totpSecret sql.NullString
			var totpPendingSecret sql.NullString
			var totpConfirmedAt sql.NullTime
			var totpLastStep sql.NullInt64
			var totpPendingCreatedAt sql.NullTime

			if err := rows.Scan(
				&usr.UID,
				&usr.Username,
				&emailRaw,
				&settingsRaw,
				&rankRaw,
				&permissionsRaw,
				&usr.Joined,
				&password,
				&totpEnabled,
				&totpSecret,
				&totpPendingSecret,
				&totpConfirmedAt,
				&totpLastStep,
				&totpPendingCreatedAt,
			); err != nil {
				return nil, err
			}

			_ = password
			_ = totpEnabled
			_ = totpSecret
			_ = totpPendingSecret
			_ = totpConfirmedAt
			_ = totpLastStep
			_ = totpPendingCreatedAt

			if emailRaw.Valid {
				fields, err := parseComposite(emailRaw.String)
				if err != nil {
					return nil, err
				}
				if len(fields) < 2 {
					return nil, fmt.Errorf("email composite has %d fields", len(fields))
				}
				if fields[0].Valid {
					usr.Email.Address = fields[0].Value
				}
				if fields[1].Valid {
					verified, err := parsePostgresBool(fields[1].Value)
					if err != nil {
						return nil, err
					}
					usr.Email.Verified = verified
				}
			}

			if settingsRaw.Valid {
				fields, err := parseComposite(settingsRaw.String)
				if err != nil {
					return nil, err
				}
				if len(fields) >= 1 && fields[0].Valid {
					displayName := strings.TrimSpace(fields[0].Value)
					if displayName != "" {
						usr.Settings.DisplayName = &displayName
					}
				}
				if len(fields) >= 4 && fields[3].Valid && fields[3].Value != "" {
					liveTime, err := strconv.Atoi(fields[3].Value)
					if err != nil {
						logger.Debug("error on parsing user sessions live time, value: "+fields[2].Value, "")
						return nil, err
					}
					usr.Settings.SessionLiveTime = liveTime
				}
			}

			if rankRaw.Valid {
				fields, err := parseComposite(rankRaw.String)
				if err != nil {
					return nil, err
				}
				if len(fields) >= 1 && fields[0].Valid {
					usr.Rank.Name = fields[0].Value
				}
				if len(fields) >= 2 && fields[1].Valid && fields[1].Value != "" {
					expiresAt, err := parsePostgresTime(fields[1].Value)
					if err != nil {
						return nil, err
					}
					usr.Rank.Expires = &expiresAt
				}
			}

			_ = permissionsRaw
		default:
			return nil, fmt.Errorf("unexpected users columns count: %d", len(cols))
		}
		if _, seen := uniqueUIDs[usr.UID]; !seen {
			uniqueUIDs[usr.UID] = struct{}{}
			uids = append(uids, usr.UID)
		}
		userCopy := usr
		usrs = append(usrs, &userCopy)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if len(usrs) == 0 || db == nil || len(uids) == 0 {
		return usrs, nil
	}

	avatarsByUID, err := batchGetAvatarsByUID(ctx, db, uids)
	if err != nil {
		return nil, err
	}

	bannedByUID, err := batchGetBannedByUID(ctx, db, uids)
	if err != nil {
		return nil, err
	}

	for _, usr := range usrs {
		if usr == nil {
			continue
		}
		if usr.Settings == nil {
			usr.Settings = &user.Settings{}
		}
		if avatar, ok := avatarsByUID[usr.UID]; ok {
			usr.Settings.Avatar = avatar
		} else {
			usr.Settings.Avatar = nil
		}
		usr.Banned = bannedByUID[usr.UID]
	}

	return usrs, nil
}

func batchGetAvatarsByUID(ctx context.Context, db *pgxpool.Pool, uids []uint) (map[uint]*user.Avatar, error) {
	result := make(map[uint]*user.Avatar, len(uids))
	if len(uids) == 0 {
		return result, nil
	}

	userIDs := make([]int64, 0, len(uids))
	for _, uid := range uids {
		userIDs = append(userIDs, int64(uid))
	}

	rows, err := db.Query(ctx, usersAvatarsByUIDsQuery, userIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var userID int64
		var key sql.NullString
		var contentType sql.NullString
		var sizeBytes sql.NullInt64
		var updatedAt sql.NullTime
		if err := rows.Scan(&userID, &key, &contentType, &sizeBytes, &updatedAt); err != nil {
			return nil, err
		}
		uid := uint(userID)
		if _, exists := result[uid]; exists {
			continue
		}
		if !key.Valid || strings.TrimSpace(key.String) == "" {
			continue
		}
		avatar := &user.Avatar{
			Key:         key.String,
			ContentType: contentType.String,
		}
		if sizeBytes.Valid {
			avatar.SizeBytes = int(sizeBytes.Int64)
		}
		if updatedAt.Valid {
			avatar.Updated = updatedAt.Time
		}
		result[uid] = avatar
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return result, nil
}

func batchGetBannedByUID(ctx context.Context, db *pgxpool.Pool, uids []uint) (map[uint]bool, error) {
	result := make(map[uint]bool, len(uids))
	if len(uids) == 0 {
		return result, nil
	}

	userIDs := make([]int64, 0, len(uids))
	for _, uid := range uids {
		userIDs = append(userIDs, int64(uid))
	}

	rows, err := db.Query(ctx, usersBansByUIDsQuery, userIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var userID int64
		if err := rows.Scan(&userID); err != nil {
			return nil, err
		}
		result[uint(userID)] = true
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return result, nil
}

const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

func generateString(n int) (string, error) {
	if n <= 0 {
		return "", nil
	}

	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("rand.Read: %w", err)
	}

	out := make([]byte, n)
	for i := range n {
		out[i] = letters[int(b[i])%len(letters)]
	}
	return string(out), nil
}

func (u *UserRepository) GetList(ctx context.Context) ([]*userpb.UserPublic, error) {
	rows, err := u.DB.Query(ctx, dbqueries.UserRepositoryGetList1)
	if err != nil {
		return nil, err
	}
	usrs, err := parseRowsToUsers(ctx, rows, u.DB)
	if err != nil {
		return nil, err
	}
	return usrs.ToPublic(), nil
}

func (u *UserRepository) GetUID(ctx context.Context, name string) (uint, error) {
	row := u.DB.QueryRow(ctx, dbqueries.UserRepositoryGetUID1, name)
	var uid uint
	if err := row.Scan(&uid); err != nil {
		return 0, err
	}
	return uid, nil
}

func (u *UserRepository) GetUsername(ctx context.Context, uid uint) (string, error) {
	row := u.DB.QueryRow(ctx, dbqueries.UserRepositoryGetUsername1, uid)
	var username string
	if err := row.Scan(&username); err != nil {
		return "", err
	}
	return username, nil
}

func (u *UserRepository) GetEmail(ctx context.Context, uid uint) (*user.Email, error) {
	row := u.DB.QueryRow(ctx, dbqueries.UserRepositoryGetEmail1, uid)
	var email user.Email
	if err := row.Scan(&email.Address, &email.Verified); err != nil {
		logger.Debug("failed to receive email: "+err.Error(), "")
		return nil, err
	}
	return &email, nil
}

func (u *UserRepository) GetRank(ctx context.Context, uid uint) (*rank.UserRank, error) {
	row := u.DB.QueryRow(ctx, dbqueries.UserRepositoryGetRank1, uid)
	var r rank.UserRank
	var expires sql.NullTime
	if err := row.Scan(&r.Name, &expires); err != nil {
		return nil, err
	}
	if expires.Valid {
		r.Expires = &expires.Time
	}
	return &r, nil
}

func (u *UserRepository) GetJoinedAT(ctx context.Context, uid uint) (*time.Time, error) {
	row := u.DB.QueryRow(ctx, dbqueries.UserRepositoryGetJoinedAT1, uid)
	var t time.Time
	if err := row.Scan(&t); err != nil {
		return nil, err
	}
	return &t, nil
}

func (u *UserRepository) GetUserLastActive(ctx context.Context, uid uint) (*time.Time, error) {
	var at time.Time

	err := u.DB.QueryRow(ctx, dbqueries.UserRepositoryGetUserLastActive1, uid).Scan(&at)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			logger.Debug("record not found", "")
			return nil, nil
		}
		logger.Debug("failed to receive last active: "+err.Error(), "")
		return nil, err
	}

	return &at, nil
}

func (u *UserRepository) GetSettings(ctx context.Context, uid uint) (*user.Settings, error) {
	var err error
	rowMain := u.DB.QueryRow(ctx,
		dbqueries.UserRepositoryGetSettings1,
		uid)
	var s user.Settings
	var displayName sql.NullString
	var description sql.NullString
	if err = rowMain.Scan(&s.SessionLiveTime, &displayName, &description); err != nil {
		return nil, err
	}
	if displayName.Valid {
		if displayName.String != "" {
			s.DisplayName = &displayName.String
		}
	}
	if description.Valid {
		s.Description = description.String
	}
	s.Avatar, err = u.GetAvatar(ctx, uid)
	if err != nil {
		return nil, err
	}
	s.TOTPEnabled, err = u.IsTOTPEnabled(ctx, uid)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (u *UserRepository) GetUserByUID(ctx context.Context, uid uint) (*user.User, error) {
	var us user.User
	us.UID = uid
	if exists, err := u.IsExistsByUID(ctx, uid); err != nil || !exists {
		return nil, err
	}
	var err error
	us.Username, err = u.GetUsername(ctx, uid)
	if err != nil {
		return nil, err
	}
	at, err := u.GetJoinedAT(ctx, uid)
	if err != nil {
		return nil, err
	}
	if at == nil {
		return nil, apperrors.ServerError.AddErrDetails("joined at pointer is null")
	}
	us.Joined = *at
	us.Email, err = u.GetEmail(ctx, uid)
	if err != nil {
		return nil, err
	}
	us.Rank, err = u.GetRank(ctx, uid)
	if err != nil {
		return nil, err
	}
	us.Settings, err = u.GetSettings(ctx, uid)
	if err != nil {
		return nil, err
	}
	us.Active, err = u.GetUserLastActive(ctx, uid)
	if err != nil {
		return nil, err
	}
	return &us, nil
}

func (u *UserRepository) GetUserByUsername(ctx context.Context, username string) (*user.User, error) {
	uid, err := u.GetUID(ctx, username)
	if err != nil {
		return nil, err
	}
	return u.GetUserByUID(ctx, uid)
}

func (u *UserRepository) GetUserSessionLiveTime(ctx context.Context, uid uint) (*user.SessionTime, error) {
	if uid == 0 {
		return nil, apperrors.InvalidArguments.AddErrDetails("uid is zero")
	}
	var liveTime int
	if err := u.DB.QueryRow(ctx, dbqueries.UserRepositoryGetUserSessionLiveTime1, uid).Scan(&liveTime); err != nil {
		return nil, err
	}
	var sessionTime user.SessionTime
	sessionTime.Text = strconv.Itoa(liveTime)
	sessionTime.Duration = time.Duration(liveTime) * 24 * time.Hour
	return &sessionTime, nil
}

func (u *UserRepository) GetAvatar(ctx context.Context, uid uint) (*user.Avatar, error) {
	if uid == 0 {
		return nil, apperrors.InvalidArguments.AddErrDetails("uid is zero")
	}
	var avatar user.Avatar
	var record struct {
		key         sql.NullString
		contentType sql.NullString
		sizeBytes   sql.NullInt64
		updatedAt   sql.NullTime
	}
	if err := u.DB.QueryRow(ctx, dbqueries.UserRepositoryGetAvatar1, uid).Scan(&record.key, &record.contentType, &record.sizeBytes, &record.updatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if !record.key.Valid || strings.TrimSpace(record.key.String) == "" {
		return nil, nil
	}
	avatar.Key = record.key.String
	avatar.ContentType = record.contentType.String
	if record.sizeBytes.Valid {
		avatar.SizeBytes = int(record.sizeBytes.Int64)
	}
	if record.updatedAt.Valid {
		avatar.Updated = record.updatedAt.Time
	}
	return &avatar, nil
}

func (u *UserRepository) IsExists(ctx context.Context, user user.User) (bool, error) {
	var exists bool
	var emailAddress string
	if user.Email != nil {
		emailAddress = user.Email.Address
	}
	err := u.DB.QueryRow(ctx, dbqueries.UserRepositoryIsExists1, user.Username, emailAddress, user.UID).Scan(&exists)
	if err != nil {
		return false, err
	}
	if !exists {
		return false, apperrors.RecordNotFound
	}
	return exists, nil
}

func (u *UserRepository) IsExistsByUID(ctx context.Context, uid uint) (bool, error) {
	return u.IsExists(ctx, user.User{UID: uid})
}

func (u *UserRepository) UpdateDisplayName(ctx context.Context, uid uint, displayName string) error {
	if uid == 0 {
		return apperrors.InvalidArguments.AddErrDetails("uid is zero")
	}
	res, err := u.DB.Exec(ctx, dbqueries.UserRepositoryUpdateDisplayName1, displayName, uid)
	if err != nil {
		return err
	}
	affected := res.RowsAffected()
	if affected == 0 {
		return apperrors.RecordNotFound
	}
	return nil
}

func (u *UserRepository) UpdateDescription(ctx context.Context, uid uint, description string) error {
	if uid == 0 {
		return apperrors.InvalidArguments
	}
	res, err := u.DB.Exec(ctx, dbqueries.UserRepositoryUpdateDescription1, description, uid)
	if err != nil {
		return err
	}
	affected := res.RowsAffected()
	if affected == 0 {
		return apperrors.RecordNotFound
	}
	return nil
}

func (u *UserRepository) SetEmailVerifiedByAddress(ctx context.Context, email string, verified bool) error {
	if strings.TrimSpace(email) == "" {
		return apperrors.RequiredDataMissing.AddErrDetails("email is empty")
	}
	res, err := u.DB.Exec(ctx, dbqueries.UserRepositorySetEmailVerifiedByAddress1, email, verified)
	if err != nil {
		return err
	}
	affected := res.RowsAffected()
	if affected == 0 {
		return apperrors.RecordNotFound
	}
	return nil
}

func (u *UserRepository) UpdatePasswordByEmail(ctx context.Context, email string, passwordHash string) error {
	if strings.TrimSpace(email) == "" || passwordHash == "" {
		return apperrors.RequiredDataMissing.AddErrDetails("email or password is empty")
	}
	res, err := u.DB.Exec(ctx, dbqueries.UserRepositoryUpdatePasswordByEmail1, email, passwordHash)
	if err != nil {
		return err
	}
	affected := res.RowsAffected()
	if affected == 0 {
		return apperrors.RecordNotFound
	}
	return nil
}

func (u *UserRepository) IsBanned(ctx context.Context, uid uint) (bool, *user.BanInfo, error) {
	if uid == 0 {
		return false, nil, apperrors.InvalidArguments.AddErrDetails("uid is zero")
	}
	var found bool
	err := u.DB.QueryRow(ctx, dbqueries.UserRepositoryIsBanned1, uid).Scan(&found)
	if err != nil {
		return false, nil, err
	}
	if !found {
		return false, nil, nil
	}
	info, err := u.BanInfo(ctx, uid)
	if err != nil {
		return false, nil, err
	}
	return found, info, nil
}

func (u *UserRepository) Ban(ctx context.Context, info user.BanInfo) error {
	if info.Empty() {
		return apperrors.InvalidArguments.AddErrDetails("invalid argument")
	}
	var expr *time.Time = nil
	if info.Expire.IsZero() {
		expr = &info.Expire
	}
	_, err := u.DB.Exec(ctx, dbqueries.UserRepositoryBan1, info.Executor, info.Target, info.Reason, expr)
	return err
}

func (u *UserRepository) UnBan(ctx context.Context, uid uint) error {
	if uid == 0 {
		return apperrors.InvalidArguments.AddErrDetails("uid is zero")
	}
	_, err := u.DB.Exec(ctx, dbqueries.UserRepositoryUnBan1, uid)
	return err
}

func (u *UserRepository) BanInfo(ctx context.Context, uid uint) (*user.BanInfo, error) {
	if uid == 0 {
		return nil, apperrors.InvalidArguments.AddErrDetails("uid is zero")
	}
	var info user.BanInfo
	if err := u.DB.QueryRow(ctx, dbqueries.UserRepositoryBanInfo1, uid).Scan(&info.ID, &info.Executor, &info.Reason, &info.At, &info.Expires); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.RecordNotFound.AddErrDetails("user is not banned")
		}
		return nil, err
	}
	return &info, nil
}

func (u *UserRepository) AddAvatar(ctx context.Context, uid uint, avatar user.Avatar) error {
	if uid == 0 {
		return apperrors.InvalidArguments.AddErrDetails("uid is zero")
	}
	if strings.TrimSpace(avatar.Key) == "" {
		return apperrors.RequiredDataMissing.AddErrDetails("avatar key is empty")
	}
	_, err := u.DB.Exec(ctx, dbqueries.UserRepositoryAddAvatar1, uid, avatar.Key, avatar.ContentType, avatar.SizeBytes)
	return err
}

func (u *UserRepository) DeleteAvatar(ctx context.Context, uid uint) error {
	if uid == 0 {
		return apperrors.InvalidArguments.AddErrDetails("uid is zero")
	}
	res, err := u.DB.Exec(ctx, dbqueries.UserRepositoryDeleteAvatar1, uid)
	if err != nil {
		return err
	}
	affected := res.RowsAffected()
	if affected == 0 {
		return apperrors.RecordNotFound.AddErrDetails("avatar not found")
	}
	return nil
}

func (u *UserRepository) HasPerm(ctx context.Context, uid uint, perm permissions.Permission) (bool, error) {
	if uid == 0 {
		return false, apperrors.InvalidArguments.AddErrDetails("uid is zero")
	}
	if perm.String() == "" {
		return false, apperrors.RequiredDataMissing.AddErrDetails("permission is empty")
	}
	var has bool
	if err := u.DB.QueryRow(ctx, dbqueries.UserRepositoryHasPerm1, perm.String(), uid).Scan(&has); err != nil {
		return false, err
	}
	return has, nil
}

func (u *UserRepository) HasAllPerms(ctx context.Context, uid uint, perms ...permissions.Permission) (bool, error) {
	var has bool = true
	for _, perm := range perms {
		good, err := u.HasPerm(ctx, uid, perm)
		if err != nil {
			return false, err
		}
		if !good {
			has = false
		}
		if !has {
			break
		}
	}
	return has, nil
}

func (u *UserRepository) Perms(ctx context.Context, uid uint) (*permissions.Permissions, error) {
	var raw []byte
	if err := u.DB.QueryRow(ctx, dbqueries.UserRepositoryPerms1, uid).Scan(&raw); err != nil {
		return nil, err
	}
	var perms permissions.Permissions
	if err := json.Unmarshal(raw, &perms); err != nil {
		return nil, err
	}
	return &perms, nil
}

func (u *UserRepository) ChangePerms(ctx context.Context, uid uint, perm permissions.Permission, state bool) error {
	if uid == 0 {
		return apperrors.InvalidArguments.AddErrDetails("uid is null")
	}
	res, err := u.DB.Exec(ctx, dbqueries.UserRepositoryChangePerms1, perm.String(), state, uid)
	if err != nil {
		return err
	}
	if n := res.RowsAffected(); n == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (u *UserRepository) DeleteProfile(ctx context.Context, uid uint) error {
	if uid == 0 {
		return apperrors.InvalidArguments.AddErrDetails("uid is null")
	}
	resp, err := u.DB.Exec(ctx, dbqueries.UserRepositoryDeleteProfile1, uid)
	if err != nil {
		return err
	}
	if n := resp.RowsAffected(); n == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (u *UserRepository) SetRank(ctx context.Context, uid uint, rank string, expires *time.Time) error {
	if uid == 0 || rank == "" {
		return apperrors.InvalidArguments.AddErrDetails("uid or rank is null")
	}

	query := dbqueries.UserRepositorySetRank1
	args := []any{rank, uid}

	if expires != nil {
		query = dbqueries.UserRepositorySetRank2
		args = []any{rank, *expires, uid}
	}

	resp, err := u.DB.Exec(ctx, query, args...)
	if err != nil {
		return err
	}

	n := resp.RowsAffected()
	if n == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (u *UserRepository) IsTOTPEnabled(ctx context.Context, uid uint) (bool, error) {
	if uid == 0 {
		return false, apperrors.InvalidArguments
	}
	var enabled bool
	if err := u.DB.QueryRow(ctx, dbqueries.UserRepositoryIsTOTPEnabled1, uid).Scan(&enabled); err != nil {
		return false, err
	}
	return enabled, nil
}

func (u *UserRepository) GetPendingTOTP(ctx context.Context, uid uint) (*string, error) {
	if uid == 0 {
		return nil, apperrors.InvalidArguments
	}
	var code sql.NullString
	if err := u.DB.QueryRow(ctx, dbqueries.UserRepositoryGetPendingTOTP1, uid).Scan(&code); err != nil {
		return nil, err
	}
	if !code.Valid {
		return nil, apperrors.RecordNotFound
	}
	return &code.String, nil
}

func (u *UserRepository) SetPendingTOTP(ctx context.Context, uid uint, pending string) error {
	if uid == 0 || pending == "" {
		return apperrors.InvalidArguments
	}
	if _, err := u.DB.Exec(ctx, dbqueries.UserRepositorySetPendingTOTP1, pending, time.Now(), uid); err != nil {
		return err
	}
	return nil
}

func (u *UserRepository) SetConfirmed(ctx context.Context, uid uint) error {
	if uid == 0 {
		return apperrors.InvalidArguments
	}
	if _, err := u.DB.Exec(ctx, dbqueries.UserRepositorySetConfirmed1, uid); err != nil {
		return err
	}
	return nil
}

func (u *UserRepository) AppendRecoveryCodes(ctx context.Context, uid uint, cds []string) error {
	codes, err := u.GetRecoveryCodes(ctx, uid)
	if err != nil {
		return err
	}
	if err := u.CascadeRecoveryCodes(ctx, uid, codes); err != nil {
		return err
	}
	for _, code := range cds {
		if code != "" {
			if _, err := u.DB.Exec(ctx, dbqueries.UserRepositoryAppendRecoveryCodes1, uid, code); err != nil {
				return err
			}
		}
	}
	return nil
}

func (u *UserRepository) CascadeRecoveryCodes(ctx context.Context, uid uint, codes []string) error {
	for _, code := range codes {
		if code != "" {
			if _, err := u.DB.Exec(ctx, dbqueries.UserRepositoryCascadeRecoveryCodes1, uid, code); err != nil {
				return err
			}
		}
	}
	return nil
}

func (u *UserRepository) GetRecoveryCodes(ctx context.Context, uid uint) ([]string, error) {
	var codes []string
	rows, err := u.DB.Query(ctx, dbqueries.UserRepositoryGetRecoveryCodes1, uid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var code string
		if err := rows.Scan(&code); err != nil {
			return nil, err
		}
		codes = append(codes, code)
	}
	return codes, nil
}

func (u *UserRepository) SetCodeUsed(ctx context.Context, hash string) error {
	_, err := u.DB.Exec(ctx, dbqueries.UserRepositorySetCodeUsed1, time.Now(), hash)
	return err
}

func (u *UserRepository) ResetTOTP(ctx context.Context, uid uint) error {
	_, err := u.DB.Exec(ctx, dbqueries.UserRepositoryResetTOTP1, uid)
	return err
}

func (u *UserRepository) IsValidRecovery(ctx context.Context, uid uint, code string) (bool, error) {
	if uid == 0 || code == "" {
		return false, apperrors.InvalidArguments
	}

	rows, err := u.DB.Query(ctx,
		dbqueries.UserRepositoryIsValidRecovery1,
		uid,
	)
	if err != nil {
		return false, err
	}
	defer rows.Close()

	for rows.Next() {
		var hash string
		if err := rows.Scan(&hash); err != nil {
			return false, err
		}

		err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(code))
		if err == nil {
			return true, nil
		}
		if !errors.Is(err, bcrypt.ErrMismatchedHashAndPassword) {
			return false, err
		}
	}
	if err := rows.Err(); err != nil {
		return false, err
	}
	return false, nil
}

func (u *UserRepository) IsTOTPending(ctx context.Context, uid uint) (bool, error) {
	var pending bool
	err := u.DB.QueryRow(
		ctx,
		dbqueries.UserRepositoryIsTOTPending1,
		uid,
	).Scan(&pending)
	return pending, err
}

func (u *UserRepository) GetTOTPSecret(ctx context.Context, uid uint) (string, error) {
	var secret string
	err := u.DB.QueryRow(ctx, dbqueries.UserRepositoryGetTOTPSecret1, uid).Scan(&secret)
	return secret, err
}

func (u *UserRepository) GetTOTPLastStep(ctx context.Context, uid uint) (*int64, error) {
	var step sql.NullInt64
	err := u.DB.QueryRow(ctx, dbqueries.UserRepositoryGetTOTPLastStep1, uid).Scan(&step)
	if err != nil {
		return nil, err
	}
	if !step.Valid {
		return nil, nil
	}
	return &step.Int64, nil
}

func (u *UserRepository) SetTOTPLastStep(ctx context.Context, uid uint, step int64) error {
	_, err := u.DB.Exec(ctx, dbqueries.UserRepositorySetTOTPLastStep1, step, uid)
	return err
}

func (u *UserRepository) CanEdit(ctx context.Context, user uint, target uint) (bool, error) {
	if user == 0 || target == 0 {
		return false, apperrors.InvalidArguments
	}

	var can bool
	err := u.DB.QueryRow(ctx, dbqueries.UserRepositoryCanEdit1, user, target).Scan(&can)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, apperrors.RecordNotFound
		}
		return false, err
	}

	return can, nil
}

func (u *UserRepository) codeExists(ctx context.Context, code uuid.UUID) (bool, error) {
	var exists bool
	err := u.DB.QueryRow(ctx, dbqueries.UserRepositoryCodeExists1, code).Scan(&exists)
	return exists, err
}

func (u *UserRepository) canActivateCode(ctx context.Context, uid uint) (bool, error) {
	var exists bool
	err := u.DB.QueryRow(ctx,
		dbqueries.UserRepositoryCanActivateCode1,
		uid,
	).Scan(&exists)
	return !exists, err
}

func (u *UserRepository) ActivateRank(ctx context.Context, uid uint, code uuid.UUID) (string, error) {
	var rank string
	exists, err := u.codeExists(ctx, code)
	if err != nil {
		return "", err
	}
	if !exists {
		return "", apperrors.RecordNotFound
	}
	can, err := u.canActivateCode(ctx, uid)
	if err != nil {
		return "", err
	}
	if !can {
		return "", apperrors.Conflict
	}
	if err := u.DB.QueryRow(ctx, dbqueries.UserRepositoryActivateRank1, time.Now(), uid, code).Scan(&rank); err != nil {
		return "", err
	}
	expires := time.Now().Add(7 * time.Hour * 24)
	if err := u.SetRank(ctx, uid, rank, &expires); err != nil {
		return "", err
	}
	return rank, nil
}

func (l *LoggerRepository) Append(ctx context.Context, event logger.Event) error {
	if event.TraceID == "" {
		event.TraceID = "-"
	}
	if _, err := l.DB.Exec(ctx, dbqueries.LoggerRepositoryAppend1, strings.ToLower(event.Type.String()), event.Level.String(), event.Message, event.Actor.Type.String(), event.Actor.ID, event.TraceID, event.Result.String()); err != nil {
		return err
	}
	return nil
}

func (l *LoggerRepository) GetList(ctx context.Context, limit uint, offset uint) ([]*logger.Event, error) {
	var events []*logger.Event
	var err error
	var rows pgx.Rows
	if limit > 0 {
		rows, err = l.DB.Query(ctx, dbqueries.LoggerRepositoryGetList1, limit, offset)
		if err != nil {
			return nil, err
		}
		defer func(rows pgx.Rows) {
			rows.Close()
		}(rows)
	} else {
		rows, err = l.DB.Query(ctx, dbqueries.LoggerRepositoryGetList2, offset)
		if err != nil {
			return nil, err
		}
		defer func(rows pgx.Rows) {
			rows.Close()
		}(rows)
	}
	for rows.Next() {
		var event logger.Event
		if err = rows.Scan(&event.ID, &event.At, &event.Type, &event.Level, &event.Message, &event.Actor.Type, &event.Actor.ID, &event.Result, &event.TraceID); err != nil {
			return nil, err
		}
		events = append(events, &event)
	}
	return events, nil
}

func (l *LoginRepository) Register(ctx context.Context, require login.RegisterRequire) (*uint, error) {
	if require.IsEmpty() {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("some of params is empty")
	}
	require.Email, require.Username = strings.ToLower(require.Email), strings.ToLower(require.Username)
	var id uint
	err := l.DB.QueryRow(ctx, dbqueries.LoginRepositoryRegister1,
		require.Username, require.Email, require.Password).Scan(&id)
	if err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && string(pqErr.Code) == "23505" {
			return nil, apperrors.AlreadyExists
		}
		return nil, err
	}
	return &id, nil
}

func (l *LoginRepository) Authorization(ctx context.Context, require login.AuthorizationRequire) (*uint, error) {
	if require.IsEmpty() {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("some of params is empty")
	}
	require.Usermail = strings.ToLower(require.Usermail)
	var uid uint
	if err := l.DB.QueryRow(ctx, dbqueries.LoginRepositoryAuthorization1, require.Usermail).Scan(&uid); err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
	}
	if uid == 0 {
		if err := l.DB.QueryRow(ctx, dbqueries.LoginRepositoryAuthorization2, require.Usermail).Scan(&uid); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, apperrors.RecordNotFound
			}
			return nil, err
		}
	}
	if uid == 0 {
		return nil, apperrors.RecordNotFound
	}
	var password string
	if err := l.DB.QueryRow(ctx, dbqueries.LoginRepositoryAuthorization3, uid).Scan(&password); err != nil {
		return nil, err
	}
	if err := bcrypt.CompareHashAndPassword([]byte(password), []byte(require.Password)); err != nil {
		return nil, err
	}
	return &uid, nil
}

func (l *LoginRepository) GetUIDByEmail(ctx context.Context, email string) (*uint, error) {
	if strings.TrimSpace(email) == "" {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("email is empty")
	}
	var uid uint
	if err := l.DB.QueryRow(ctx, dbqueries.LoginRepositoryGetUIDByEmail1, email).Scan(&uid); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.RecordNotFound
		}
		return nil, err
	}
	return &uid, nil
}

func (l *LoginRepository) GetOAuthUID(ctx context.Context, service login.OAuthService, linkedID string) (*uint, error) {
	if !service.IsValid() || strings.TrimSpace(linkedID) == "" {
		return nil, apperrors.InvalidArguments.AddErrDetails("oauth params are invalid")
	}
	var uid uint
	if err := l.DB.QueryRow(ctx, dbqueries.LoginRepositoryGetOAuthUID1, service.String(), linkedID).Scan(&uid); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.RecordNotFound
		}
		return nil, err
	}
	return &uid, nil
}

func (l *LoginRepository) LinkOAuth(ctx context.Context, service login.OAuthService, linkedID string, uid uint) error {
	if !service.IsValid() || strings.TrimSpace(linkedID) == "" || uid == 0 {
		return apperrors.InvalidArguments.AddErrDetails("oauth params are invalid")
	}
	_, err := l.DB.Exec(ctx, dbqueries.LoginRepositoryLinkOAuth1, uid, service.String(), linkedID)
	return err
}

func (l *LoginRepository) Logout(ctx context.Context, sessionID uuid.UUID) error {
	if sessionID == uuid.Nil {
		return apperrors.InvalidArguments.AddErrDetails("invalid session")
	}
	_, err := l.DB.Exec(ctx, dbqueries.LoginRepositoryLogout1, sessionID)
	return err
}

func (s *SessionsRepository) IsValid(ctx context.Context, sessionID uuid.UUID) (bool, error) {
	var (
		expires    time.Time
		revoked    bool
		needVerify bool
	)

	const q = `
		SELECT
			s.expires,
			s.revoked,
			(COALESCE(u.totp_enabled, false) AND NOT COALESCE(s.mfa_complete, false)) AS need_verify
		FROM sessions s
		JOIN users u ON u.uid = s.uid
		WHERE s.id = $1
	`
	err := s.DB.QueryRow(ctx, q, sessionID).Scan(&expires, &revoked, &needVerify)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, err
	}

	if needVerify {
		return false, apperrors.NeedVerify
	}

	return time.Now().Before(expires) && !revoked, nil
}

func (s *SessionsRepository) GetSession(ctx context.Context, sessionID uuid.UUID) (*sessions.Session, error) {
	var ses sessions.Session
	if err := s.DB.QueryRow(ctx, dbqueries.SessionsRepositoryGetSession1, sessionID).Scan(&ses.ID, &ses.UID, &ses.Created, &ses.LastSeenAt, &ses.Expires, &ses.Revoked, &ses.MfaComplete, &ses.AgentHash); err != nil {
		return nil, err
	}
	return &ses, nil
}

func (s *SessionsRepository) GetSessions(ctx context.Context, uid uint) (*sessions.Sessions, error) {
	var sess sessions.Sessions
	rows, err := s.DB.Query(
		ctx,
		dbqueries.SessionsRepositoryGetSessions1,
		uid,
	)
	if err != nil {
		return nil, err
	}
	defer func(rows pgx.Rows) {
		rows.Close()
	}(rows)
	for rows.Next() {
		var data *sessions.Session
		var id uuid.UUID
		if err = rows.Scan(&id); err != nil {
			return nil, err
		}
		data, err = s.GetSession(ctx, id)
		if err != nil {
			return nil, err
		}
		sess = append(sess, data)
	}
	return &sess, nil
}

func (s *SessionsRepository) GetUID(ctx context.Context, sessionID uuid.UUID) (*uint, error) {
	var uid uint
	err := s.DB.QueryRow(ctx, dbqueries.SessionsRepositoryGetUID1, sessionID).Scan(&uid)
	return &uid, err
}

func (s *SessionsRepository) SetRevoked(ctx context.Context, sessionID uuid.UUID) error {
	if _, err := s.DB.Exec(ctx, dbqueries.SessionsRepositorySetRevoked1, sessionID); err != nil {
		return err
	}
	return nil
}

func (s *SessionsRepository) ResetMFAs(ctx context.Context, uid uint) error {
	_, err := s.DB.Exec(ctx, dbqueries.SessionsRepositoryResetMFAs1, uid)
	return err
}

func (s *SessionsRepository) SetMFACompleted(ctx context.Context, sessionID uuid.UUID) error {
	_, err := s.DB.Exec(ctx, dbqueries.SessionsRepositorySetMFACompleted1, sessionID)
	return err
}

func (s *SessionsRepository) AddSession(ctx context.Context, sessionID uuid.UUID, agentHash string, expires time.Time, uid uint) error {
	_, err := s.DB.Exec(ctx, dbqueries.SessionsRepositoryAddSession1, sessionID, uid, expires, agentHash)
	return err
}

func (s *SessionsRepository) UpdateLastSeen(ctx context.Context, sessionID uuid.UUID) error {
	_, err := s.DB.Exec(ctx, dbqueries.SessionsRepositoryUpdateLastSeen1, time.Now(), sessionID)
	return err
}

func getAuthor(ctx context.Context, uid uint, db *pgxpool.Pool) (*user.User, error) {
	usr, err := NewUserRepository(db).GetUserByUID(ctx, uid)
	if err != nil {
		return nil, err
	}
	return usr, nil
}

func getProjectPhotos(ctx context.Context, projId uuid.UUID, db *pgxpool.Pool) (user.Avatars, error) {
	rows, err := db.Query(ctx, dbqueries.GetProjectPhotos1, projId)
	if err != nil {
		return nil, err
	}
	defer func() {
		rows.Close()
	}()
	avatars := make([]*user.Avatar, 0)
	for rows.Next() {
		var record struct {
			key         sql.NullString
			contentType sql.NullString
			sizeBytes   sql.NullInt64
			createdAt   sql.NullTime
		}
		if err := rows.Scan(&record.key, &record.contentType, &record.sizeBytes, &record.createdAt); err != nil {
			return nil, err
		}
		if !record.key.Valid || strings.TrimSpace(record.key.String) == "" {
			continue
		}
		var avatar user.Avatar
		avatar.Key = record.key.String
		avatar.ContentType = record.contentType.String
		if record.sizeBytes.Valid {
			avatar.SizeBytes = int(record.sizeBytes.Int64)
		}
		if record.createdAt.Valid {
			avatar.Updated = record.createdAt.Time
		}
		avatars = append(avatars, &avatar)
	}
	return avatars, nil
}

const defaultWhoLikedProjectLimit int32 = 50
const maxWhoLikedProjectLimit int32 = 100

func getWhoLikedProject(ctx context.Context, id uuid.UUID, db *pgxpool.Pool, offset int32, limit int32) (user.Users, error) {
	startedAt := time.Now()
	if offset < 0 {
		offset = 0
	}
	if limit <= 0 {
		limit = defaultWhoLikedProjectLimit
	}
	if limit > maxWhoLikedProjectLimit {
		limit = maxWhoLikedProjectLimit
	}

	rows, err := db.Query(ctx, dbqueries.GetWhoLikedProject1, id, limit, offset)
	if err != nil {
		logger.Debug(fmt.Sprintf("getWhoLikedProject query failed project_id=%s limit=%d offset=%d took=%s err=%v", id, limit, offset, time.Since(startedAt), err), "")
		return nil, err
	}

	liked, err := parseRowsToUsers(ctx, rows, db)
	if err != nil {
		logger.Debug(fmt.Sprintf("getWhoLikedProject parse failed project_id=%s limit=%d offset=%d took=%s err=%v", id, limit, offset, time.Since(startedAt), err), "")
		return nil, err
	}

	logger.Debug(fmt.Sprintf("getWhoLikedProject project_id=%s limit=%d offset=%d users=%d took=%s", id, limit, offset, len(liked), time.Since(startedAt)), "")
	return liked, nil
}

func getProject(ctx context.Context, id uuid.UUID, db *pgxpool.Pool) (*projectdomain.Project, error) {
	var project projectdomain.Project
	var err error
	var authorID uint
	if err = db.QueryRow(ctx, dbqueries.GetProject1, id).Scan(
		&project.ID, &authorID, &project.Info.Title, &project.Info.Description, &project.Info.Category, &project.Info.Location.City, &project.Info.Location.Latitude, &project.Info.Location.Longitude, &project.Info.Location.Address, &project.Likes, &project.At, &project.Status); err != nil {
		return nil, err
	}
	project.Author, err = getAuthor(ctx, authorID, db)
	if err != nil {
		return nil, err
	}
	project.Info.Photos, err = getProjectPhotos(ctx, project.ID, db)
	if err != nil {
		return nil, err
	}
	if project.Likes > 0 {
		liked, err := getWhoLikedProject(ctx, project.ID, db, 0, defaultWhoLikedProjectLimit)
		if err != nil {
			return nil, err
		}
		project.Liked = &liked
	}
	return &project, nil
}

const defaultProjectHydrationWorkers = 16
const defaultProjectHydrationTimeout = 20 * time.Second
const projectHydrationDBCallsPerProject = 4

func hydrateProjectsByIDs(ctx context.Context, db *pgxpool.Pool, ids []uuid.UUID) (projectdomain.Projects, error) {
	if len(ids) == 0 {
		return projectdomain.Projects{}, nil
	}

	maxWorkers, hydrationTimeout := projectHydrationSettings(db)
	workers := min(len(ids), maxWorkers)
	if workers < 1 {
		workers = 1
	}
	startedAt := time.Now()

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	projects := make([]*projectdomain.Project, len(ids))
	sem := make(chan struct{}, workers)
	var wg sync.WaitGroup
	var once sync.Once
	var firstErr error

	for i, id := range ids {
		i := i
		id := id
		wg.Go(func() {
			select {
			case sem <- struct{}{}:
			case <-ctx.Done():
				return
			}
			defer func() { <-sem }()

			project, err := safe.GoAsync[*projectdomain.Project](ctx, hydrationTimeout, func(taskCtx context.Context) (*projectdomain.Project, error) {
				return getProject(taskCtx, id, db)
			})
			if err != nil {
				once.Do(func() {
					firstErr = err
					cancel()
				})
				return
			}
			project.Info.Location.Normalize()
			projects[i] = project
		})
	}

	wg.Wait()
	if firstErr != nil {
		logger.Debug(fmt.Sprintf("hydrateProjectsByIDs failed ids=%d workers=%d took=%s err=%v", len(ids), workers, time.Since(startedAt), firstErr), "")
		return nil, firstErr
	}

	logger.Debug(fmt.Sprintf("hydrateProjectsByIDs ids=%d workers=%d took=%s", len(ids), workers, time.Since(startedAt)), "")
	return projects, nil
}

func projectHydrationSettings(db *pgxpool.Pool) (int, time.Duration) {
	cfg := appconfig.Get().Async

	workers := cfg.ProjectsHydrationWorkers
	if workers < 1 {
		workers = defaultProjectHydrationWorkers
	}
	if db != nil {
		maxConns := int(db.Config().MaxConns)
		if maxConns > 0 {
			poolSafeWorkers := maxConns / projectHydrationDBCallsPerProject
			if poolSafeWorkers < 1 {
				poolSafeWorkers = 1
			}
			if workers > poolSafeWorkers {
				workers = poolSafeWorkers
			}
		}
	}

	timeout := time.Duration(cfg.ProjectsHydrationTimeoutSeconds) * time.Second
	if timeout <= 0 {
		timeout = defaultProjectHydrationTimeout
	}

	return workers, timeout
}

func (p *ProjectsRepository) GetProject(ctx context.Context, id uuid.UUID) (*projectdomain.Project, error) {
	return getProject(ctx, id, p.DB)
}

func (p *ProjectsRepository) GetTopProjects(ctx context.Context, limit int, city string) (projectdomain.Projects, error) {
	projects, err := p.GetProjects(ctx, 0, 0)
	if err != nil {
		return nil, err
	}

	sort.Slice(projects, func(i, j int) bool {
		return projects[i].Likes < projects[j].Likes
	})

	if city != "" {
		filtered := make(projectdomain.Projects, 0, len(projects))
		for _, proj := range projects {
			if strings.EqualFold(proj.Info.Location.City, city) && proj.Status.IsPublic() {
				filtered = append(filtered, proj)
			}
		}
		projects = filtered
	}

	if limit > 0 && len(projects) > limit {
		projects = projects[:limit]
	}

	return projects, nil
}

func (p *ProjectsRepository) GetProjectsByUID(ctx context.Context, uid int) (projectdomain.Projects, error) {
	rows, err := p.DB.Query(ctx, dbqueries.ProjectsRepositoryGetProjectsByUID1, uid)
	if err != nil {
		return nil, err
	}
	defer func(rows pgx.Rows) {
		rows.Close()
	}(rows)
	ids := make([]uuid.UUID, 0, 16)
	for rows.Next() {
		var id uuid.UUID
		if err = rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return hydrateProjectsByIDs(ctx, p.DB, ids)
}

func (p *ProjectsRepository) CreateProject(ctx context.Context, info projectdomain.Project) (*uuid.UUID, error) {
	var projectId uuid.UUID
	logger.Debug(fmt.Sprintf("latitude: %f, longitude: %f", info.Info.Location.Latitude, info.Info.Location.Longitude), "")
	if err := p.DB.QueryRow(ctx, dbqueries.ProjectsRepositoryCreateProject1, info.Author.UID, info.Info.Title, info.Info.Description, info.Info.Category, strings.ToLower(info.Info.Location.City), info.Info.Location.Latitude, info.Info.Location.Longitude, info.Info.Location.Address).Scan(&projectId); err != nil {
		return nil, err
	}
	if len(info.Info.Photos) > 0 {
		for _, photo := range info.Info.Photos {
			if photo == nil {
				continue
			}
			key := strings.TrimSpace(photo.Key)
			if key == "" {
				return nil, apperrors.RequiredDataMissing.AddErrDetails("project photo key is empty")
			}
			if _, err := p.DB.Exec(ctx, dbqueries.ProjectsRepositoryCreateProject2, projectId, key, strings.TrimSpace(photo.ContentType), photo.SizeBytes); err != nil {
				return nil, err
			}
		}
	}
	if _, err := p.DB.Exec(ctx, dbqueries.ProjectsRepositoryCreateProject3, projectId); err != nil {
		return nil, err
	}
	return &projectId, nil
}

func (p *ProjectsRepository) AddProjectPhoto(ctx context.Context, projectID uuid.UUID, key string, contentType string, sizeBytes int) error {
	if p == nil || p.DB == nil {
		return apperrors.NotConfigured
	}
	key = strings.TrimSpace(key)
	if key == "" {
		return apperrors.RequiredDataMissing.AddErrDetails("project photo key is empty")
	}
	contentType = strings.TrimSpace(contentType)
	content := sql.NullString{String: contentType, Valid: contentType != ""}
	size := sql.NullInt64{}
	if sizeBytes > 0 {
		size = sql.NullInt64{Int64: int64(sizeBytes), Valid: true}
	}
	_, err := p.DB.Exec(ctx, dbqueries.ProjectsRepositoryCreateProject2, projectID, key, content, size)
	return err
}

func (p *ProjectsRepository) GetCategories(ctx context.Context) ([]string, error) {
	var enumName = "project_categories"
	var result []string
	rows, err := p.DB.Query(ctx, dbqueries.ProjectEnumLabels, enumName)
	if err != nil {
		return nil, err
	}
	defer func() {
		rows.Close()
	}()
	for rows.Next() {
		var label string
		if err := rows.Scan(&label); err != nil {
			return nil, err
		}
		result = append(result, label)
	}
	return result, nil
}
func (p *ProjectsRepository) GetProjects(ctx context.Context, offset int, limit int, opts ...projectdomain.ProjectOption) (projectdomain.Projects, error) {
	q := &projectdomain.ProjectQuery{}
	for _, opt := range opts {
		if opt != nil {
			opt(q)
		}
	}

	var sb strings.Builder
	sb.WriteString(dbqueries.ProjectsSelectIDsBase)

	args := make([]any, 0, len(q.Args)+2)
	args = append(args, q.Args...)

	if len(q.Where) > 0 {
		sb.WriteString(" WHERE ")
		sb.WriteString(strings.Join(q.Where, " AND "))
	}

	sb.WriteString(" ORDER BY p.created_at DESC, p.id DESC")

	offPH := "$" + strconv.Itoa(len(args)+1)
	args = append(args, offset)
	sb.WriteString(" OFFSET ")
	sb.WriteString(offPH)

	if limit > 0 {
		limPH := "$" + strconv.Itoa(len(args)+1)
		args = append(args, limit)
		sb.WriteString(" LIMIT ")
		sb.WriteString(limPH)
	}

	rows, err := p.DB.Query(ctx, sb.String(), args...)
	if err != nil {
		return nil, err
	}
	defer func() { rows.Close() }()

	ids := make([]uuid.UUID, 0, 16)
	for rows.Next() {
		var id uuid.UUID
		if err = rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	return hydrateProjectsByIDs(ctx, p.DB, ids)
}

func (p *ProjectsRepository) ToggleLike(ctx context.Context, id uuid.UUID, userID uint) error {
	if userID == 0 {
		return apperrors.RequiredDataMissing.AddErrDetails("user is empty")
	}
	var set bool
	if err := p.DB.QueryRow(ctx, dbqueries.ProjectsRepositoryToggleLike1, id, userID).Scan(&set); err != nil {
		return err
	}
	_ = set
	return nil
}

func (p *ProjectsRepository) Messages(ctx context.Context, id uuid.UUID) (projectdomain.ProjectMessages, error) {
	var exists bool
	if err := p.DB.QueryRow(ctx, dbqueries.ProjectsRepositoryMessages1, id).Scan(&exists); err != nil {
		return nil, err
	}
	if !exists {
		return nil, apperrors.RecordNotFound
	}

	rows, err := p.DB.Query(ctx, dbqueries.ProjectsRepositoryMessages2, id)
	if err != nil {
		return nil, err
	}
	defer func() {
		rows.Close()
	}()

	var messages projectdomain.ProjectMessages
	for rows.Next() {
		var message projectdomain.ProjectMessage
		var authorUID uint64
		var replyToID sql.NullInt64
		if err := rows.Scan(
			&message.ID,
			&message.ProjectID,
			&authorUID,
			&message.Content,
			&replyToID,
			&message.At,
		); err != nil {
			return nil, err
		}
		message.AuthorUID = uint(authorUID)
		if replyToID.Valid {
			id := replyToID.Int64
			message.ReplyToID = &id
		}
		messages = append(messages, &message)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return messages, nil
}

func (p *ProjectsRepository) CreateMessage(ctx context.Context, id uuid.UUID, authorUID uint, content string, replyToID *int64) error {
	if authorUID == 0 {
		return apperrors.RequiredDataMissing.AddErrDetails("author is empty")
	}
	trimmed := strings.TrimSpace(content)
	if trimmed == "" {
		return apperrors.RequiredDataMissing.AddErrDetails("content is empty")
	}

	var exists bool
	if err := p.DB.QueryRow(ctx, dbqueries.ProjectsRepositoryCreateMessage1, id).Scan(&exists); err != nil {
		return err
	}
	if !exists {
		return apperrors.RecordNotFound
	}

	var replyTo any
	if replyToID != nil {
		if *replyToID <= 0 {
			return apperrors.InvalidArguments.AddErrDetails("reply message id is incorrect")
		}
		var replyExists bool
		if err := p.DB.QueryRow(
			ctx,
			dbqueries.ProjectsRepositoryCreateMessage2,
			id,
			*replyToID,
		).Scan(&replyExists); err != nil {
			return err
		}
		if !replyExists {
			return apperrors.RecordNotFound.AddErrDetails("reply message not found")
		}
		replyTo = *replyToID
	}

	_, err := p.DB.Exec(
		ctx,
		dbqueries.ProjectsRepositoryCreateMessage3,
		id,
		authorUID,
		trimmed,
		replyTo,
	)
	return err
}

var _ statistics.Repository = (*StatisticsRepository)(nil)

func (s *StatisticsRepository) VoteCount(ctx context.Context, since time.Time) (uint32, error) {
	if since.IsZero() {
		return 0, apperrors.InvalidArguments.AddErrDetails("since is zero")
	}
	var count uint
	err := s.DB.QueryRow(ctx, dbqueries.StatisticsRepositoryVoteCount1, since).Scan(&count)
	if err != nil {
		return 0, err
	}
	return uint32(count), nil
}

func (s *StatisticsRepository) GetOnlineUsers(ctx context.Context, since time.Time) (uint32, error) {
	if since.IsZero() {
		return 0, apperrors.InvalidArguments.AddErrDetails("since is zero")
	}

	var count uint32
	err := s.DB.QueryRow(ctx,
		dbqueries.StatisticsRepositoryGetOnlineUsers1, since,
	).Scan(&count)
	if err != nil {
		return 0, err
	}

	return count, nil
}

func (s *StatisticsRepository) GetOfflineUsers(ctx context.Context, since time.Time) (uint32, error) {
	if since.IsZero() {
		return 0, apperrors.InvalidArguments.AddErrDetails("since is zero")
	}

	var offline int64
	err := s.DB.QueryRow(ctx, dbqueries.StatisticsRepositoryGetOfflineUsers1, since).Scan(&offline)
	if err != nil {
		return 0, err
	}

	if offline < 0 {
		offline = 0
	}
	return uint32(offline), nil
}

func (s *StatisticsRepository) NewIdeasCount(ctx context.Context, since time.Time) (uint32, error) {
	if since.IsZero() {
		return 0, apperrors.InvalidArguments.AddErrDetails("since is zero")
	}
	var count int
	row := s.DB.QueryRow(ctx, dbqueries.StatisticsRepositoryNewIdeasCount1, since)
	if err := row.Scan(&count); err != nil {
		return 0, err
	}
	return uint32(count), nil
}

func today() time.Time {
	now := time.Now()
	t := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	return t
}

func (s *StatisticsRepository) GetForToday(ctx context.Context) (*statpb.StatisticsRecap, error) {
	var stat statpb.StatisticsRecap
	voteCount, err := s.VoteCount(ctx, today())
	if err != nil {
		return nil, err
	}
	newIdeas, err := s.NewIdeasCount(ctx, today())
	if err != nil {
		return nil, err
	}
	offline, err := s.GetOfflineUsers(ctx, today())
	if err != nil {
		return nil, err
	}
	active, err := s.GetOnlineUsers(ctx, today())
	if err != nil {
		return nil, err
	}
	var activity statpb.UsersActivity
	activity.Active = active
	activity.Offline = offline
	stat.NewIdeas = newIdeas
	stat.VoteCount = voteCount
	stat.At = timestamppb.New(today())
	stat.UsersActivity = &activity
	return &stat, nil
}

func (s *StatisticsRepository) SaveStatisticsRecap(ctx context.Context) error {
	lastDay := today().Add(-24 * time.Hour)
	newIdeas, err := s.NewIdeasCount(ctx, lastDay)
	if err != nil {
		return err
	}
	voteCount, err := s.VoteCount(ctx, lastDay)
	if err != nil {
		return err
	}
	active, err := s.GetOnlineUsers(ctx, lastDay)
	if err != nil {
		return err
	}
	offline, err := s.GetOfflineUsers(ctx, lastDay)
	if err != nil {
		return err
	}
	if _, err := s.DB.Exec(ctx, dbqueries.StatisticsRepositorySaveStatisticsRecap1, lastDay, offline, active, newIdeas, voteCount); err != nil {
		return err
	}
	return nil
}

func (s *StatisticsRepository) StatisticsRecap(ctx context.Context, since time.Time) (map[time.Time]*statpb.StatisticsRecap, error) {
	if since.IsZero() {
		return nil, apperrors.InvalidArguments.AddErrDetails("since is zero")
	}

	recap := make(map[time.Time]*statpb.StatisticsRecap)

	rows, err := s.DB.Query(ctx, dbqueries.StatisticsRepositoryStatisticsRecap1, since)
	if err != nil {
		return nil, err
	}
	defer func() {
		rows.Close()
	}()

	for rows.Next() {
		var (
			id        uuid.UUID
			at        time.Time
			online    int64
			offline   int64
			newIdeas  int64
			voteCount int64
		)

		if err := rows.Scan(&id, &at, &online, &offline, &newIdeas, &voteCount); err != nil {
			return nil, err
		}

		rec := &statpb.StatisticsRecap{
			Id: id.String(),
			At: timestamppb.New(at),
			UsersActivity: &statpb.UsersActivity{
				Active:  uint32(online),
				Offline: uint32(offline),
			},
			NewIdeas:  uint32(newIdeas),
			VoteCount: uint32(voteCount),
		}

		recap[at] = rec
	}
	recap[today()], err = s.GetForToday(ctx)
	if err != nil {
		return nil, err
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return recap, nil
}

func (s *StatisticsRepository) UsersActivity(ctx context.Context, since time.Time) (map[time.Time]*statpb.UsersActivity, error) {
	if since.IsZero() {
		return nil, apperrors.InvalidArguments.AddErrDetails("since is zero")
	}
	data, err := s.StatisticsRecap(ctx, since)
	if err != nil {
		return nil, err
	}
	var activity = make(map[time.Time]*statpb.UsersActivity)
	for at, stat := range data {
		activity[at] = stat.UsersActivity
	}
	return activity, nil
}

func (s *StatisticsRepository) VoteCategories(ctx context.Context, since time.Time, limit int) ([]*statpb.CategoryRecord, error) {
	if since.IsZero() {
		return nil, apperrors.InvalidArguments.AddErrDetails("since is zero")
	}

	base := `
		SELECT (pr.info).category AS category, COUNT(*) AS votes
		FROM project_likes pl
		JOIN projects pr ON pr.id = pl.project_id
		WHERE pl.created_at >= $1
		GROUP BY (pr.info).category
		ORDER BY votes DESC
	`

	var (
		rows pgx.Rows
		err  error
	)

	if limit > 0 {
		rows, err = s.DB.Query(ctx, base+` LIMIT $2`, since, limit)
	} else {
		rows, err = s.DB.Query(ctx, base, since)
	}
	if err != nil {
		return nil, err
	}
	defer func() { rows.Close() }()

	var records []*statpb.CategoryRecord
	for rows.Next() {
		var cat sql.NullString
		var votes int64

		if err := rows.Scan(&cat, &votes); err != nil {
			return nil, err
		}

		name := cat.String
		if !cat.Valid {
			name = "Not Specified"
		}

		records = append(records, &statpb.CategoryRecord{
			Name:  name,
			Posts: uint32(votes),
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return records, nil
}

func (s *StatisticsRepository) IdeasRecap(ctx context.Context) (*statpb.IdeasApprovalResponse, error) {
	var resp statpb.IdeasApprovalResponse

	err := s.DB.QueryRow(ctx, dbqueries.StatisticsRepositoryIdeasRecap1).Scan(&resp.Waiting, &resp.Approved, &resp.Declined)
	if err != nil {
		return nil, err
	}

	return &resp, nil
}

func (s *StatisticsRepository) MediaCoverage(ctx context.Context, limit int) ([]*statpb.MediaCoverageResponseMedia, error) {
	if limit <= 0 {
		return []*statpb.MediaCoverageResponseMedia{}, nil
	}

	now := time.Now().UTC()

	const q = `
		WITH src AS (
		  SELECT
		    floor(extract(epoch FROM ($2::timestamptz - p.at)) / 604800)::int AS bucket,
		    (p.info).content_type AS content_type
		  FROM pictures p
		  WHERE p.at <  $2::timestamptz
		    AND p.at >= ($2::timestamptz - ($1::int * interval '7 days'))
		)
		SELECT
		  bucket,
		  sum(CASE WHEN content_type LIKE 'image%' THEN 1 ELSE 0 END) AS photos,
		  sum(CASE WHEN content_type LIKE 'video%' THEN 1 ELSE 0 END) AS videos
		FROM src
		WHERE bucket >= 0 AND bucket < $1::int
		GROUP BY bucket
		ORDER BY bucket;
	`

	rows, err := s.DB.Query(ctx, q, limit, now)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]*statpb.MediaCoverageResponseMedia, limit)
	for i := range limit {
		list[i] = &statpb.MediaCoverageResponseMedia{}
	}

	for rows.Next() {
		var bucket int
		var photos, videos int64

		if err := rows.Scan(&bucket, &photos, &videos); err != nil {
			return nil, err
		}
		if bucket >= 0 && bucket < limit {
			list[bucket].Photos = uint32(photos)
			list[bucket].Videos = uint32(videos)
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return list, nil
}

func (s *StatisticsRepository) QualityRecap(ctx context.Context) (*statpb.EditorsGradeResponse, error) {
	var good, bad uint
	if err := s.DB.QueryRow(ctx, dbqueries.StatisticsRepositoryQualityRecap1).Scan(&good, &bad); err != nil {
		return nil, err
	}
	var grade statpb.EditorsGradeResponse
	var photos statpb.EditorsGradeResponse_Grade
	photos.Good = uint32(good)
	photos.Bad = uint32(bad)
	grade.Photos = &photos
	return &grade, nil
}

func (s *SubmissionsRepository) GetList(ctx context.Context) ([]*submissions.Submission, error) {
	var data []*submissions.Submission
	rows, err := s.DB.Query(ctx, dbqueries.SubmissionsRepositoryGetList1)
	if err != nil {
		return nil, err
	}
	defer func() { rows.Close() }()
	for rows.Next() {
		var sub submissions.Submission
		var reason sql.NullString
		if err := rows.Scan(&sub.ID, &sub.ProjectID, &sub.State, &reason); err != nil {
			return nil, err
		}
		if sub.State == "declined" && reason.Valid {
			sub.Reason = &reason.String
		}
		data = append(data, &sub)
	}
	return data, nil
}

func (s *SubmissionsRepository) GetByID(ctx context.Context, id int32) (*submissions.Submission, error) {
	var data submissions.Submission
	var reason sql.NullString
	if err := s.DB.QueryRow(ctx, dbqueries.SubmissionsRepositoryGetByID1, id).Scan(&data.ProjectID, &data.State, &reason); err != nil {
		return nil, err
	}
	if reason.Valid {
		data.Reason = &reason.String
	}
	return &data, nil
}

func (s *SubmissionsRepository) AlreadySetted(ctx context.Context, id int32) (bool, error) {
	if id == 0 {
		return false, apperrors.InvalidArguments.AddErrDetails("invalid id")
	}
	var setted bool
	if err := s.DB.QueryRow(ctx, dbqueries.SubmissionsRepositoryAlreadySetted1, id).Scan(&setted); err != nil {
		return false, err
	}
	return setted, nil
}

func (s *SubmissionsRepository) Approve(ctx context.Context, id int32) error {
	if id == 0 {
		return apperrors.InvalidArguments.AddErrDetails("invalid id")
	}
	setted, err := s.AlreadySetted(ctx, id)
	if err != nil {
		return err
	}
	if setted {
		return apperrors.Conflict.AddErrDetails("idea already moderated")
	}
	_, err = s.DB.Exec(ctx, dbqueries.SubmissionsRepositoryApprove1, id)
	return err
}

func (s *SubmissionsRepository) Decline(ctx context.Context, id int32, reason string) error {
	if id == 0 {
		return apperrors.InvalidArguments.AddErrDetails("invalid id")
	}
	setted, err := s.AlreadySetted(ctx, id)
	if err != nil {
		return err
	}
	if setted {
		return apperrors.Conflict.AddErrDetails("idea already moderated")
	}
	if _, err := s.DB.Exec(ctx, dbqueries.SubmissionsRepositoryDecline1, reason, id); err != nil {
		return err
	}
	return nil
}

var _ verification.Repository = (*VerificationRepository)(nil)

func (v *VerificationRepository) Create(ctx context.Context, email string, purpose verification.Purpose, ip string, userAgent string, ttl time.Duration) (string, error) {
	if email == "" || !purpose.IsValid() || ip == "" || userAgent == "" || ttl == 0 {
		return "", apperrors.InvalidArguments.AddErrDetails("invalid params")
	}
	token, err := generateString(32)
	if err != nil {
		return "", err
	}
	now := time.Now()
	expiresAt := now.Add(ttl)
	if _, err = v.DB.Exec(ctx, dbqueries.VerificationRepositoryCreate1, email, purpose.String(), []byte(token), expiresAt, ip, userAgent, now); err != nil {
		return "", err
	}
	return token, nil
}

func (v *VerificationRepository) GetRecord(ctx context.Context, purpose verification.Purpose, token string) (*verification.TokenRecord, error) {
	if !purpose.IsValid() || token == "" {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("params is empty")
	}
	var record verification.TokenRecord
	if err := v.DB.QueryRow(ctx, dbqueries.VerificationRepositoryGetRecord1, []byte(token), purpose.String()).Scan(
		&record.ID,
		&record.Email,
		&record.Purpose,
		&record.ExpiresAt,
		&record.UsedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.RecordNotFound
		}
		return nil, err
	}
	return &record, nil
}

func (v *VerificationRepository) Consume(ctx context.Context, purpose verification.Purpose, token string) (*verification.TokenRecord, error) {
	if !purpose.IsValid() || token == "" {
		return nil, apperrors.InvalidArguments.AddErrDetails("invalid params")
	}
	res, err := v.DB.Exec(ctx, dbqueries.VerificationRepositoryConsume1, time.Now(), []byte(token), purpose.String())
	if err != nil {
		return nil, err
	}
	affected := res.RowsAffected()
	if affected == 0 {
		return nil, apperrors.RecordNotFound
	}
	data, err := v.GetRecord(ctx, purpose, token)
	if err != nil {
		return nil, err
	}
	return data, nil
}

func (v *VerificationRepository) BanEmail(ctx context.Context, email string, reason string) error {
	if email == "" || reason == "" {
		return apperrors.RequiredDataMissing.AddErrDetails("params is empty")
	}
	if _, err := v.DB.Exec(ctx, dbqueries.VerificationRepositoryBanEmail1, email, reason); err != nil {
		return err
	}
	return nil
}

func (v *VerificationRepository) IsBanned(ctx context.Context, email string) (bool, error) {
	if email == "" {
		return false, apperrors.RequiredDataMissing.AddErrDetails("param is empty")
	}
	var found bool
	if err := v.DB.QueryRow(ctx, dbqueries.VerificationRepositoryIsBanned1, email).Scan(&found); err != nil {
		return false, err
	}
	return found, nil
}

func (v *VerificationRepository) EmailExists(ctx context.Context, email string) (bool, error) {
	if email == "" {
		return false, apperrors.RequiredDataMissing.AddErrDetails("param is empty")
	}
	var exists bool
	if err := v.DB.QueryRow(ctx, dbqueries.VerificationRepositoryEmailExists1, email).Scan(&exists); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		logger.Debug("error: "+err.Error(), "")
		return false, err
	}
	return exists, nil
}

var _ maintenance.Repository = (*MaintenanceRepository)(nil)

func (m *MaintenanceRepository) CheckIsActive(ctx context.Context) (bool, error) {
	var active bool
	if err := m.DB.QueryRow(ctx, dbqueries.MaintenanceRepositoryCheckIsActive1).Scan(&active); err != nil {
		return false, err
	}
	return active, nil
}

func (m *MaintenanceRepository) SetActive(ctx context.Context, id uuid.UUID) error {
	_, err := m.DB.Exec(ctx, dbqueries.MaintenanceRepositorySetActive1, time.Now(), id)
	return err
}

func (m *MaintenanceRepository) IsPlanned(ctx context.Context) (bool, error) {
	var planned bool
	if err := m.DB.QueryRow(ctx, dbqueries.MaintenanceRepositoryIsPlanned1).Scan(&planned); err != nil {
		return false, err
	}
	return planned, nil
}

func (m *MaintenanceRepository) GetData(ctx context.Context) (*maintenance.Information, error) {
	active, err := m.CheckIsActive(ctx)
	if err != nil {
		return nil, err
	}
	if !active {
		return nil, apperrors.Conflict.AddErrDetails("maintenance is not active")
	}
	var info maintenance.Information
	var actualEnd sql.NullTime
	var by uint
	if err := m.DB.QueryRow(ctx, dbqueries.MaintenanceRepositoryGetData1).Scan(&info.ID, &info.Description, &info.Status, &info.Scope, &info.Type, &info.Planned.Start, &info.Planned.End, &info.Actual.Start, &actualEnd, &info.CreatedAt, &by); err != nil {
		return nil, err
	}
	_ = actualEnd
	info.CalledBy, err = getAuthor(ctx, by, m.DB)
	if err != nil {
		return nil, err
	}
	return &info, nil
}

func (m *MaintenanceRepository) Start(ctx context.Context, req maintenance.CreateST, by uint) error {
	active, err := m.CheckIsActive(ctx)
	if err != nil {
		return err
	}
	if active {
		return apperrors.Conflict.AddErrDetails("maintenance already active")
	}
	var typ string = "planned"
	var scope string = "all"
	if req.PlannedStart.IsZero() {
		req.PlannedStart = time.Now()
		typ = "emergency"
	}
	if req.Scope != nil {
		scope = *req.Scope
	}
	_, err = m.DB.Exec(ctx, dbqueries.MaintenanceRepositoryStart1, req.Description, scope, typ, req.PlannedStart, req.PlannedEnd, by)
	return err
}

func (m *MaintenanceRepository) Edit(ctx context.Context, req maintenance.EditST) error {
	active, err := m.CheckIsActive(ctx)
	if err != nil {
		return err
	}
	if !active {
		return apperrors.Conflict.AddErrDetails("maintenance is not active")
	}
	if req.Description == nil && req.Scope == nil {
		return apperrors.RequiredDataMissing.AddErrDetails("params is nil")
	}
	if req.Description != nil {
		if _, err := m.DB.Exec(ctx, dbqueries.MaintenanceRepositoryEdit1, *req.Description); err != nil {
			return err
		}
	}
	if req.Scope != nil {
		if _, err := m.DB.Exec(ctx, dbqueries.MaintenanceRepositoryEdit2, *req.Scope); err != nil {
			return err
		}
	}
	return nil
}

func (m *MaintenanceRepository) Complete(ctx context.Context) error {
	active, err := m.CheckIsActive(ctx)
	if err != nil {
		return err
	}
	if !active {
		return apperrors.Conflict.AddErrDetails("maintenance is not active")
	}
	if _, err := m.DB.Exec(ctx, dbqueries.MaintenanceRepositoryComplete1, time.Now()); err != nil {
		return err
	}
	return nil
}

func (m *MaintenanceRepository) GetList(ctx context.Context) (maintenance.Informations, error) {
	var list maintenance.Informations

	rows, err := m.DB.Query(ctx, dbqueries.MaintenanceRepositoryGetList1)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		r := &maintenance.Information{Planned: &maintenance.PlannedAt{}}
		var actualStart, actualEnd sql.NullTime
		var calledby uint

		if err := rows.Scan(
			&r.ID, &r.Description, &r.Status, &r.Scope, &r.Type,
			&r.Planned.Start, &r.Planned.End,
			&actualStart, &actualEnd,
			&r.CreatedAt, &calledby,
		); err != nil {
			return nil, err
		}

		r.CalledBy, err = getAuthor(ctx, calledby, m.DB)
		if err != nil {
			return nil, err
		}

		if actualStart.Valid {
			r.Actual.Start = actualStart.Time
		}
		if actualEnd.Valid {
			r.Actual.End = actualEnd.Time
		}

		list = append(list, r)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}
	return list, nil
}

/*
 * type Repository interface {
	Create(ctx context.Context, name, email, topic, brief string, user uint) (uuid.UUID, error)
	CreateMessage(ctx context.Context, id uuid.UUID, content string) error
	Accept(ctx context.Context, id uuid.UUID, who uint) error
	Info(ctx context.Context, id uuid.UUID) (*TicketInfo, error)
	List(ctx context.Context) ([]*TicketInfo, error)
	Messages(ctx context.Context, id uuid.UUID) ([]*TicketMessage, error)
	Close(ctx context.Context, id uuid.UUID, by string) error
 }
*/

var _ tickets.Repository = (*TicketsRepository)(nil)

const defaultTicketSystemMessage = "Ticket created, we'll respond soon..."

func (t *TicketsRepository) Create(ctx context.Context, data tickets.TicketCreationRequestor, topic tickets.TicketTopic, brief string) (*tickets.TicketCreationData, error) {
	if topic == "" || !topic.Valid() {
		logger.Debug(fmt.Sprintf("topic: %s, brief: %s", topic.String(), brief), "")
		return nil, apperrors.InvalidArguments.AddErrDetails("invalid topic")
	}
	if brief == "" {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("brief is empty")
	}
	if !data.Authorized && (data.Name == "" || data.Email == "") {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("authorize params is empty")
	}
	if data.Authorized {
		usr, err := getAuthor(ctx, *data.UID, t.DB)
		if err != nil {
			return nil, err
		}
		if usr != nil {
			data.Name = usr.Username
			data.Email = usr.Email.Address
		}
	}
	var id uuid.UUID
	if data.Authorized {
		if err := t.DB.QueryRow(ctx, dbqueries.TicketsRepositoryCreate1, data.Name, data.Email, topic, brief, *data.UID).Scan(&id); err != nil {
			return nil, err
		}
	} else {
		token, err := generateString(32)
		if err != nil {
			return nil, err
		}
		if err := t.DB.QueryRow(ctx, dbqueries.TicketsRepositoryCreate2, data.Name, data.Email, topic, brief, token).Scan(&id); err != nil {
			return nil, err
		}
		data.Token = &token
	}
	if _, err := t.DB.Exec(
		ctx,
		dbqueries.TicketsRepositoryCreate3,
		id,
		tickets.AuthorSystem.String(),
		defaultTicketSystemMessage,
	); err != nil {
		logger.Debug("failed to create system ticket message: "+err.Error(), "")
	}
	return &tickets.TicketCreationData{ID: id, Token: data.Token}, nil
}

func (t *TicketsRepository) CreateMessage(ctx context.Context, id uuid.UUID, content string, req tickets.TicketDataReq) error {
	info, err := t.User(ctx, id, req)
	if err != nil {
		return err
	}
	var by = "user"
	if info.Authorized {
		if req.Staff {
			by = "staff"
		}
		if _, err := t.DB.Exec(ctx, dbqueries.TicketsRepositoryCreateMessage1, id, *info.UID, info.Name, info.Email, by, content); err != nil {
			return err
		}
	} else {
		if _, err := t.DB.Exec(ctx, dbqueries.TicketsRepositoryCreateMessage2, id, info.Name, info.Email, by, content); err != nil {
			return err
		}
	}
	return nil
}

func (t *TicketsRepository) Accepted(ctx context.Context, id uuid.UUID) (bool, error) {
	var inProgress bool
	err := t.DB.QueryRow(ctx, dbqueries.TicketsRepositoryAccepted1, id).Scan(&inProgress)
	if err != nil {
		return false, err
	}
	return inProgress, nil
}

func (t *TicketsRepository) Accept(ctx context.Context, id uuid.UUID, who uint) error {
	if who == 0 {
		return apperrors.RequiredDataMissing.AddErrDetails("params is empty")
	}
	status := tickets.InProcessStatus.String()
	res, err := t.DB.Exec(
		ctx,
		dbqueries.TicketsRepositoryAccept1,
		who,
		time.Now(),
		status,
		id,
	)
	if err != nil {
		return err
	}
	affected := res.RowsAffected()
	if affected > 0 {
		return nil
	}
	var acceptor sql.NullInt64
	if err := t.DB.QueryRow(ctx, dbqueries.TicketsRepositoryAccept2, id).Scan(&acceptor); err != nil {
		return err
	}
	if acceptor.Valid && uint(acceptor.Int64) == who {
		return nil
	}
	logger.Debug("ticket already accepted", "")
	return apperrors.Conflict.AddErrDetails("ticket already accepted")
}

type scanner interface {
	Scan(...any) error
}

func (t *TicketsRepository) parseTicket(ctx context.Context, scanner scanner) (*tickets.Ticket, error) {
	var tr tickets.Ticket
	var acceptor sql.NullInt64
	var accepted, closed sql.NullTime
	var closedBy, closeReason, requestorToken sql.NullString
	var authorizedUID sql.NullInt64
	var err error

	if err = scanner.Scan(
		&tr.Id,
		&tr.Creator.Name,
		&tr.Creator.Email,
		&tr.Creator.Authorized,
		&authorizedUID,
		&requestorToken,
		&tr.Mcount,
		&acceptor,
		&tr.Status,
		&tr.Topic,
		&tr.Brief,
		&tr.CreatedAt,
		&accepted,
		&closed,
		&closedBy,
		&closeReason,
	); err != nil {
		return nil, err
	}

	if authorizedUID.Valid && tr.Creator.Authorized {
		uid := uint(authorizedUID.Int64)
		tr.Creator.UID = &uid
	}

	if requestorToken.Valid {
		tr.Creator.Token = &requestorToken.String
	}

	if accepted.Valid {
		v := tickets.NullAt(accepted.Time)
		tr.AcceptedAt = &v
	} else {
		tr.AcceptedAt = nil
	}

	if acceptor.Valid {
		tr.Acceptor, err = getAuthor(ctx, uint(acceptor.Int64), t.DB)
		if err != nil {
			return nil, err
		}
	}

	if closed.Valid {
		v := tickets.NullAt(closed.Time)
		tr.ClosedAt = &v
	} else {
		tr.ClosedAt = nil
	}

	if closedBy.Valid {
		tr.CloseBy = tickets.TicketClosedBy(closedBy.String)
	}

	if closeReason.Valid {
		tr.CloseReason = closeReason.String
	}
	return &tr, nil
}

func (t *TicketsRepository) Info(ctx context.Context, id uuid.UUID) (*tickets.Ticket, error) {
	info, err := t.parseTicket(ctx, t.DB.QueryRow(ctx, dbqueries.TicketsRepositoryInfo1, id))
	if err != nil {
		return nil, err
	}
	return info, nil
}

func (t *TicketsRepository) List(ctx context.Context, own bool, uid *uint, token *string) (tickets.Tickets, error) {
	var (
		query = dbqueries.TicketsRepositoryList1
		args  []any
	)
	if own {
		switch {
		case uid != nil:
			query = dbqueries.TicketsRepositoryList2
			args = []any{true, *uid}

		case token != nil:
			query = dbqueries.TicketsRepositoryList3
			args = []any{false, *token}

		default:
			return nil, apperrors.InvalidArguments
		}
	}
	var ts tickets.Tickets
	rows, err := t.DB.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer func() {
		rows.Close()
	}()
	for rows.Next() {
		info, err := t.parseTicket(ctx, rows)
		if err != nil {
			return nil, err
		}
		ts = append(ts, info)
	}
	return ts, nil
}

func (t *TicketsRepository) parseMessage(scanner scanner) (*tickets.TicketMessage, error) {
	var message tickets.TicketMessage
	var authorType string
	var authorName, authorEmail sql.NullString
	var authorUID sql.NullInt64
	var editedAt, deletedAt sql.NullTime
	var deletedBy sql.NullInt64
	if err := scanner.Scan(
		&message.ID,
		&message.TicketID,
		&authorType,
		&authorUID,
		&authorName,
		&authorEmail,
		&message.Content,
		&message.At,
		&editedAt,
		&deletedAt,
		&deletedBy,
	); err != nil {
		return nil, err
	}
	var author tickets.TicketMessageAuthor
	atype := tickets.TicketMessageAuthorType(authorType)
	if !atype.Valid() {
		return nil, apperrors.InvalidArguments.AddErrDetails("invalid author type")
	}
	author.Type = atype
	switch atype {
	case tickets.AuthorStaff:
		author.Authorized = true
		author.UID = &authorUID.Int64
	case tickets.AuthorUser:
		if authorUID.Valid {
			author.Authorized = true
			author.UID = &authorUID.Int64
		} else {
			author.Authorized = false
		}
	case tickets.AuthorSystem:
		name := "Aesterial Tickets System"
		email := "tickets@aesterial.xyz"
		author.AuthorName = &name
		author.AuthorEmail = &email
	}
	if authorName.Valid && authorName.String != "" {
		name := authorName.String
		author.AuthorName = &name
	}
	if authorEmail.Valid && authorEmail.String != "" {
		email := authorEmail.String
		author.AuthorEmail = &email
	}
	if editedAt.Valid {
		v := editedAt.Time
		message.EditedAt = &v
	}
	if deletedAt.Valid {
		v := deletedAt.Time
		message.DeletedAt = &v
	}
	if deletedBy.Valid {
		v := uint(deletedBy.Int64)
		message.DeletedByUID = &v
	}
	message.Author = &author
	return &message, nil
}

func (t *TicketsRepository) Messages(ctx context.Context, id uuid.UUID) (tickets.TicketMessages, error) {
	return t.messages(ctx, id, false)
}

func (t *TicketsRepository) MessagesAll(ctx context.Context, id uuid.UUID) (tickets.TicketMessages, error) {
	return t.messages(ctx, id, true)
}

func (t *TicketsRepository) messages(ctx context.Context, id uuid.UUID, includeDeleted bool) (tickets.TicketMessages, error) {
	var messages tickets.TicketMessages
	query := `
		SELECT
			m.id,
			m.ticket,
			m.author_type,
			m.author_uid,
			m.author_name,
			m.author_email,
			m.content,
			m.at,
			m.edited_at,
			m.deleted_at,
			m.deleted_by
		FROM ticket_messages m
		WHERE m.ticket = $1
	`
	if !includeDeleted {
		query += " AND m.deleted_at IS NULL"
	}
	query += " ORDER BY m.at ASC, m.id ASC"
	rows, err := t.DB.Query(ctx, query, id)
	if err != nil {
		return nil, err
	}
	defer func() {
		rows.Close()
	}()
	for rows.Next() {
		message, err := t.parseMessage(rows)
		if err != nil {
			return nil, err
		}
		messages = append(messages, message)
	}
	return messages, nil
}

func (t *TicketsRepository) MessageByID(ctx context.Context, id uuid.UUID, messageID int64, includeDeleted bool) (*tickets.TicketMessage, error) {
	if messageID <= 0 {
		return nil, apperrors.InvalidArguments.AddErrDetails("message id is incorrect")
	}
	query := `
		SELECT
			m.id,
			m.ticket,
			m.author_type,
			m.author_uid,
			m.author_name,
			m.author_email,
			m.content,
			m.at,
			m.edited_at,
			m.deleted_at,
			m.deleted_by
		FROM ticket_messages m
		WHERE m.ticket = $1 AND m.id = $2
	`
	if !includeDeleted {
		query += " AND m.deleted_at IS NULL"
	}
	msg, err := t.parseMessage(t.DB.QueryRow(ctx, query, id, messageID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.RecordNotFound
		}
		return nil, err
	}
	return msg, nil
}

func (t *TicketsRepository) IsMessageOwner(ctx context.Context, id uuid.UUID, messageID int64, req tickets.TicketDataReq) (bool, error) {
	if req.UID == nil && req.Token == nil {
		return false, apperrors.InvalidArguments.AddErrDetails("requestor is required")
	}
	msg, err := t.MessageByID(ctx, id, messageID, true)
	if err != nil {
		return false, err
	}
	if msg == nil || msg.Author == nil || msg.Author.Type == tickets.AuthorSystem {
		return false, nil
	}
	if req.UID != nil && msg.Author.UID != nil && uint(*msg.Author.UID) == *req.UID {
		return true, nil
	}
	if req.Token == nil {
		return false, nil
	}
	if msg.Author.Type != tickets.AuthorUser {
		return false, nil
	}
	requestor, err := t.User(ctx, id, tickets.TicketDataReq{Token: req.Token})
	if err != nil {
		return false, err
	}
	if requestor == nil {
		return false, apperrors.AccessDenied
	}
	authorEmail := ""
	if msg.Author.AuthorEmail != nil {
		authorEmail = strings.TrimSpace(*msg.Author.AuthorEmail)
	}
	return authorEmail != "" && strings.EqualFold(authorEmail, strings.TrimSpace(requestor.Email)), nil
}

func (t *TicketsRepository) EditMessage(ctx context.Context, id uuid.UUID, messageID int64, content string, req tickets.TicketDataReq) error {
	trimmed := strings.TrimSpace(content)
	if trimmed == "" {
		return apperrors.RequiredDataMissing.AddErrDetails("content is empty")
	}
	msg, err := t.MessageByID(ctx, id, messageID, true)
	if err != nil {
		return err
	}
	if msg == nil || msg.Author == nil || msg.Author.Type != tickets.AuthorUser {
		return apperrors.AccessDenied
	}
	if msg.DeletedAt != nil {
		return apperrors.Conflict.AddErrDetails("message already deleted")
	}
	owner, err := t.IsMessageOwner(ctx, id, messageID, req)
	if err != nil {
		return err
	}
	if !owner {
		return apperrors.AccessDenied
	}
	res, err := t.DB.Exec(
		ctx,
		dbqueries.TicketsRepositoryEditMessage1,
		trimmed,
		id,
		messageID,
	)
	if err != nil {
		return err
	}
	affected := res.RowsAffected()
	if affected > 0 {
		return nil
	}
	return apperrors.RecordNotFound
}

func (t *TicketsRepository) DeleteMessage(ctx context.Context, id uuid.UUID, messageID int64, deleterUID *uint) error {
	if messageID <= 0 {
		return apperrors.InvalidArguments.AddErrDetails("message id is incorrect")
	}
	var deletedBy any
	if deleterUID != nil {
		deletedBy = int64(*deleterUID)
	}
	res, err := t.DB.Exec(
		ctx,
		dbqueries.TicketsRepositoryDeleteMessage1,
		deletedBy,
		id,
		messageID,
	)
	if err != nil {
		return err
	}
	affected := res.RowsAffected()
	if affected > 0 {
		return nil
	}
	msg, err := t.MessageByID(ctx, id, messageID, true)
	if err != nil {
		return err
	}
	if msg != nil && msg.DeletedAt != nil {
		return apperrors.Conflict.AddErrDetails("message already deleted")
	}
	return apperrors.RecordNotFound
}

func (t *TicketsRepository) GetLatestMessage(ctx context.Context, id uuid.UUID) (*tickets.TicketMessage, error) {
	msg, err := t.parseMessage(t.DB.QueryRow(
		ctx,
		dbqueries.TicketsRepositoryGetLatestMessage1,
		id,
	))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return msg, nil
}

func (t *TicketsRepository) IsReqValid(ctx context.Context, id uuid.UUID, token tickets.TicketDataReq) (bool, error) {
	var exists bool
	if token.Token != nil {
		if err := t.DB.QueryRow(ctx, dbqueries.TicketsRepositoryIsReqValid1, *token.Token, id).Scan(&exists); err != nil {
			return false, err
		}
	}
	if token.UID != nil {
		if err := t.DB.QueryRow(ctx, dbqueries.TicketsRepositoryIsReqValid2, *token.UID, id).Scan(&exists); err != nil {
			return false, err
		}
	}
	return exists, nil
}

func (t *TicketsRepository) Close(ctx context.Context, id uuid.UUID, by tickets.TicketClosedBy, reason string) error {
	if by == "" || !by.Valid() {
		return apperrors.InvalidArguments.AddErrDetails("params is incorrect")
	}
	if by != tickets.ClosedByUser && reason == "" {
		return apperrors.RequiredDataMissing.AddErrDetails("reason not provided")
	}
	if _, err := t.DB.Exec(ctx, dbqueries.TicketsRepositoryClose1, by.String(), reason, "закрыт", id); err != nil {
		return err
	}
	return nil
}

func (t *TicketsRepository) IsClosed(ctx context.Context, id uuid.UUID) (bool, error) {
	var closed bool
	if err := t.DB.QueryRow(ctx, dbqueries.TicketsRepositoryIsClosed1, id).Scan(&closed); err != nil {
		return false, err
	}
	return closed, nil
}

func (t *TicketsRepository) User(ctx context.Context, id uuid.UUID, req tickets.TicketDataReq) (*tickets.TicketUserData, error) {
	if req.Staff && req.UID != nil {
		usr, err := getAuthor(ctx, *req.UID, t.DB)
		if err != nil {
			return nil, err
		}
		if usr == nil {
			return nil, apperrors.AccessDenied.AddErrDetails("user not found")
		}
		var data tickets.TicketUserData
		data.Authorized = true
		data.UID = req.UID
		data.Name = usr.Username
		if usr.Email != nil {
			data.Email = usr.Email.Address
		}
		return &data, nil
	}
	valid, err := t.IsReqValid(ctx, id, req)
	if err != nil {
		return nil, err
	}
	if !valid {
		return nil, apperrors.AccessDenied.AddErrDetails("don't have access")
	}
	var data tickets.TicketUserData
	if req.Token != nil {
		if err := t.DB.QueryRow(ctx, dbqueries.TicketsRepositoryUser1, *req.Token).Scan(&data.Name, &data.Email); err != nil {
			return nil, err
		}
	}
	if req.UID != nil {
		if err := t.DB.QueryRow(ctx, dbqueries.TicketsRepositoryUser2, *req.UID).Scan(&data.Name, &data.Email); err != nil {
			return nil, err
		}
		data.Authorized = true
		data.UID = req.UID
	}
	return &data, nil
}

func (t *TicketsRepository) LatestAt(ctx context.Context, id uuid.UUID) (*time.Time, error) {
	var at time.Time
	err := t.DB.QueryRow(ctx, dbqueries.TicketsRepositoryLatestAt1, id).Scan(&at)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		logger.Debug("error: "+err.Error(), "")
		return nil, err
	}
	return &at, nil
}

var _ rank.Repository = (*RanksRepository)(nil)

func (r *RanksRepository) List(ctx context.Context) ([]*rank.Rank, error) {
	var list []*rank.Rank
	rows, err := r.DB.Query(ctx, dbqueries.RanksRepositoryList1)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var ra rank.Rank
		var perms any
		if err = rows.Scan(&ra.Name, &ra.Color, &ra.Description, &ra.Weight, &perms, &ra.AddedAt); err != nil {
			return nil, err
		}
		list = append(list, &ra)
	}
	return list, nil
}

func (r *RanksRepository) UsersWithRank(ctx context.Context, name string) ([]*uint, error) {
	var list []*uint
	rows, err := r.DB.Query(ctx, dbqueries.RanksRepositoryUsersWithRank1, name)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id uint
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		list = append(list, &id)
	}
	return list, nil
}

func (r *RanksRepository) Perms(ctx context.Context, rank string) (*permissions.Permissions, error) {
	var raw []byte
	if err := r.DB.QueryRow(ctx,
		dbqueries.RanksRepositoryPerms1, rank,
	).Scan(&raw); err != nil {
		return nil, err
	}

	var perms permissions.Permissions
	if err := json.Unmarshal(raw, &perms); err != nil {
		return nil, err
	}
	return &perms, nil
}

func (r *RanksRepository) ChangePerms(ctx context.Context, rank string, perm permissions.Permission, state bool) error {
	res, err := r.DB.Exec(ctx,
		dbqueries.RanksRepositoryChangePerms1,
		perm.String(), state, rank,
	)
	if err != nil {
		return err
	}

	if n := res.RowsAffected(); n == 0 {
		return pgx.ErrNoRows
	}

	return nil
}

/*
	Edit(ctx context.Context, rank string, what string, data any) error
	Delete(ctx context.Context, rank string) error
	Get(ctx context.Context, rank string) (*Rank, error)
*/

func (r *RanksRepository) Create(ctx context.Context, name string, color int, description string, perms ...permissions.Permissions) error {
	if name == "" || color == 0 || description == "" {
		return apperrors.InvalidArguments.AddErrDetails("params is incorrect")
	}
	if len(perms) > 0 {
		bytes, err := json.Marshal(perms[0])
		if err != nil {
			return err
		}
		_, err = r.DB.Exec(ctx, dbqueries.RanksRepositoryCreate1, name, color, description, bytes)
		if err != nil {
			return err
		}
		return nil
	}
	_, err := r.DB.Exec(ctx, dbqueries.RanksRepositoryCreate2, name, color, description)
	if err != nil {
		return err
	}
	return nil
}

func (r *RanksRepository) IsExists(ctx context.Context, rank string) (bool, error) {
	if rank == "" {
		return false, apperrors.InvalidArguments.AddErrDetails("param is incorrect")
	}
	var exists bool
	if err := r.DB.QueryRow(ctx, dbqueries.RanksRepositoryIsExists1, rank).Scan(&exists); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	return exists, nil
}

func (r *RanksRepository) Edit(ctx context.Context, rank string, target string, data any) error {
	if rank == "" || target == "" || data == nil {
		return apperrors.InvalidArguments.AddErrDetails("params is incorrect")
	}
	exists, err := r.IsExists(ctx, rank)
	if err != nil {
		logger.Debug("failed to check is exists: "+err.Error(), "")
		return apperrors.ServerError
	}
	if !exists {
		return apperrors.RecordNotFound.AddErrDetails("rank is not exists")
	}

	type colInfo struct {
		col  string
		kind string
	}
	cols := map[string]colInfo{
		"description": {col: "description", kind: "string"},
		"name":        {col: "name", kind: "string"},
		"color":       {col: "color", kind: "int"},
	}

	info, ok := cols[target]
	if !ok {
		return apperrors.InvalidArguments.AddErrDetails("unknown target")
	}

	if v, ok := data.(*structpb.Value); ok {
		if v == nil {
			return apperrors.InvalidArguments.AddErrDetails("value is empty")
		}
		switch k := v.Kind.(type) {
		case *structpb.Value_StringValue:
			data = k.StringValue
		case *structpb.Value_NumberValue:
			data = k.NumberValue
		case *structpb.Value_BoolValue:
			data = k.BoolValue
		case *structpb.Value_NullValue:
			return apperrors.InvalidArguments.AddErrDetails("null is not allowed")
		case *structpb.Value_StructValue, *structpb.Value_ListValue:
			return apperrors.InvalidArguments.AddErrDetails("object/array is not allowed")
		default:
			return apperrors.InvalidArguments.AddErrDetails("unsupported value kind")
		}
	}

	var (
		query string
		val   any
	)

	switch info.kind {
	case "string":
		s, ok := data.(string)
		if !ok {
			return apperrors.InvalidArguments.AddErrDetails("invalid data type for target")
		}
		val = s

	case "int":
		switch v := data.(type) {
		case int:
			val = int64(v)
		case int32:
			val = int64(v)
		case int64:
			val = v
		case uint:
			if uint64(v) > uint64(^uint64(0)>>1) {
				return apperrors.InvalidArguments.AddErrDetails("uint overflow")
			}
			val = int64(v)
		case uint32:
			val = int64(v)
		case uint64:
			if v > uint64(^uint64(0)>>1) {
				return apperrors.InvalidArguments.AddErrDetails("uint overflow")
			}
			val = int64(v)

		case float64:
			if v != float64(int64(v)) {
				return apperrors.InvalidArguments.AddErrDetails("number must be an integer")
			}
			val = int64(v)

		default:
			return apperrors.InvalidArguments.AddErrDetails("invalid data type for target")
		}

	default:
		return apperrors.InvalidArguments.AddErrDetails("invalid target config")
	}

	query = dbqueries.UpdateRankByColumnPrefix + info.col + " = $1 WHERE name = $2"
	_, err = r.DB.Exec(ctx, query, val, rank)
	return err
}

func (r *RanksRepository) Get(ctx context.Context, name string) (*rank.Rank, error) {
	if name == "" {
		return nil, apperrors.InvalidArguments.AddErrDetails("params is incorrect")
	}
	var ra rank.Rank
	if err := r.DB.QueryRow(ctx, dbqueries.RanksRepositoryGet1, name).Scan(&ra.Color, &ra.Description, &ra.AddedAt); err != nil {
		return nil, err
	}
	ra.Name = name
	return &ra, nil
}

func (r *RanksRepository) Delete(ctx context.Context, rank string) error {
	if rank == "" {
		return apperrors.InvalidArguments.AddErrDetails("params is incorrect")
	}
	if _, err := r.DB.Exec(ctx, dbqueries.RanksRepositoryDelete1, rank); err != nil {
		return err
	}
	return nil
}

func (r *RanksRepository) CanEdit(ctx context.Context, current string, target string) (bool, error) {
	if current == "" || target == "" {
		return false, apperrors.InvalidArguments
	}

	var can bool
	err := r.DB.QueryRow(ctx, dbqueries.RanksRepositoryCanEdit1, current, target).Scan(&can)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, apperrors.RecordNotFound
		}
		return false, err
	}

	return can, nil
}

func (r *RanksRepository) CreateActivations(ctx context.Context, list []rank.ActivationData) error {
	for _, l := range list {
		if _, err := r.DB.Exec(ctx, dbqueries.RanksRepositoryCreateActivations1, l.Code, l.Rank); err != nil {
			return err
		}
	}
	return nil
}

func (n *NotificationsRepository) GetAll(ctx context.Context) (notifications.Notifications, error) {
	rows, err := n.DB.Query(ctx, dbqueries.NotificationsRepositoryGetAll1)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list notifications.Notifications
	for rows.Next() {
		var notify notifications.Notification
		var targetUserID sql.NullInt64
		var targetSegment sql.NullString
		var expiresAt sql.NullTime
		var scope string

		if err := rows.Scan(&notify.ID, &notify.Body, &notify.Created, &scope, &targetUserID, &targetSegment, &expiresAt); err != nil {
			return nil, err
		}

		notify.Scope = notifications.Scope(scope)

		if targetUserID.Valid {
			id := uint(targetUserID.Int64)
			notify.Target.User = &id
		}
		if targetSegment.Valid {
			rk := targetSegment.String
			notify.Target.Rank = &rk
		}
		if expiresAt.Valid {
			t := expiresAt.Time
			notify.Expires = &t
		}

		list = append(list, &notify)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return list, nil
}

func (n *NotificationsRepository) ForUser(ctx context.Context, id uint, rank string, shown bool) (notifications.Notifications, error) {
	if id == 0 {
		return nil, apperrors.InvalidArguments
	}

	rows, err := n.DB.Query(ctx, dbqueries.NotificationsRepositoryForUser1, id, rank, shown)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list notifications.Notifications
	for rows.Next() {
		var notify notifications.Notification
		var scope string
		var readAt sql.NullTime
		var expiresAt sql.NullTime

		if err := rows.Scan(&notify.ID, &notify.Body, &notify.Created, &scope, &expiresAt, &readAt); err != nil {
			return nil, err
		}

		notify.Scope = notifications.Scope(scope)
		if readAt.Valid {
			t := readAt.Time
			notify.Readed = &t
		}
		if expiresAt.Valid {
			t := expiresAt.Time
			notify.Expires = &t
		}
		list = append(list, &notify)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return list, nil
}

func (n *NotificationsRepository) Create(ctx context.Context, scope notifypb.Scope, body string, receiver *string, expires *time.Time) error {
	if scope == notifypb.Scope_SCOPE_UNSPECIFIED || body == "" {
		return apperrors.InvalidArguments
	}

	var targetUserID sql.NullInt64
	var targetSegment sql.NullString
	var scopeSTR string

	switch scope {
	case notifypb.Scope_SCOPE_USER:
		if receiver == nil {
			return apperrors.InvalidArguments
		}
		uid, err := strconv.ParseInt(*receiver, 10, 64)
		if err != nil || uid <= 0 {
			return apperrors.InvalidArguments
		}
		scopeSTR = "user"
		targetUserID = sql.NullInt64{Int64: uid, Valid: true}

	case notifypb.Scope_SCOPE_SEGMENT:
		if receiver == nil || *receiver == "" {
			return apperrors.InvalidArguments
		}
		scopeSTR = "segment"
		targetSegment = sql.NullString{String: *receiver, Valid: true}

	case notifypb.Scope_SCOPE_BROADCAST:
		scopeSTR = "broadcast"
		return n.insertNotification(ctx, body, scopeSTR, targetUserID, targetSegment, expires)

	default:
		return apperrors.InvalidArguments
	}

	return n.insertNotification(ctx, body, scopeSTR, targetUserID, targetSegment, expires)
}

func (n *NotificationsRepository) insertNotification(ctx context.Context, body, scope string, targetUserID sql.NullInt64, targetSegment sql.NullString, expires *time.Time) error {
	var id uuid.UUID
	if err := n.DB.QueryRow(
		ctx,
		dbqueries.NotificationsRepositoryInsertNotification1,
		body, scope, targetUserID, targetSegment, expires,
	).Scan(&id); err != nil {
		return err
	}
	return nil
}

func (n *NotificationsRepository) Mark(ctx context.Context, id uuid.UUID, uid uint) error {
	if uid == 0 {
		return apperrors.InvalidArguments
	}

	_, err := n.DB.Exec(ctx,
		dbqueries.NotificationsRepositoryMark1,
		id, uid,
	)
	return err
}
