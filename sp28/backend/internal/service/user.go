package service

import (
	"errors"

	"ssh-web-terminal/internal/middleware"
	"ssh-web-terminal/internal/model"
	"ssh-web-terminal/internal/repository"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type UserService struct {
	userRepo  *repository.UserRepository
	jwtSecret string
	jwtExpiry int
}

func NewUserService(userRepo *repository.UserRepository, jwtSecret string, jwtExpiry int) *UserService {
	return &UserService{
		userRepo:  userRepo,
		jwtSecret: jwtSecret,
		jwtExpiry: jwtExpiry,
	}
}

func (s *UserService) Register(username, password string) (*model.User, error) {
	existing, err := s.userRepo.FindByUsername(username)
	if err == nil && existing != nil {
		return nil, errors.New("username already exists")
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	user := &model.User{
		Username: username,
		Password: string(hashed),
		Role:     "user",
	}

	if err := s.userRepo.Create(user); err != nil {
		return nil, err
	}

	return user, nil
}

func (s *UserService) Login(username, password string) (*model.LoginResponse, error) {
	user, err := s.userRepo.FindByUsername(username)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("invalid credentials")
		}
		return nil, err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password)); err != nil {
		return nil, errors.New("invalid credentials")
	}

	token, err := middleware.GenerateToken(s.jwtSecret, user, s.jwtExpiry)
	if err != nil {
		return nil, err
	}

	return &model.LoginResponse{
		Token: token,
		User:  *user,
	}, nil
}

func (s *UserService) GetUserByID(id uint) (*model.User, error) {
	return s.userRepo.FindByID(id)
}

func (s *UserService) ListUsers() ([]model.User, error) {
	return s.userRepo.List()
}
