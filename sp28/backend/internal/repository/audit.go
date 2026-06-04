package repository

import (
	"ssh-web-terminal/internal/model"
	"time"

	"gorm.io/gorm"
)

type BlacklistRepository struct {
	db *gorm.DB
}

func NewBlacklistRepository(db *gorm.DB) *BlacklistRepository {
	return &BlacklistRepository{db: db}
}

func (r *BlacklistRepository) FindAll() ([]model.CommandBlacklist, error) {
	var rules []model.CommandBlacklist
	err := r.db.Find(&rules).Error
	return rules, err
}

func (r *BlacklistRepository) FindAllEnabled() ([]model.CommandBlacklist, error) {
	var rules []model.CommandBlacklist
	err := r.db.Where("enabled = ?", true).Find(&rules).Error
	return rules, err
}

func (r *BlacklistRepository) FindByID(id uint) (*model.CommandBlacklist, error) {
	var rule model.CommandBlacklist
	err := r.db.First(&rule, id).Error
	if err != nil {
		return nil, err
	}
	return &rule, nil
}

func (r *BlacklistRepository) Create(rule *model.CommandBlacklist) error {
	return r.db.Create(rule).Error
}

func (r *BlacklistRepository) Update(rule *model.CommandBlacklist) error {
	return r.db.Save(rule).Error
}

func (r *BlacklistRepository) Delete(id uint) error {
	return r.db.Delete(&model.CommandBlacklist{}, id).Error
}

type CommandLogRepository struct {
	db *gorm.DB
}

func NewCommandLogRepository(db *gorm.DB) *CommandLogRepository {
	return &CommandLogRepository{db: db}
}

func (r *CommandLogRepository) DB() *gorm.DB {
	return r.db
}

func (r *CommandLogRepository) Create(log *model.CommandLog) error {
	return r.db.Create(log).Error
}

func (r *CommandLogRepository) FindBySession(sessionID uint) ([]model.CommandLog, error) {
	var logs []model.CommandLog
	err := r.db.Where("session_id = ?", sessionID).Order("executed_at DESC").Find(&logs).Error
	return logs, err
}

func (r *CommandLogRepository) FindByUser(userID uint, limit int) ([]model.CommandLog, error) {
	var logs []model.CommandLog
	err := r.db.Where("user_id = ?", userID).Order("executed_at DESC").Limit(limit).Find(&logs).Error
	return logs, err
}

func (r *CommandLogRepository) FindByServer(serverID uint, limit int) ([]model.CommandLog, error) {
	var logs []model.CommandLog
	err := r.db.Where("server_id = ?", serverID).Order("executed_at DESC").Limit(limit).Find(&logs).Error
	return logs, err
}

type JumpHostRepository struct {
	db *gorm.DB
}

func NewJumpHostRepository(db *gorm.DB) *JumpHostRepository {
	return &JumpHostRepository{db: db}
}

func (r *JumpHostRepository) FindAll() ([]model.JumpHost, error) {
	var hosts []model.JumpHost
	err := r.db.Find(&hosts).Error
	return hosts, err
}

func (r *JumpHostRepository) FindByID(id uint) (*model.JumpHost, error) {
	var host model.JumpHost
	err := r.db.First(&host, id).Error
	if err != nil {
		return nil, err
	}
	return &host, nil
}

func (r *JumpHostRepository) Create(host *model.JumpHost) error {
	return r.db.Create(host).Error
}

func (r *JumpHostRepository) Update(host *model.JumpHost) error {
	return r.db.Save(host).Error
}

func (r *JumpHostRepository) Delete(id uint) error {
	return r.db.Delete(&model.JumpHost{}, id).Error
}

type AuditStats struct {
	UserID          uint      `json:"user_id,omitempty"`
	ServerID        uint      `json:"server_id,omitempty"`
	Username        string    `json:"username,omitempty"`
	ServerName      string    `json:"server_name,omitempty"`
	TotalSessions   int64     `json:"total_sessions"`
	TotalDuration   float64   `json:"total_duration_seconds"`
	TotalCommands   int64     `json:"total_commands"`
	BlockedCommands int64     `json:"blocked_commands"`
	Date            time.Time `json:"date,omitempty"`
}

type AuditRepository struct {
	db *gorm.DB
}

func NewAuditRepository(db *gorm.DB) *AuditRepository {
	return &AuditRepository{db: db}
}

func (r *AuditRepository) GetStatsByUser(start, end time.Time) ([]AuditStats, error) {
	var results []AuditStats
	err := r.db.Table("command_logs").
		Select(`
			user_id,
			COUNT(DISTINCT session_id) as total_sessions,
			COUNT(*) as total_commands,
			SUM(CASE WHEN blocked = true THEN 1 ELSE 0 END) as blocked_commands
		`).
		Where("executed_at BETWEEN ? AND ?", start, end).
		Group("user_id").
		Scan(&results).Error

	for i := range results {
		var user model.User
		r.db.First(&user, results[i].UserID)
		results[i].Username = user.Username
	}

	return results, err
}

func (r *AuditRepository) GetStatsByServer(start, end time.Time) ([]AuditStats, error) {
	var results []AuditStats
	err := r.db.Table("command_logs").
		Select(`
			server_id,
			COUNT(DISTINCT session_id) as total_sessions,
			COUNT(*) as total_commands,
			SUM(CASE WHEN blocked = true THEN 1 ELSE 0 END) as blocked_commands
		`).
		Where("executed_at BETWEEN ? AND ?", start, end).
		Group("server_id").
		Scan(&results).Error

	for i := range results {
		var server model.Server
		r.db.First(&server, results[i].ServerID)
		results[i].ServerName = server.Name
	}

	return results, err
}

func (r *AuditRepository) GetStatsByDate(start, end time.Time) ([]AuditStats, error) {
	var results []AuditStats
	err := r.db.Table("command_logs").
		Select(`
			DATE(executed_at) as date,
			COUNT(DISTINCT session_id) as total_sessions,
			COUNT(*) as total_commands,
			SUM(CASE WHEN blocked = true THEN 1 ELSE 0 END) as blocked_commands
		`).
		Where("executed_at BETWEEN ? AND ?", start, end).
		Group("DATE(executed_at)").
		Order("date DESC").
		Scan(&results).Error

	return results, err
}
