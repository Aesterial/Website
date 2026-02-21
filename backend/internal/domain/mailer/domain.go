package mailer

import (
	"Aesterial/backend/internal/app/config"
	"strings"
)

type lang string

func (l lang) String() string {
	return string(l)
}

func (l lang) Replace(what string, to string) lang {
	return lang(strings.ReplaceAll(l.String(), what, to))
}

func (l lang) setSupportUrl(to string) lang {
	return l.Replace("{{support_url}}", to)
}

func (l lang) setPrivacyUrl(to string) lang {
	return l.Replace("{{privacy_url}}", to)
}

func (l lang) setUsername(username string) lang {
	return l.Replace("{{username}}", username)
}

func (l lang) SetRedirectUrl(url string) lang {
	return l.Replace("{{redirect_url}}", url)
}

func (l lang) SetCustom(data map[string]string) lang {
	for old, to := range data {
		old = strings.ReplaceAll(old, "{", "")
		old = "{{" + old + "}}"
		l = l.Replace(old, to)
	}
	return l
}

func (l lang) Normalize(usrname ...string) lang {
	var username string
	if len(usrname) == 1 {
		username = usrname[0]
	}
	env := config.Get()
	return l.setPrivacyUrl(env.URLs.Privacy).setSupportUrl(env.URLs.Support).setUsername(username)
}

type template struct {
	Ru lang
	En lang
}

func Get(target template, lang string) lang {
	switch lang {
	case "en":
		return target.En
	case "ru":
		return target.Ru
	default:
		return target.Ru
	}
}
