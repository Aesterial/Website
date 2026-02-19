package permissions

import (
	permspb "Aesterial/backend/internal/gen/permissions/v1"
	"encoding/json"
	"errors"
	"strings"
)

type Permission string

const (
	All Permission = "all"

	ProjectsAll        Permission = "projects.all"
	ProjectsCreate     Permission = "projects.create"
	ProjectsView       Permission = "projects.view"
	ProjectsVote       Permission = "projects.vote"
	ProjectsUpdateAll  Permission = "projects.update.all"
	ProjectsUpdateOwn  Permission = "projects.update.own"
	ProjectsUpdateAny  Permission = "projects.update.any"
	ProjectsArchiveOwn Permission = "projects.archive.own"
	ProjectsArchiveAny Permission = "projects.archive.any"
	ProjectsDeleteAll  Permission = "projects.delete.all"
	ProjectsDeleteOwn  Permission = "projects.delete.own"
	ProjectsDeleteAny  Permission = "projects.delete.any"

	TicketsAll                   Permission = "tickets.all"
	TicketsCreate                Permission = "tickets.create"
	TicketsViewListOwn           Permission = "tickets.view_list.own"
	TicketsViewListAny           Permission = "tickets.view_list.any"
	TicketsAccept                Permission = "tickets.accept"
	TicketsMessageCreateAll      Permission = "tickets.message.create.all"
	TicketsMessageCreateAccepted Permission = "tickets.message.create.accepted"
	TicketsMessageCreateAny      Permission = "tickets.message.create.any"
	TicketsCloseAll              Permission = "tickets.close.all"
	TicketsCloseAccepted         Permission = "tickets.close.accepted"
	TicketsCloseAny              Permission = "tickets.close.any"

	SubmissionsAll     Permission = "submissions.all"
	SubmissionsView    Permission = "submissions.view"
	SubmissionsAccept  Permission = "submissions.accept"
	SubmissionsDecline Permission = "submissions.decline"

	StatisticsAll                 Permission = "statistics.all"
	StatisticsActivityAll         Permission = "statistics.activity.all"
	StatisticsActivityUsersPeriod Permission = "statistics.activity.users.period"
	StatisticsSubmissionsAll      Permission = "statistics.submissions.all"
	StatisticsSubmissionsRecap    Permission = "statistics.submissions.recap"
	StatisticsVotesAll            Permission = "statistics.votes.all"
	StatisticsVotesCategoriesTop  Permission = "statistics.votes.categories.top"
	StatisticsMediaAll            Permission = "statistics.media.all"
	StatisticsMediaQuality        Permission = "statistics.media.quality"
	StatisticsMediaVolume         Permission = "statistics.media.volume"

	UsersAll                          Permission = "users.all"
	UsersViewAll                      Permission = "users.view.all"
	UsersViewProfilePublic            Permission = "users.view.profile.public"
	UsersViewProfilePrivacy           Permission = "users.view.profile.privacy"
	UsersSettingsAll                  Permission = "users.settings.all"
	UsersSettingsChangeNameOwn        Permission = "users.settings.change.name.own"
	UsersSettingsChangeNameAny        Permission = "users.settings.change.name.any"
	UsersSettingsChangeDescriptionOwn Permission = "users.settings.change.description.own"
	UsersSettingsDeleteProfileOwn     Permission = "users.settings.delete.profile.own"
	UsersSettingsDeleteAvatarOwn      Permission = "users.settings.delete.avatar.own"
	UsersSettingsDeleteAvatarAny      Permission = "users.settings.delete.avatar.any"
	UsersSettingsDeleteDescriptionOwn Permission = "users.settings.delete.description.own"
	UsersSettingsDeleteDescriptionAny Permission = "users.settings.delete.description.any"
	UsersSettingsResetAll             Permission = "users.settings.reset.all"
	UsersSettingsResetPasswordOwn     Permission = "users.settings.reset.password.own"
	UsersSettingsResetPasswordAny     Permission = "users.settings.reset.password.any"
	UsersModerationAll                Permission = "users.moderation.all"
	UsersModerationBan                Permission = "users.moderation.ban"
	UsersModerationBanForever         Permission = "users.moderation.ban_forever"
	UsersModerationUnban              Permission = "users.moderation.unban"
	UsersModerationSetAll             Permission = "users.moderation.set.all"
	UsersModerationSetRank            Permission = "users.moderation.set.rank"

	RanksAll               Permission = "ranks.all"
	RanksPermissionsChange Permission = "ranks.permissions_change"
	RanksAdd               Permission = "ranks.add"
	RanksDelete            Permission = "ranks.delete"
	RanksEdit              Permission = "ranks.edit"

	MaintenanceAll      Permission = "maintenance.all"
	MaintenanceStart    Permission = "maintenance.start"
	MaintenanceEdit     Permission = "maintenance.edit"
	MaintenanceComplete Permission = "maintenance.complete"
	MaintenanceHistory  Permission = "maintenance.history"

	NotificationsAll             Permission = "notifications.all"
	NotificationsViewAll         Permission = "notifications.view.all"
	NotificationsCreateAll       Permission = "notifications.create.all"
	NotificationsCreateUser      Permission = "notifications.create.user"
	NotificationsCreateSegment   Permission = "notifications.create.segment"
	NotificationsCreateBroadcast Permission = "notifications.create.broadcast"
)

