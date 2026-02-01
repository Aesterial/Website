package login

type RegisterRequire struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Email    string `json:"email"`
}

type AuthorizationRequire struct {
	Usermail string `json:"usermail"`
	Password string `json:"password"`
}

func (r RegisterRequire) IsEmpty() bool {
	return r.Username == "" || r.Password == "" || r.Email == ""
}

func (a AuthorizationRequire) IsEmpty() bool {
	return a.Usermail == "" || a.Password == ""
}

type TOTPData struct {
	QR     string
	URL    string
	Secret string
}
