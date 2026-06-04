package config

type Config struct {
	Server     ServerConfig     `yaml:"server" json:"server"`
	Etcd       EtcdConfig       `yaml:"etcd" json:"etcd"`
	Redis      RedisConfig      `yaml:"redis" json:"redis"`
	Encryption EncryptionConfig `yaml:"encryption" json:"encryption"`
}

type ServerConfig struct {
	Port            string `yaml:"port" json:"port"`
	LongPollTimeout int    `yaml:"long_poll_timeout" json:"long_poll_timeout"`
}

type EtcdConfig struct {
	Endpoints   []string `yaml:"endpoints" json:"endpoints"`
	DialTimeout int      `yaml:"dial_timeout" json:"dial_timeout"`
	Prefix      string   `yaml:"prefix" json:"prefix"`
}

type RedisConfig struct {
	Addr     string `yaml:"addr" json:"addr"`
	Password string `yaml:"password" json:"password"`
	DB       int    `yaml:"db" json:"db"`
	TTL      int    `yaml:"ttl" json:"ttl"`
}

type EncryptionConfig struct {
	Key string `yaml:"key" json:"key"`
}

func Load() *Config {
	return &Config{
		Server: ServerConfig{
			Port:            ":8080",
			LongPollTimeout: 30,
		},
		Etcd: EtcdConfig{
			Endpoints:   []string{"localhost:2379"},
			DialTimeout: 5,
			Prefix:      "/configs/",
		},
		Redis: RedisConfig{
			Addr:     "localhost:6379",
			Password: "",
			DB:       0,
			TTL:      300,
		},
		Encryption: EncryptionConfig{
			Key: "",
		},
	}
}
