package repository

import (
	"ssh-web-terminal/internal/model"

	"gorm.io/gorm"
)

type ServerRepository struct {
	db *gorm.DB
}

func NewServerRepository(db *gorm.DB) *ServerRepository {
	return &ServerRepository{db: db}
}

func (r *ServerRepository) Create(server *model.Server) error {
	return r.db.Create(server).Error
}

func (r *ServerRepository) FindByID(id uint) (*model.Server, error) {
	var server model.Server
	if err := r.db.First(&server, id).Error; err != nil {
		return nil, err
	}
	return &server, nil
}

func (r *ServerRepository) FindByIDWithJumpHost(id uint) (*model.Server, error) {
	var server model.Server
	if err := r.db.Preload("JumpHost").First(&server, id).Error; err != nil {
		return nil, err
	}
	return &server, nil
}

func (r *ServerRepository) List() ([]model.Server, error) {
	var servers []model.Server
	if err := r.db.Find(&servers).Error; err != nil {
		return nil, err
	}
	return servers, nil
}

func (r *ServerRepository) Update(server *model.Server) error {
	return r.db.Save(server).Error
}

func (r *ServerRepository) Delete(id uint) error {
	return r.db.Delete(&model.Server{}, id).Error
}
