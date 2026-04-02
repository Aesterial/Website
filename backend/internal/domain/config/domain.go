package config

type Database struct {
	URL      string
	Host     string
	Name     string
	Port     string
	User     string
	Password string
	Sslmode  string
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
	UseStorage        bool
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

type Async struct {
	SubmissionsHydrationWorkers        int
	SubmissionsHydrationTimeoutSeconds int
	ProjectsHydrationWorkers           int
	ProjectsHydrationTimeoutSeconds    int
	MediaPresignWorkers                int
}

type Mailer struct {
	UseMailer bool
	Host      string
	Port      int
	User      string
	Pass      string
	FromName  string
	Secure    bool
	StartTLS  bool
	Domain    string

	ProxyAddr                  string
	ProxyTLSEnabled            bool
	ProxyTLSServerName         string
	ProxyTLSInsecureSkipVerify bool
	ProxyDialTimeoutSeconds    int
	ProxyRequestTimeoutSeconds int
	ProxyAuthToken             string
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

type URLs struct {
	Privacy string
	Support string
	Main    string
}

type Geocode struct {
	Provider  string
	UA        string
	Email     string
	RateLimit int
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
	Async    Async
	URLs     URLs
	Geocode  Geocode

	load bool
}

func (e Environment) Loaded() bool {
	return e.load
}

func (e *Environment) MarkLoaded() {
	if e == nil {
		return
	}
	e.load = true
}
