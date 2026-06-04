package model

import (
	"time"
)

type ConfigItem struct {
	Key            string                 `json:"key" yaml:"key"`
	Value          map[string]interface{} `json:"value" yaml:"value"`
	EncryptedValue string                 `json:"encrypted_value,omitempty" yaml:"encrypted_value,omitempty"`
	Encrypted      bool                   `json:"encrypted" yaml:"encrypted"`
	Version        int                    `json:"version" yaml:"version"`
	CreatedAt      time.Time              `json:"created_at" yaml:"created_at"`
	UpdatedAt      time.Time              `json:"updated_at" yaml:"updated_at"`
	Format         string                 `json:"format" yaml:"format"`
}

type ConfigVersion struct {
	Key            string                 `json:"key" yaml:"key"`
	Value          map[string]interface{} `json:"value" yaml:"value"`
	EncryptedValue string                 `json:"encrypted_value,omitempty" yaml:"encrypted_value,omitempty"`
	Encrypted      bool                   `json:"encrypted" yaml:"encrypted"`
	Version        int                    `json:"version" yaml:"version"`
	CreatedAt      time.Time              `json:"created_at" yaml:"created_at"`
}

type CreateConfigRequest struct {
	Key       string                 `json:"key" binding:"required"`
	Value     map[string]interface{} `json:"value" binding:"required"`
	Format    string                 `json:"format"`
	Encrypted bool                   `json:"encrypted"`
}

type UpdateConfigRequest struct {
	Value     map[string]interface{} `json:"value" binding:"required"`
	Format    string                 `json:"format"`
	Encrypted bool                   `json:"encrypted"`
}

type RollbackRequest struct {
	Version int `json:"version" binding:"required,min=1"`
}

type WatchEvent struct {
	Type   string      `json:"type"`
	Key    string      `json:"key"`
	Config *ConfigItem `json:"config"`
}

type AuditLog struct {
	ID        string                 `json:"id"`
	Key       string                 `json:"key"`
	Action    string                 `json:"action"`
	Operator  string                 `json:"operator"`
	OldValue  map[string]interface{} `json:"old_value,omitempty"`
	NewValue  map[string]interface{} `json:"new_value,omitempty"`
	Version   int                    `json:"version"`
	Timestamp time.Time              `json:"timestamp"`
}

type AuditQueryRequest struct {
	Key      string `form:"key"`
	Action   string `form:"action"`
	Operator string `form:"operator"`
	From     string `form:"from"`
	To       string `form:"to"`
	Limit    int    `form:"limit"`
	Offset   int    `form:"offset"`
}