func (p Permission) String() string {
	return string(p)
}

func (p Permission) IsValid() bool {
	s := string(p)
	if s == "all" {
		return true
	}
	if s == "" || s[0] == '.' || s[len(s)-1] == '.' {
		return false
	}
	for i := 0; i < len(s); i++ {
		c := s[i]
		if (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '.' || c == '_' {
			continue
		}
		return false
	}
	for i := 0; i < len(s); i++ {
		if s[i] == '.' {
			return true
		}
	}
	return false
}

type ProjectsUpdatePermissions struct {
	All bool `json:"all"`
	Own bool `json:"own"`
	Any bool `json:"any"`
}

type ProjectsArchivePermissions struct {
	Own bool `json:"own"`
	Any bool `json:"any"`
}

type ProjectsDeletePermissions struct {
	All bool `json:"all"`
	Own bool `json:"own"`
	Any bool `json:"any"`
}

type ProjectsPermissions struct {
	All     bool                       `json:"all"`
	Create  bool                       `json:"create"`
	View    bool                       `json:"view"`
	Vote    bool                       `json:"vote"`
	Update  ProjectsUpdatePermissions  `json:"update"`
	Archive ProjectsArchivePermissions `json:"archive"`
	Delete  ProjectsDeletePermissions  `json:"delete"`
}

type MaintenancePermissions struct {
	All      bool `json:"all"`
	Start    bool `json:"start"`
	Edit     bool `json:"edit"`
	Complete bool `json:"complete"`
	History  bool `json:"history"`
}

type NotificationsViewPermissions struct {
	All bool `json:"all"`
}

type NotificationsCreatePermissions struct {
	All       bool `json:"all"`
	User      bool `json:"user"`
	Segment   bool `json:"segment"`
	Broadcast bool `json:"broadcast"`
}

type NotificationsPermissions struct {
	All    bool                           `json:"all"`
	View   NotificationsViewPermissions   `json:"view"`
	Create NotificationsCreatePermissions `json:"create"`
}

type TicketsViewListPermissions struct {
	Own bool `json:"own"`
	Any bool `json:"any"`
}

type TicketsMessageCreatePermissions struct {
	All      bool `json:"all"`
	Accepted bool `json:"accepted"`
	Any      bool `json:"any"`
}

type TicketsMessagePermissions struct {
	Create TicketsMessageCreatePermissions `json:"create"`
}

type TicketsClosePermissions struct {
	All      bool `json:"all"`
	Accepted bool `json:"accepted"`
	Any      bool `json:"any"`
}

type TicketsPermissions struct {
	All      bool                       `json:"all"`
	Create   bool                       `json:"create"`
	ViewList TicketsViewListPermissions `json:"view_list"`
	Accept   bool                       `json:"accept"`
	Message  TicketsMessagePermissions  `json:"message"`
	Close    TicketsClosePermissions    `json:"close"`
}

type SubmissionsPermissions struct {
	All     bool `json:"all"`
	View    bool `json:"view"`
	Accept  bool `json:"accept"`
	Decline bool `json:"decline"`
}

type StatisticsActivityUsersPermissions struct {
	Period bool `json:"period"`
}

type StatisticsActivityPermissions struct {
	All   bool                               `json:"all"`
	Users StatisticsActivityUsersPermissions `json:"users"`
}

type StatisticsSubmissionsPermissions struct {
	All   bool `json:"all"`
	Recap bool `json:"recap"`
}

type StatisticsVotesCategoriesPermissions struct {
	Top bool `json:"top"`
}

type StatisticsVotesPermissions struct {
	All        bool                                 `json:"all"`
	Categories StatisticsVotesCategoriesPermissions `json:"categories"`
}

type StatisticsMediaPermissions struct {
	All     bool `json:"all"`
	Quality bool `json:"quality"`
	Volume  bool `json:"volume"`
}

type StatisticsPermissions struct {
	All         bool                             `json:"all"`
	Activity    StatisticsActivityPermissions    `json:"activity"`
	Submissions StatisticsSubmissionsPermissions `json:"submissions"`
	Votes       StatisticsVotesPermissions       `json:"votes"`
	Media       StatisticsMediaPermissions       `json:"media"`
}

type UsersViewProfilePermissions struct {
	Public  bool `json:"public"`
	Privacy bool `json:"privacy"`
}

type UsersViewPermissions struct {
	All     bool                        `json:"all"`
	Profile UsersViewProfilePermissions `json:"profile"`
}

type UsersSettingsChangeNamePermissions struct {
	Own bool `json:"own"`
	Any bool `json:"any"`
}

type UsersSettingsChangeDescriptionPermissions struct {
	Own bool `json:"own"`
}

type UsersSettingsChangePermissions struct {
	Name        UsersSettingsChangeNamePermissions        `json:"name"`
	Description UsersSettingsChangeDescriptionPermissions `json:"description"`
}

type UsersSettingsDeleteProfilePermissions struct {
	Own bool `json:"own"`
}

type UsersSettingsDeleteAvatarPermissions struct {
	Own bool `json:"own"`
	Any bool `json:"any"`
}

type UsersSettingsDeleteDescriptionPermissions struct {
	Own bool `json:"own"`
	Any bool `json:"any"`
}

type UsersSettingsDeletePermissions struct {
	Profile     UsersSettingsDeleteProfilePermissions     `json:"profile"`
	Avatar      UsersSettingsDeleteAvatarPermissions      `json:"avatar"`
	Description UsersSettingsDeleteDescriptionPermissions `json:"description"`
}

type UsersSettingsResetPasswordPermissions struct {
	Own bool `json:"own"`
	Any bool `json:"any"`
}

type UsersSettingsResetPermissions struct {
	All      bool                                  `json:"all"`
	Password UsersSettingsResetPasswordPermissions `json:"password"`
}

type UsersSettingsPermissions struct {
	All    bool                           `json:"all"`
	Change UsersSettingsChangePermissions `json:"change"`
	Delete UsersSettingsDeletePermissions `json:"delete"`
	Reset  UsersSettingsResetPermissions  `json:"reset"`
}

type UsersModerationSetPermissions struct {
	All  bool `json:"all"`
	Rank bool `json:"rank"`
}

type UsersModerationPermissions struct {
	All        bool                          `json:"all"`
	Ban        bool                          `json:"ban"`
	BanForever bool                          `json:"ban_forever"`
	Unban      bool                          `json:"unban"`
	Set        UsersModerationSetPermissions `json:"set"`
}

type UsersPermissions struct {
	All        bool                       `json:"all"`
	View       UsersViewPermissions       `json:"view"`
	Settings   UsersSettingsPermissions   `json:"settings"`
	Moderation UsersModerationPermissions `json:"moderation"`
}

type RanksPermissions struct {
	All               bool `json:"all"`
	PermissionsChange bool `json:"permissions_change"`
	Add               bool `json:"add"`
	Delete            bool `json:"delete"`
	Edit              bool `json:"edit"`
}

type Permissions struct {
	All           bool                     `json:"all"`
	Projects      ProjectsPermissions      `json:"projects"`
	Tickets       TicketsPermissions       `json:"tickets"`
	Submissions   SubmissionsPermissions   `json:"submissions"`
	Statistics    StatisticsPermissions    `json:"statistics"`
	Users         UsersPermissions         `json:"users"`
	Ranks         RanksPermissions         `json:"ranks"`
	Maintenance   MaintenancePermissions   `json:"maintenance"`
	Notifications NotificationsPermissions `json:"notifications"`
}

func (p *Permissions) Allowed(perm Permission) bool {
	if p == nil {
		return false
	}
	path, err := normalizePath(string(perm))
	if err != nil || len(path) == 0 {
		return false
	}
	if p.All {
		return true
	}
	tree := p.toMap()
	if len(tree) == 0 {
		return false
	}
	for i := 1; i <= len(path); i++ {
		prefix := make([]string, 0, i+1)
		prefix = append(prefix, path[:i]...)
		prefix = append(prefix, "all")
		if pathValueTrue(tree, prefix) {
			return true
		}
	}
	return pathValueTrue(tree, path)
}

func normalizePath(raw string) ([]string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, errors.New("permission path is empty")
	}
	trimmed = strings.ToLower(trimmed)
	if trimmed == "*" || trimmed == ".*" {
		return []string{"all"}, nil
	}
	parts := strings.Split(trimmed, ".")
	if len(parts) == 0 {
		return nil, errors.New("permission path is empty")
	}
	if parts[len(parts)-1] == "*" {
		parts[len(parts)-1] = "all"
	}
	return parts, nil
}

