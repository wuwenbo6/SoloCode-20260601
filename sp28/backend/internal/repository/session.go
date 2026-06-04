package repository

import (
	"ssh-web-terminal/internal/model"

	"gorm.io/gorm"
)

type SessionRepository struct {
	db *gorm.DB
}

func NewSessionRepository(db *gorm.DB) *SessionRepository {
	return &SessionRepository{db: db}
}

func (r *SessionRepository) Create(session *model.Session) error {
	return r.db.Create(session).Error
}

func (r *SessionRepository) FindByID(id uint) (*model.Session, error) {
	var session model.Session
	if err := r.db.Preload("User").Preload("Server").First(&session, id).Error; err != nil {
		return nil, err
	}
	return &session, nil
}

func (r *SessionRepository) Update(session *model.Session) error {
	return r.db.Save(session).Error
}

func (r *SessionRepository) ListActive() ([]model.Session, error) {
	var sessions []model.Session
	if err := r.db.Preload("User").Preload("Server").Where("status = ?", "active").Find(&sessions).Error; err != nil {
		return nil, err
	}
	return sessions, nil
}

func (r *SessionRepository) ListByUser(userID uint) ([]model.Session, error) {
	var sessions []model.Session
	if err := r.db.Preload("User").Preload("Server").Where("user_id = ?", userID).Order("start_time DESC").Find(&sessions).Error; err != nil {
		return nil, err
	}
	return sessions, nil
}

func (r *SessionRepository) List() ([]model.Session, error) {
	var sessions []model.Session
	if err := r.db.Preload("User").Preload("Server").Order("start_time DESC").Find(&sessions).Error; err != nil {
		return nil, err
	}
	return sessions, nil
}

func (r *SessionRepository) FindActiveByServer(serverID uint) ([]model.Session, error) {
	var sessions []model.Session
	if err := r.db.Where("server_id = ? AND status = ?", serverID, "active").Find(&sessions).Error; err != nil {
		return nil, err
	}
	return sessions, nil
}
