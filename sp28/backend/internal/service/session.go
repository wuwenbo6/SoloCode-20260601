package service

import (
	"ssh-web-terminal/internal/model"
	"ssh-web-terminal/internal/repository"
)

type SessionService struct {
	sessionRepo *repository.SessionRepository
}

func NewSessionService(sessionRepo *repository.SessionRepository) *SessionService {
	return &SessionService{sessionRepo: sessionRepo}
}

func (s *SessionService) Create(session *model.Session) error {
	return s.sessionRepo.Create(session)
}

func (s *SessionService) GetByID(id uint) (*model.Session, error) {
	return s.sessionRepo.FindByID(id)
}

func (s *SessionService) Update(session *model.Session) error {
	return s.sessionRepo.Update(session)
}

func (s *SessionService) ListActive() ([]model.Session, error) {
	return s.sessionRepo.ListActive()
}

func (s *SessionService) ListByUser(userID uint) ([]model.Session, error) {
	return s.sessionRepo.ListByUser(userID)
}

func (s *SessionService) List() ([]model.Session, error) {
	return s.sessionRepo.List()
}

func (s *SessionService) EndSession(session *model.Session) error {
	session.Status = "ended"
	return s.sessionRepo.Update(session)
}