func (p *Permissions) toMap() map[string]any {
	raw, err := json.Marshal(p)
	if err != nil {
		return nil
	}
	var out map[string]any
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil
	}
	return out
}

func pathValueTrue(tree any, path []string) bool {
	current := tree
	for _, part := range path {
		obj, ok := current.(map[string]any)
		if !ok {
			return false
		}
		next, ok := obj[part]
		if !ok {
			return false
		}
		current = next
	}
	val, ok := current.(bool)
	return ok && val
}

func (p *Permissions) ToProto() *permspb.Permissions {
	if p == nil {
		return nil
	}
	return &permspb.Permissions{
		All: p.All,
		Projects: &permspb.PermissionsProjectsPermissionsT{
			All:    p.Projects.All,
			Create: p.Projects.Create,
			View:   p.Projects.View,
			Vote:   p.Projects.Vote,
			Update: &permspb.PermissionsProjectsPermissionsTUpdateT{
				All: p.Projects.Update.All,
				Own: p.Projects.Update.Own,
				Any: p.Projects.Update.Any,
			},
			Archive: &permspb.PermissionsProjectsPermissionsTArchiveT{
				Own: p.Projects.Archive.Own,
				Any: p.Projects.Archive.Any,
			},
			Delete: &permspb.PermissionsProjectsPermissionsTDeleteT{
				All: p.Projects.Delete.All,
				Own: p.Projects.Delete.Own,
				Any: p.Projects.Delete.Any,
			},
		},
		Tickets: &permspb.PermissionsTicketsPermissionsT{
			All:    p.Tickets.All,
			Create: p.Tickets.Create,
			ViewList: &permspb.PermissionsTicketsPermissionsTViewListT{
				Own: p.Tickets.ViewList.Own,
				Any: p.Tickets.ViewList.Any,
			},
			Accept: p.Tickets.Accept,
			Message: &permspb.PermissionsTicketsPermissionsTMessageT{
				Create: &permspb.PermissionsTicketsPermissionsTMessageCreateT{
					All:      p.Tickets.Message.Create.All,
					Accepted: p.Tickets.Message.Create.Accepted,
					Any:      p.Tickets.Message.Create.Any,
				},
			},
			Close: &permspb.PermissionsTicketsPermissionsTCloseT{
				All:      p.Tickets.Close.All,
				Accepted: p.Tickets.Close.Accepted,
				Any:      p.Tickets.Close.Any,
			},
		},
		Submissions: &permspb.PermissionsSubmissionsPermissionsT{
			All:     p.Submissions.All,
			View:    p.Submissions.View,
			Accept:  p.Submissions.Accept,
			Decline: p.Submissions.Decline,
		},
		Statistics: &permspb.PermissionsStatisticsPermissionsT{
			All: p.Statistics.All,
			Activity: &permspb.PermissionsStatisticsPermissionsTActivityT{
				All: p.Statistics.Activity.All,
				Users: &permspb.PermissionsStatisticsPermissionsTActivityTUsersT{
					Period: p.Statistics.Activity.Users.Period,
				},
			},
			Submissions: &permspb.PermissionsStatisticsPermissionsTSubmissionsT{
				All:   p.Statistics.Submissions.All,
				Recap: p.Statistics.Submissions.Recap,
			},
			Votes: &permspb.PermissionsStatisticsPermissionsTVotesT{
				All: p.Statistics.Votes.All,
				Categories: &permspb.PermissionsStatisticsPermissionsTVotesTCategoriesT{
					Top: p.Statistics.Votes.Categories.Top,
				},
			},
			Media: &permspb.PermissionsStatisticsPermissionsTMediaT{
				All:     p.Statistics.Media.All,
				Quality: p.Statistics.Media.Quality,
				Volume:  p.Statistics.Media.Volume,
			},
		},
		Users: &permspb.PermissionsUsersPermissionsT{
			All: p.Users.All,
			View: &permspb.PermissionsUsersPermissionsTViewT{
				All: p.Users.View.All,
				Profile: &permspb.PermissionsUsersPermissionsTViewTProfileT{
					Public:  p.Users.View.Profile.Public,
					Privacy: p.Users.View.Profile.Privacy,
				},
			},
			Settings: &permspb.PermissionsUsersPermissionsTSettingsT{
				All: p.Users.Settings.All,
				Change: &permspb.PermissionsUsersPermissionsTSettingsTChangeT{
					Name: &permspb.PermissionsUsersPermissionsTSettingsTChangeTNameT{
						Own: p.Users.Settings.Change.Name.Own,
						Any: p.Users.Settings.Change.Name.Any,
					},
					Description: &permspb.PermissionsUsersPermissionsTSettingsTChangeTDescriptionT{
						Own: p.Users.Settings.Change.Description.Own,
					},
				},
				Delete: &permspb.PermissionsUsersPermissionsTSettingsTDeleteT{
					Profile: &permspb.PermissionsUsersPermissionsTSettingsTDeleteTProfileT{
						Own: p.Users.Settings.Delete.Profile.Own,
					},
					Avatar: &permspb.PermissionsUsersPermissionsTSettingsTDeleteTAvatarT{
						Own: p.Users.Settings.Delete.Avatar.Own,
						Any: p.Users.Settings.Delete.Avatar.Any,
					},
					Description: &permspb.PermissionsUsersPermissionsTSettingsTDeleteTDescriptionT{
						Own: p.Users.Settings.Delete.Description.Own,
						Any: p.Users.Settings.Delete.Description.Any,
					},
				},
				Reset_: &permspb.PermissionsUsersPermissionsTSettingsTResetT{
					All: p.Users.Settings.Reset.All,
					Password: &permspb.PermissionsUsersPermissionsTSettingsTResetTPasswordT{
						Own: p.Users.Settings.Reset.Password.Own,
						Any: p.Users.Settings.Reset.Password.Any,
					},
				},
			},
			Moderation: &permspb.PermissionsUsersPermissionsTModerationT{
				All:        p.Users.Moderation.All,
				Ban:        p.Users.Moderation.Ban,
				BanForever: p.Users.Moderation.BanForever,
				Unban:      p.Users.Moderation.Unban,
				Set: &permspb.PermissionsUsersPermissionsTModerationTSetT{
					All:  p.Users.Moderation.Set.All,
					Rank: p.Users.Moderation.Set.Rank,
				},
			},
		},
		Ranks: &permspb.PermissionsRanksPermissionsT{
			All:         p.Ranks.All,
			PermsChange: p.Ranks.PermissionsChange,
			Add:         p.Ranks.Add,
			Delete:      p.Ranks.Delete,
			Edit:        p.Ranks.Edit,
		},
	}
}

