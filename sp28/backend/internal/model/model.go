package model

import "time"

type User struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Username  string    `gorm:"uniqueIndex;size:64;not null" json:"username"`
	Password  string    `gorm:"size:256;not null" json:"-"`
	Role      string    `gorm:"size:20;default:user" json:"role"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (User) TableName() string { return "users" }

type Server struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	Name       string    `gorm:"size:128;not null" json:"name"`
	Host       string    `gorm:"size:256;not null" json:"host"`
	Port       int       `gorm:"default:22" json:"port"`
	Username   string    `gorm:"size:64;not null" json:"username"`
	Password   string    `gorm:"size:256" json:"password,omitempty"`
	KeyPath    string    `gorm:"size:512" json:"key_path,omitempty"`
	Tags       string    `gorm:"size:256" json:"tags,omitempty"`
	JumpHostID *uint     `gorm:"index" json:"jump_host_id,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
	JumpHost   *JumpHost `gorm:"foreignKey:JumpHostID" json:"jump_host,omitempty"`
}

func (Server) TableName() string { return "servers" }

type AccessRequest struct {
	ID         uint       `gorm:"primaryKey" json:"id"`
	UserID     uint       `gorm:"index;not null" json:"user_id"`
	ServerID   uint       `gorm:"index;not null" json:"server_id"`
	Reason     string     `gorm:"size:512" json:"reason"`
	Status     string     `gorm:"size:20;default:pending" json:"status"`
	ExpiresAt  time.Time  `json:"expires_at"`
	ReviewedBy *uint      `json:"reviewed_by,omitempty"`
	ReviewedAt *time.Time `json:"reviewed_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
	User       User       `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Server     Server     `gorm:"foreignKey:ServerID" json:"server,omitempty"`
}

func (AccessRequest) TableName() string { return "access_requests" }

type AccessGrant struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"index;not null" json:"user_id"`
	ServerID  uint      `gorm:"index;not null" json:"server_id"`
	RequestID uint      `gorm:"index;not null" json:"request_id"`
	ExpiresAt time.Time `gorm:"index;not null" json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
	User      User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Server    Server    `gorm:"foreignKey:ServerID" json:"server,omitempty"`
}

func (AccessGrant) TableName() string { return "access_grants" }

type Session struct {
	ID            uint       `gorm:"primaryKey" json:"id"`
	UserID        uint       `gorm:"index;not null" json:"user_id"`
	ServerID      uint       `gorm:"index;not null" json:"server_id"`
	StartTime     time.Time  `json:"start_time"`
	EndTime       *time.Time `json:"end_time,omitempty"`
	RecordingPath string     `gorm:"size:512" json:"recording_path,omitempty"`
	Status        string     `gorm:"size:20;default:active" json:"status"`
	User          User       `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Server        Server     `gorm:"foreignKey:ServerID" json:"server,omitempty"`
}

func (Session) TableName() string { return "sessions" }

type CommandBlacklist struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Pattern     string    `gorm:"size:512;uniqueIndex;not null" json:"pattern"`
	Description string    `gorm:"size:512" json:"description"`
	Severity    string    `gorm:"size:20;default:warning" json:"severity"`
	Enabled     bool      `gorm:"default:true" json:"enabled"`
	Block       bool      `gorm:"default:true" json:"block"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (CommandBlacklist) TableName() string { return "command_blacklists" }

type CommandLog struct {
	ID          uint              `gorm:"primaryKey" json:"id"`
	SessionID   uint              `gorm:"index;not null" json:"session_id"`
	UserID      uint              `gorm:"index;not null" json:"user_id"`
	ServerID    uint              `gorm:"index;not null" json:"server_id"`
	Command     string            `gorm:"type:text" json:"command"`
	Blocked     bool              `gorm:"default:false" json:"blocked"`
	MatchedRule *uint             `json:"matched_rule,omitempty"`
	ExecutedAt  time.Time         `gorm:"index" json:"executed_at"`
	User        User              `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Server      Server            `gorm:"foreignKey:ServerID" json:"server,omitempty"`
	Session     Session           `gorm:"foreignKey:SessionID" json:"session,omitempty"`
	Rule        *CommandBlacklist `gorm:"foreignKey:MatchedRule" json:"rule,omitempty"`
}

func (CommandLog) TableName() string { return "command_logs" }

type JumpHost struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"size:128;not null" json:"name"`
	Host      string    `gorm:"size:256;not null" json:"host"`
	Port      int       `gorm:"default:22" json:"port"`
	Username  string    `gorm:"size:64;not null" json:"username"`
	Password  string    `gorm:"size:256" json:"password,omitempty"`
	KeyPath   string    `gorm:"size:512" json:"key_path,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (JumpHost) TableName() string { return "jump_hosts" }
