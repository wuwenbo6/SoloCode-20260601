package repository

import (
	"ssh-web-terminal/internal/model"
	"time"

	"gorm.io/gorm"
)

type AccessRepository struct {
	db *gorm.DB
}

func NewAccessRepository(db *gorm.DB) *AccessRepository {
	return &AccessRepository{db: db}
}

func (r *AccessRepository) CreateRequest(req *model.AccessRequest) error {
	return r.db.Create(req).Error
}

func (r *AccessRepository) FindRequestByID(id uint) (*model.AccessRequest, error) {
	var req model.AccessRequest
	if err := r.db.Preload("User").Preload("Server").First(&req, id).Error; err != nil {
		return nil, err
	}
	return &req, nil
}

func (r *AccessRepository) ListRequests(status string) ([]model.AccessRequest, error) {
	var reqs []model.AccessRequest
	q := r.db.Preload("User").Preload("Server")
	if status != "" {
		q = q.Where("status = ?", status)
	}
	if err := q.Order("created_at DESC").Find(&reqs).Error; err != nil {
		return nil, err
	}
	return reqs, nil
}

func (r *AccessRepository) UpdateRequest(req *model.AccessRequest) error {
	return r.db.Save(req).Error
}

func (r *AccessRepository) CreateGrant(grant *model.AccessGrant) error {
	return r.db.Create(grant).Error
}

func (r *AccessRepository) HasActiveGrant(userID, serverID uint) bool {
	var count int64
	r.db.Model(&model.AccessGrant{}).
		Where("user_id = ? AND server_id = ? AND expires_at > ?", userID, serverID, time.Now()).
		Count(&count)
	return count > 0
}

func (r *AccessRepository) ListUserGrants(userID uint) ([]model.AccessGrant, error) {
	var grants []model.AccessGrant
	if err := r.db.Preload("Server").Where("user_id = ? AND expires_at > ?", userID, time.Now()).Find(&grants).Error; err != nil {
		return nil, err
	}
	return grants, nil
}

func (r *AccessRepository) CleanupExpired() {
	r.db.Where("expires_at <= ?", time.Now()).Delete(&model.AccessGrant{})
	r.db.Where("status = ? AND expires_at <= ?", "pending", time.Now()).
		Model(&model.AccessRequest{}).Update("status", "expired")
}

func (r *AccessRepository) FindGrantByID(id uint) (*model.AccessGrant, error) {
	var grant model.AccessGrant
	if err := r.db.Preload("User").Preload("Server").First(&grant, id).Error; err != nil {
		return nil, err
	}
	return &grant, nil
}
