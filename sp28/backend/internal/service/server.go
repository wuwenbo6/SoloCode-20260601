package service

import (
	"ssh-web-terminal/internal/model"
	"ssh-web-terminal/internal/repository"
)

type ServerService struct {
	serverRepo *repository.ServerRepository
}

func NewServerService(serverRepo *repository.ServerRepository) *ServerService {
	return &ServerService{serverRepo: serverRepo}
}

func (s *ServerService) Create(server *model.Server) error {
	return s.serverRepo.Create(server)
}

func (s *ServerService) GetByID(id uint) (*model.Server, error) {
	return s.serverRepo.FindByID(id)
}

func (s *ServerService) List() ([]model.Server, error) {
	return s.serverRepo.List()
}

func (s *ServerService) Update(server *model.Server) error {
	return s.serverRepo.Update(server)
}

func (s *ServerService) Delete(id uint) error {
	return s.serverRepo.Delete(id)
}
