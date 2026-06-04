package service

import (
	"time"

	"ssh-web-terminal/internal/model"
	"ssh-web-terminal/internal/repository"
)

type AuditService struct {
	auditRepo      *repository.AuditRepository
	commandLogRepo *repository.CommandLogRepository
}

func NewAuditService(auditRepo *repository.AuditRepository, commandLogRepo *repository.CommandLogRepository) *AuditService {
	return &AuditService{
		auditRepo:      auditRepo,
		commandLogRepo: commandLogRepo,
	}
}

func (s *AuditService) GetUserStats(days int) ([]repository.AuditStats, error) {
	start := time.Now().AddDate(0, 0, -days)
	end := time.Now()
	return s.auditRepo.GetStatsByUser(start, end)
}

func (s *AuditService) GetServerStats(days int) ([]repository.AuditStats, error) {
	start := time.Now().AddDate(0, 0, -days)
	end := time.Now()
	return s.auditRepo.GetStatsByServer(start, end)
}

func (s *AuditService) GetDailyStats(days int) ([]repository.AuditStats, error) {
	start := time.Now().AddDate(0, 0, -days)
	end := time.Now()
	return s.auditRepo.GetStatsByDate(start, end)
}

func (s *AuditService) GetBlockedCommands(limit int) ([]model.CommandLog, error) {
	var logs []model.CommandLog
	err := s.commandLogRepo.DB().
		Where("blocked = ?", true).
		Preload("User").
		Preload("Server").
		Preload("Rule").
		Order("executed_at DESC").
		Limit(limit).
		Find(&logs).Error
	return logs, err
}

func (s *AuditService) GetCommandLogsByUser(userID uint, limit int) ([]model.CommandLog, error) {
	var logs []model.CommandLog
	err := s.commandLogRepo.DB().
		Where("user_id = ?", userID).
		Preload("Server").
		Preload("Rule").
		Order("executed_at DESC").
		Limit(limit).
		Find(&logs).Error
	return logs, err
}

func (s *AuditService) GetCommandLogsBySession(sessionID uint) ([]model.CommandLog, error) {
	var logs []model.CommandLog
	err := s.commandLogRepo.DB().
		Where("session_id = ?", sessionID).
		Preload("User").
		Preload("Rule").
		Order("executed_at ASC").
		Find(&logs).Error
	return logs, err
}

type AuditReport struct {
	Period          string                  `json:"period"`
	GeneratedAt     time.Time               `json:"generated_at"`
	TotalSessions   int64                   `json:"total_sessions"`
	TotalCommands   int64                   `json:"total_commands"`
	BlockedCommands int64                   `json:"blocked_commands"`
	UserStats       []repository.AuditStats `json:"user_stats"`
	ServerStats     []repository.AuditStats `json:"server_stats"`
	DailyStats      []repository.AuditStats `json:"daily_stats"`
}

func (s *AuditService) GenerateReport(days int) (*AuditReport, error) {
	userStats, err := s.GetUserStats(days)
	if err != nil {
		return nil, err
	}

	serverStats, err := s.GetServerStats(days)
	if err != nil {
		return nil, err
	}

	dailyStats, err := s.GetDailyStats(days)
	if err != nil {
		return nil, err
	}

	var totalSessions, totalCommands, blockedCommands int64
	for _, stat := range userStats {
		totalSessions += stat.TotalSessions
		totalCommands += stat.TotalCommands
		blockedCommands += stat.BlockedCommands
	}

	return &AuditReport{
		Period:          "Last " + itoa(uint64(days)) + " days",
		GeneratedAt:     time.Now(),
		TotalSessions:   totalSessions,
		TotalCommands:   totalCommands,
		BlockedCommands: blockedCommands,
		UserStats:       userStats,
		ServerStats:     serverStats,
		DailyStats:      dailyStats,
	}, nil
}
