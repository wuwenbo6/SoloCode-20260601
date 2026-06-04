package user

import (
	"time"
)

type User struct {
	UserID    int64     `gorm:"primaryKey;column:user_id"`
	Username  string    `gorm:"column:username;size:50;uniqueIndex"`
	Email     string    `gorm:"column:email;size:100;uniqueIndex"`
	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime"`
	UpdatedAt time.Time `gorm:"column:updated_at;autoUpdateTime"`
}

func (User) TableName() string {
	return "users"
}

type BrowseHistory struct {
	ID         int64     `gorm:"primaryKey;column:id"`
	UserID     int64     `gorm:"column:user_id;index:idx_user_product"`
	ProductID  int64     `gorm:"column:product_id;index:idx_user_product"`
	BrowsedAt  time.Time `gorm:"column:browsed_at;autoCreateTime;index:idx_browsed_at"`
}

func (BrowseHistory) TableName() string {
	return "browse_histories"
}
