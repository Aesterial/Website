package login

type RegisterRequire struct {
	Username string
	Password string
	Email    string
}

type AuthorizationRequire struct {
	Usermail string
	Password string
}

func (r RegisterRequire) IsEmpty() bool {
	return r.Username == "" && r.Password == "" && r.Email == ""
}

func (a AuthorizationRequire) IsEmpty() bool {
	return a.Usermail == "" && a.Password == ""
}