func (p *Permissions) Merge(in *permspb.Permissions) *Permissions {
	base := p
	if base == nil {
		base = &Permissions{}
	}
	if in == nil {
		return base
	}
	base.All = in.All
	if in.Projects != nil {
		base.Projects.All = in.Projects.All
		base.Projects.Create = in.Projects.Create
		base.Projects.View = in.Projects.View
		base.Projects.Vote = in.Projects.Vote
		if in.Projects.Update != nil {
			base.Projects.Update.All = in.Projects.Update.All
			base.Projects.Update.Own = in.Projects.Update.Own
			base.Projects.Update.Any = in.Projects.Update.Any
		}
		if in.Projects.Archive != nil {
			base.Projects.Archive.Own = in.Projects.Archive.Own
			base.Projects.Archive.Any = in.Projects.Archive.Any
		}
		if in.Projects.Delete != nil {
			base.Projects.Delete.All = in.Projects.Delete.All
			base.Projects.Delete.Own = in.Projects.Delete.Own
			base.Projects.Delete.Any = in.Projects.Delete.Any
		}
	}
	if in.Tickets != nil {
		base.Tickets.All = in.Tickets.All
		base.Tickets.Create = in.Tickets.Create
		if in.Tickets.ViewList != nil {
			base.Tickets.ViewList.Own = in.Tickets.ViewList.Own
			base.Tickets.ViewList.Any = in.Tickets.ViewList.Any
		}
		base.Tickets.Accept = in.Tickets.Accept
		if in.Tickets.Message != nil && in.Tickets.Message.Create != nil {
			base.Tickets.Message.Create.All = in.Tickets.Message.Create.All
			base.Tickets.Message.Create.Accepted = in.Tickets.Message.Create.Accepted
			base.Tickets.Message.Create.Any = in.Tickets.Message.Create.Any
		}
		if in.Tickets.Close != nil {
			base.Tickets.Close.All = in.Tickets.Close.All
			base.Tickets.Close.Accepted = in.Tickets.Close.Accepted
			base.Tickets.Close.Any = in.Tickets.Close.Any
		}
	}
	if in.Submissions != nil {
		base.Submissions.All = in.Submissions.All
		base.Submissions.View = in.Submissions.View
		base.Submissions.Accept = in.Submissions.Accept
		base.Submissions.Decline = in.Submissions.Decline
	}
	if in.Statistics != nil {
		base.Statistics.All = in.Statistics.All
		if in.Statistics.Activity != nil {
			base.Statistics.Activity.All = in.Statistics.Activity.All
			if in.Statistics.Activity.Users != nil {
				base.Statistics.Activity.Users.Period = in.Statistics.Activity.Users.Period
			}
		}
		if in.Statistics.Submissions != nil {
			base.Statistics.Submissions.All = in.Statistics.Submissions.All
			base.Statistics.Submissions.Recap = in.Statistics.Submissions.Recap
		}
		if in.Statistics.Votes != nil {
			base.Statistics.Votes.All = in.Statistics.Votes.All
			if in.Statistics.Votes.Categories != nil {
				base.Statistics.Votes.Categories.Top = in.Statistics.Votes.Categories.Top
			}
		}
		if in.Statistics.Media != nil {
			base.Statistics.Media.All = in.Statistics.Media.All
			base.Statistics.Media.Quality = in.Statistics.Media.Quality
			base.Statistics.Media.Volume = in.Statistics.Media.Volume
		}
	}
	if in.Users != nil {
		base.Users.All = in.Users.All
		if in.Users.View != nil {
			base.Users.View.All = in.Users.View.All
			if in.Users.View.Profile != nil {
				base.Users.View.Profile.Public = in.Users.View.Profile.Public
				base.Users.View.Profile.Privacy = in.Users.View.Profile.Privacy
			}
		}
		if in.Users.Settings != nil {
			base.Users.Settings.All = in.Users.Settings.All
			if in.Users.Settings.Change != nil {
				if in.Users.Settings.Change.Name != nil {
					base.Users.Settings.Change.Name.Own = in.Users.Settings.Change.Name.Own
					base.Users.Settings.Change.Name.Any = in.Users.Settings.Change.Name.Any
				}
				if in.Users.Settings.Change.Description != nil {
					base.Users.Settings.Change.Description.Own = in.Users.Settings.Change.Description.Own
				}
			}
			if in.Users.Settings.Delete != nil {
				if in.Users.Settings.Delete.Profile != nil {
					base.Users.Settings.Delete.Profile.Own = in.Users.Settings.Delete.Profile.Own
				}
				if in.Users.Settings.Delete.Avatar != nil {
					base.Users.Settings.Delete.Avatar.Own = in.Users.Settings.Delete.Avatar.Own
					base.Users.Settings.Delete.Avatar.Any = in.Users.Settings.Delete.Avatar.Any
				}
				if in.Users.Settings.Delete.Description != nil {
					base.Users.Settings.Delete.Description.Own = in.Users.Settings.Delete.Description.Own
					base.Users.Settings.Delete.Description.Any = in.Users.Settings.Delete.Description.Any
				}
			}
			if in.Users.Settings.Reset_ != nil {
				base.Users.Settings.Reset.All = in.Users.Settings.Reset_.All
				if in.Users.Settings.Reset_.Password != nil {
					base.Users.Settings.Reset.Password.Own = in.Users.Settings.Reset_.Password.Own
					base.Users.Settings.Reset.Password.Any = in.Users.Settings.Reset_.Password.Any
				}
			}
		}
		if in.Users.Moderation != nil {
			base.Users.Moderation.All = in.Users.Moderation.All
			base.Users.Moderation.Ban = in.Users.Moderation.Ban
			base.Users.Moderation.BanForever = in.Users.Moderation.BanForever
			base.Users.Moderation.Unban = in.Users.Moderation.Unban
			if in.Users.Moderation.Set != nil {
				base.Users.Moderation.Set.All = in.Users.Moderation.Set.All
				base.Users.Moderation.Set.Rank = in.Users.Moderation.Set.Rank
			}
		}
	}
	if in.Ranks != nil {
		base.Ranks.All = in.Ranks.All
		base.Ranks.PermissionsChange = in.Ranks.PermsChange
		base.Ranks.Add = in.Ranks.Add
		base.Ranks.Delete = in.Ranks.Delete
		base.Ranks.Edit = in.Ranks.Edit
	}
	return base
}
