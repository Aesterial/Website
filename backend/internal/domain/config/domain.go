package config

type Database struct {
	URL      string
	Host     string
	Name     string
	Port     string
	User     string
	Password string
}

type TLS struct {
	Use      bool
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
	AllowedOrigins []string
}

type Storage struct {
	Endpoint          string
	Region            string
	Bucket            string
	AccessKey         string
	SecretKey         string
	UseSSL            bool
	ForcePathStyle    bool
	PresignTTLSeconds int
}

type Services struct {
	IPService string
}

type Startup struct {
	Port     string
	GRPCPort string
	HTTPPort string
}

type Mailer struct {
	Host     string
	Port     int
	User     string
	Pass     string
	FromName string
	Secure   bool
}

type VK struct {
	ClientID           string
	ClientSecret       string
	RedirectURI        string
	Scope              string
	APIVersion         string
	SuccessRedirectURL string
	StateTTLSeconds    int
	StateSecret        string
}

type Environment struct {
	Startup  Startup
	TLS      TLS
	Cookies  Cookies
	Services Services
	Storage  Storage
	Cors     CORS
	Database Database
	Mailer   Mailer
	VK       VK

	load bool
}

func (e Environment) Loaded() bool {
	return e.load == true
}

func (e *Environment) MarkLoaded() {
	if e == nil {
		return
	}
	e.load = true
}
