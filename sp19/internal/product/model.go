package product

import (
	"time"
)

type Product struct {
	ProductID   int64     `gorm:"primaryKey;column:product_id"`
	Name        string    `gorm:"column:name;size:200;index:idx_name"`
	Description string    `gorm:"column:description;type:text"`
	Price       float64   `gorm:"column:price;type:decimal(10,2)"`
	Category    string    `gorm:"column:category;size:100;index:idx_category"`
	ViewCount   int64     `gorm:"column:view_count;default:0"`
	HotScore    float64   `gorm:"column:hot_score;default:0;index:idx_hot_score"`
	CreatedAt   time.Time `gorm:"column:created_at;autoCreateTime"`
	UpdatedAt   time.Time `gorm:"column:updated_at;autoUpdateTime"`
}

func (Product) TableName() string {
	return "products"
}
