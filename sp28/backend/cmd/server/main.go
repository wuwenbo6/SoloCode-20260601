package main

import (
	"log"
	"os"
	"time"

	"ssh-web-terminal/internal/config"
	"ssh-web-terminal/internal/handler"
	"ssh-web-terminal/internal/middleware"
	"ssh-web-terminal/internal/model"
	"ssh-web-terminal/internal/repository"
	"ssh-web-terminal/internal/service"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func main() {
	cfg := config.Load()

	if err := os.MkdirAll("data", 0755); err != nil {
		log.Fatalf("failed to create data dir: %v", err)
	}

	db, err := gorm.Open(sqlite.Open(cfg.Database.DSN), &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}

	if err := db.AutoMigrate(
		&model.User{},
		&model.Server{},
		&model.AccessRequest{},
		&model.AccessGrant{},
		&model.Session{},
		&model.CommandBlacklist{},
		&model.CommandLog{},
		&model.JumpHost{},
	); err != nil {
		log.Fatalf("failed to migrate database: %v", err)
	}

	initDefaultData(db)

	minioSvc, err := service.NewMinIOService(&cfg.MinIO)
	if err != nil {
		log.Printf("MinIO init failed (will continue without recording): %v", err)
	} else {
		if err := minioSvc.EnsureBucket(); err != nil {
			log.Printf("MinIO bucket creation failed: %v", err)
		}
	}

	userRepo := repository.NewUserRepository(db)
	serverRepo := repository.NewServerRepository(db)
	accessRepo := repository.NewAccessRepository(db)
	sessionRepo := repository.NewSessionRepository(db)
	blacklistRepo := repository.NewBlacklistRepository(db)
	jumpHostRepo := repository.NewJumpHostRepository(db)
	commandLogRepo := repository.NewCommandLogRepository(db)
	auditRepo := repository.NewAuditRepository(db)

	userSvc := service.NewUserService(userRepo, cfg.JWT.Secret, cfg.JWT.Expiry)
	serverSvc := service.NewServerService(serverRepo)
	accessSvc := service.NewAccessService(accessRepo)
	sessionSvc := service.NewSessionService(sessionRepo)
	playbackSvc := service.NewPlaybackService(minioSvc)
	interceptor := service.NewCommandInterceptor(blacklistRepo)
	auditSvc := service.NewAuditService(auditRepo, commandLogRepo)
	sshManager := service.NewSSHManager(serverRepo, sessionSvc, minioSvc, accessSvc, interceptor, commandLogRepo, cfg)

	userHandler := handler.NewUserHandler(userSvc)
	serverHandler := handler.NewServerHandler(serverSvc)
	accessHandler := handler.NewAccessHandler(accessSvc)
	sshHandler := handler.NewSSHHandler(sshManager, sessionSvc, accessSvc)
	sessionHandler := handler.NewSessionHandler(sessionSvc)
	playbackHandler := handler.NewPlaybackHandler(playbackSvc, sessionSvc, minioSvc)
	blacklistHandler := handler.NewBlacklistHandler(interceptor, blacklistRepo)
	jumpHostHandler := handler.NewJumpHostHandler(jumpHostRepo)
	auditHandler := handler.NewAuditHandler(auditSvc)

	go middleware.PeriodicCleanup(1*time.Hour, func() {
		accessSvc.CleanupExpired()
	})

	r := gin.Default()

	r.Use(middleware.CORS())

	api := r.Group("/api")
	{
		auth := api.Group("/auth")
		{
			auth.POST("/register", userHandler.Register)
			auth.POST("/login", userHandler.Login)
			auth.GET("/me", middleware.JWTAuth(cfg.JWT.Secret), userHandler.GetCurrentUser)
			auth.GET("/users", middleware.JWTAuth(cfg.JWT.Secret), middleware.RequireAdmin(), userHandler.ListUsers)
		}

		servers := api.Group("/servers")
		servers.Use(middleware.JWTAuth(cfg.JWT.Secret))
		{
			servers.GET("", serverHandler.List)
			servers.GET("/:id", serverHandler.Get)
			servers.POST("", middleware.RequireAdmin(), serverHandler.Create)
			servers.PUT("/:id", middleware.RequireAdmin(), serverHandler.Update)
			servers.DELETE("/:id", middleware.RequireAdmin(), serverHandler.Delete)
		}

		access := api.Group("/access")
		access.Use(middleware.JWTAuth(cfg.JWT.Secret))
		{
			access.POST("/request", accessHandler.RequestAccess)
			access.GET("/grants/me", accessHandler.ListMyGrants)
			access.GET("/requests", accessHandler.ListRequests)
			access.POST("/requests/:id/approve", middleware.RequireAdmin(), accessHandler.ApproveRequest)
			access.POST("/requests/:id/reject", middleware.RequireAdmin(), accessHandler.RejectRequest)
		}

		ssh := api.Group("/ssh")
		ssh.Use(middleware.JWTAuth(cfg.JWT.Secret))
		{
			ssh.GET("/connect", sshHandler.Connect)
			ssh.GET("/active", sshHandler.GetActiveSessions)
			ssh.GET("/broadcast/:id", sshHandler.Broadcast)
		}

		sessions := api.Group("/sessions")
		sessions.Use(middleware.JWTAuth(cfg.JWT.Secret))
		{
			sessions.GET("", sessionHandler.List)
			sessions.GET("/me", sessionHandler.ListMy)
			sessions.GET("/:id", sessionHandler.Get)
		}

		playback := api.Group("/playback")
		playback.Use(middleware.JWTAuth(cfg.JWT.Secret))
		{
			playback.GET("", playbackHandler.ListRecordings)
			playback.GET("/:id", playbackHandler.GetFrames)
			playback.GET("/:id/speed", playbackHandler.GetFramesForSpeed)
			playback.GET("/:id/info", playbackHandler.GetInfo)
		}

		blacklist := api.Group("/blacklist")
		blacklist.Use(middleware.JWTAuth(cfg.JWT.Secret), middleware.RequireAdmin())
		{
			blacklist.GET("", blacklistHandler.GetRules)
			blacklist.GET("/:id", blacklistHandler.GetRule)
			blacklist.POST("", blacklistHandler.CreateRule)
			blacklist.PUT("/:id", blacklistHandler.UpdateRule)
			blacklist.DELETE("/:id", blacklistHandler.DeleteRule)
			blacklist.POST("/refresh", blacklistHandler.RefreshPatterns)
		}

		jumpHosts := api.Group("/jump-hosts")
		jumpHosts.Use(middleware.JWTAuth(cfg.JWT.Secret), middleware.RequireAdmin())
		{
			jumpHosts.GET("", jumpHostHandler.GetAll)
			jumpHosts.GET("/:id", jumpHostHandler.GetByID)
			jumpHosts.POST("", jumpHostHandler.Create)
			jumpHosts.PUT("/:id", jumpHostHandler.Update)
			jumpHosts.DELETE("/:id", jumpHostHandler.Delete)
		}

		audit := api.Group("/audit")
		audit.Use(middleware.JWTAuth(cfg.JWT.Secret))
		{
			audit.GET("/stats/users", auditHandler.GetUserStats)
			audit.GET("/stats/servers", auditHandler.GetServerStats)
			audit.GET("/stats/daily", auditHandler.GetDailyStats)
			audit.GET("/blocked", auditHandler.GetBlockedCommands)
			audit.GET("/users/:id/commands", auditHandler.GetCommandLogsByUser)
			audit.GET("/sessions/:id/commands", auditHandler.GetCommandLogsBySession)
			audit.GET("/report", auditHandler.GenerateReport)
		}
	}

	log.Printf("Server starting on port %s", cfg.Server.Port)
	if err := r.Run(":" + cfg.Server.Port); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
}

func initDefaultData(db *gorm.DB) {
	var userCount int64
	db.Model(&model.User{}).Count(&userCount)
	if userCount == 0 {
		adminPwd, _ := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
		userPwd, _ := bcrypt.GenerateFromPassword([]byte("user123"), bcrypt.DefaultCost)

		admin := model.User{Username: "admin", Password: string(adminPwd), Role: "admin"}
		user := model.User{Username: "user", Password: string(userPwd), Role: "user"}
		db.Create(&admin)
		db.Create(&user)
	}

	var serverCount int64
	db.Model(&model.Server{}).Count(&serverCount)
	if serverCount == 0 {
		server := model.Server{
			Name:     "SSH Demo Server",
			Host:     "localhost",
			Port:     22,
			Username: "root",
			Password: "root",
			Tags:     "demo,internal",
		}
		db.Create(&server)
	}

	var blacklistCount int64
	db.Model(&model.CommandBlacklist{}).Count(&blacklistCount)
	if blacklistCount == 0 {
		defaultRules := []model.CommandBlacklist{
			{
				Pattern:     `rm\s+-rf\s+/`,
				Description: "Dangerous recursive delete on root",
				Severity:    "critical",
				Enabled:     true,
				Block:       true,
			},
			{
				Pattern:     `mkfs\s+`,
				Description: "Filesystem format command",
				Severity:    "critical",
				Enabled:     true,
				Block:       true,
			},
			{
				Pattern:     `dd\s+if=/dev/(zero|urandom)`,
				Description: "Disk overwriting command",
				Severity:    "critical",
				Enabled:     true,
				Block:       true,
			},
			{
				Pattern:     `>\s*/dev/sd[a-z]`,
				Description: "Direct disk write",
				Severity:    "critical",
				Enabled:     true,
				Block:       true,
			},
			{
				Pattern:     `chmod\s+-R\s+777\s+/`,
				Description: "Dangerous permission change on root",
				Severity:    "high",
				Enabled:     true,
				Block:       true,
			},
			{
				Pattern:     `sudo\s+su\s+`,
				Description: "Privilege escalation attempt",
				Severity:    "warning",
				Enabled:     true,
				Block:       false,
			},
			{
				Pattern:     `wget\s+http.*\.sh.*\|\s*bash`,
				Description: "Remote script execution",
				Severity:    "high",
				Enabled:     true,
				Block:       true,
			},
			{
				Pattern:     `curl\s+.*\.sh.*\|\s*bash`,
				Description: "Remote script execution",
				Severity:    "high",
				Enabled:     true,
				Block:       true,
			},
		}
		for _, rule := range defaultRules {
			db.Create(&rule)
		}
	}
}
