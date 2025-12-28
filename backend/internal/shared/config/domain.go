package config

var ENV Environment

type Database struct {
	Host string
	Name string
	Port string
	User string
	Pass string
}

type TLS struct {
	CertPath string
	KeyPath  string
}

type Cookies struct {
	Name     string
	Secret   string
	Domain   string
	SameSite string
	Secure   bool
}

type CORS struct {
	AllowedOrigins   string
	AllowCredentials bool
}

type Boot struct {
	Port      string
	IpService string
	UseTLS    bool
}

type Environment struct {
	Boot     Boot
	Database Database
	Cookies  Cookies
	CORS     CORS
	TLS      TLS
}
