package service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sync"
	"time"

	"ssh-web-terminal/internal/config"
	"ssh-web-terminal/internal/model"
	"ssh-web-terminal/internal/recorder"
	"ssh-web-terminal/internal/repository"

	"github.com/gorilla/websocket"
	"golang.org/x/crypto/ssh"
)

type Viewer struct {
	Conn     *websocket.Conn
	Mu       sync.Mutex
	Send     chan []byte
	Username string
}

type SSHSession struct {
	ID              uint
	Session         *ssh.Session
	Client          *ssh.Client
	OwnerConn       *websocket.Conn
	OwnerMu         sync.Mutex
	Viewers         map[*Viewer]bool
	ViewersMu       sync.RWMutex
	Recorder        *recorder.TtyRecWriter
	RecBuffer       *bytes.Buffer
	RecMu           sync.Mutex
	SessionModel    *model.Session
	SessionSvc      *SessionService
	MinIOSvc        *MinIOService
	Active          bool
	CloseCh         chan struct{}
	CloseOnce       sync.Once
	CharsetDetector *CharsetDetector
	ResizeMu        sync.Mutex
	LastResize      time.Time
	PendingResize   *struct{ Cols, Rows int }
	CommandSession  *CommandSession
}

type SSHManager struct {
	sessions       map[uint]*SSHSession
	mu             sync.RWMutex
	serverRepo     *repository.ServerRepository
	sessionSvc     *SessionService
	minioSvc       *MinIOService
	accessSvc      *AccessService
	cfg            *config.Config
	upgrader       websocket.Upgrader
	interceptor    *CommandInterceptor
	commandLogRepo *repository.CommandLogRepository
}

func NewSSHManager(
	serverRepo *repository.ServerRepository,
	sessionSvc *SessionService,
	minioSvc *MinIOService,
	accessSvc *AccessService,
	interceptor *CommandInterceptor,
	commandLogRepo *repository.CommandLogRepository,
	cfg *config.Config,
) *SSHManager {
	return &SSHManager{
		sessions:       make(map[uint]*SSHSession),
		serverRepo:     serverRepo,
		sessionSvc:     sessionSvc,
		minioSvc:       minioSvc,
		accessSvc:      accessSvc,
		interceptor:    interceptor,
		commandLogRepo: commandLogRepo,
		cfg:            cfg,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool { return true },
		},
	}
}

func (m *SSHManager) Connect(serverID, userID uint, username string, w http.ResponseWriter, r *http.Request) error {
	server, err := m.serverRepo.FindByIDWithJumpHost(serverID)
	if err != nil {
		return fmt.Errorf("server not found: %w", err)
	}

	if !m.accessSvc.HasAccess(userID, serverID) {
		return fmt.Errorf("no active access grant for this server")
	}

	var client *ssh.Client

	if server.JumpHostID != nil && server.JumpHost != nil {
		client, err = m.dialThroughJumpHost(server.JumpHost, server)
	} else {
		client, err = m.dialDirect(server)
	}

	if err != nil {
		return fmt.Errorf("SSH dial failed: %w", err)
	}

	session, err := client.NewSession()
	if err != nil {
		client.Close()
		return fmt.Errorf("SSH session failed: %w", err)
	}

	stdinPipe, err := session.StdinPipe()
	if err != nil {
		session.Close()
		client.Close()
		return fmt.Errorf("stdin pipe failed: %w", err)
	}

	stdoutPipe, err := session.StdoutPipe()
	if err != nil {
		session.Close()
		client.Close()
		return fmt.Errorf("stdout pipe failed: %w", err)
	}

	stderrPipe, err := session.StderrPipe()
	if err != nil {
		session.Close()
		client.Close()
		return fmt.Errorf("stderr pipe failed: %w", err)
	}

	modes := ssh.TerminalModes{
		ssh.ECHO:          1,
		ssh.TTY_OP_ISPEED: 14400,
		ssh.TTY_OP_OSPEED: 14400,
	}

	if err := session.RequestPty("xterm-256color", 24, 80, modes); err != nil {
		session.Close()
		client.Close()
		return fmt.Errorf("pty request failed: %w", err)
	}

	envs := []string{
		"LANG=zh_CN.UTF-8",
		"LC_ALL=zh_CN.UTF-8",
		"LC_CTYPE=UTF-8",
		"TERM=xterm-256color",
	}
	for _, env := range envs {
		parts := splitEnv(env)
		if len(parts) == 2 {
			session.Setenv(parts[0], parts[1])
		}
	}

	if err := session.Shell(); err != nil {
		session.Close()
		client.Close()
		return fmt.Errorf("shell start failed: %w", err)
	}

	wsConn, err := m.upgrader.Upgrade(w, r, nil)
	if err != nil {
		session.Close()
		client.Close()
		return fmt.Errorf("websocket upgrade failed: %w", err)
	}

	sessionModel := &model.Session{
		UserID:    userID,
		ServerID:  serverID,
		StartTime: time.Now(),
		Status:    "active",
	}
	if err := m.sessionSvc.Create(sessionModel); err != nil {
		wsConn.Close()
		session.Close()
		client.Close()
		return fmt.Errorf("session record failed: %w", err)
	}

	sshSess := &SSHSession{
		ID:              sessionModel.ID,
		Session:         session,
		Client:          client,
		OwnerConn:       wsConn,
		Viewers:         make(map[*Viewer]bool),
		Recorder:        recorder.NewTtyRecWriter(),
		RecBuffer:       &bytes.Buffer{},
		SessionModel:    sessionModel,
		SessionSvc:      m.sessionSvc,
		MinIOSvc:        m.minioSvc,
		Active:          true,
		CloseCh:         make(chan struct{}),
		CharsetDetector: NewCharsetDetector(),
		CommandSession:  NewCommandSession(sessionModel.ID, userID, serverID, m.commandLogRepo, m.interceptor),
	}

	m.mu.Lock()
	m.sessions[sessionModel.ID] = sshSess
	m.mu.Unlock()

	go m.readSSHOutput(sshSess, stdoutPipe)
	go m.readSSHOutput(sshSess, stderrPipe)
	go m.readOwnerInput(sshSess, stdinPipe)

	return nil
}

func (m *SSHManager) readSSHOutput(sshSess *SSHSession, reader io.Reader) {
	buf := make([]byte, 8192)
	for {
		select {
		case <-sshSess.CloseCh:
			return
		default:
		}

		n, err := reader.Read(buf)
		if err != nil {
			if err != io.EOF {
				log.Printf("SSH read error: %v", err)
			}
			m.closeSession(sshSess)
			return
		}

		if n > 0 {
			data := make([]byte, n)
			copy(data, buf[:n])

			converted := sshSess.CharsetDetector.DetectAndConvert(data)

			sshSess.RecMu.Lock()
			sshSess.Recorder.WriteFrame(sshSess.RecBuffer, converted)
			sshSess.RecMu.Unlock()

			sshSess.OwnerMu.Lock()
			if sshSess.OwnerConn != nil {
				msgBytes, _ := json.Marshal(model.WSMessage{Type: model.MsgTypeStdout, Data: string(converted)})
				sshSess.OwnerConn.WriteMessage(websocket.TextMessage, msgBytes)
			}
			sshSess.OwnerMu.Unlock()

			sshSess.ViewersMu.RLock()
			for viewer := range sshSess.Viewers {
				select {
				case viewer.Send <- converted:
				default:
				}
			}
			sshSess.ViewersMu.RUnlock()
		}
	}
}

func (m *SSHManager) readOwnerInput(sshSess *SSHSession, stdinPipe io.Writer) {
	go m.processPendingResize(sshSess)

	for {
		_, msg, err := sshSess.OwnerConn.ReadMessage()
		if err != nil {
			m.closeSession(sshSess)
			return
		}

		var wsMsg model.WSMessage
		if err := json.Unmarshal(msg, &wsMsg); err == nil {
			switch wsMsg.Type {
			case model.MsgTypeStdin:
				if stdinPipe != nil {
					dataToSend, blocked := sshSess.CommandSession.ProcessStdin([]byte(wsMsg.Data))
					if blocked {
						sshSess.OwnerMu.Lock()
						if sshSess.OwnerConn != nil {
							sshSess.OwnerConn.WriteMessage(websocket.TextMessage, dataToSend)
						}
						sshSess.OwnerMu.Unlock()
					} else {
						stdinPipe.Write(dataToSend)
					}
				}
			case model.MsgTypeResize:
				cols, rows := parseResize(wsMsg.Data)
				if cols > 0 && rows > 0 {
					m.handleResize(sshSess, cols, rows)
				}
			case model.MsgTypeClose:
				m.closeSession(sshSess)
				return
			case model.MsgTypePing:
				sshSess.OwnerMu.Lock()
				if sshSess.OwnerConn != nil {
					pingMsg, _ := json.Marshal(model.WSMessage{Type: model.MsgTypePong})
					sshSess.OwnerConn.WriteMessage(websocket.TextMessage, pingMsg)
				}
				sshSess.OwnerMu.Unlock()
			}
		}
	}
}

func (m *SSHManager) handleResize(sshSess *SSHSession, cols, rows int) {
	sshSess.ResizeMu.Lock()
	defer sshSess.ResizeMu.Unlock()

	now := time.Now()
	if now.Sub(sshSess.LastResize) < 50*time.Millisecond {
		sshSess.PendingResize = &struct{ Cols, Rows int }{cols, rows}
		return
	}

	sshSess.LastResize = now
	sshSess.PendingResize = nil

	if !sshSess.Active || sshSess.Session == nil {
		return
	}

	if err := sshSess.Session.WindowChange(rows, cols); err != nil {
		log.Printf("Resize failed: %v", err)
	}
}

func (m *SSHManager) processPendingResize(sshSess *SSHSession) {
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-sshSess.CloseCh:
			return
		case <-ticker.C:
			sshSess.ResizeMu.Lock()
			pending := sshSess.PendingResize
			sshSess.PendingResize = nil
			sshSess.ResizeMu.Unlock()

			if pending != nil && sshSess.Active && sshSess.Session != nil {
				if err := sshSess.Session.WindowChange(pending.Rows, pending.Cols); err != nil {
					log.Printf("Pending resize failed: %v", err)
				}
				sshSess.ResizeMu.Lock()
				sshSess.LastResize = time.Now()
				sshSess.ResizeMu.Unlock()
			}
		}
	}
}

func (m *SSHManager) closeSession(sshSess *SSHSession) {
	sshSess.CloseOnce.Do(func() {
		sshSess.Active = false
		close(sshSess.CloseCh)

		now := time.Now()
		sshSess.SessionModel.EndTime = &now
		sshSess.SessionModel.Status = "ended"

		sshSess.RecMu.Lock()
		recData := make([]byte, sshSess.RecBuffer.Len())
		copy(recData, sshSess.RecBuffer.Bytes())
		sshSess.RecMu.Unlock()

		if len(recData) > 0 {
			objectKey := fmt.Sprintf("recordings/%d.ttyrec", sshSess.ID)
			if err := sshSess.MinIOSvc.Upload(objectKey, recData); err != nil {
				log.Printf("Failed to upload recording: %v", err)
			} else {
				sshSess.SessionModel.RecordingPath = objectKey
			}
		}

		sshSess.SessionSvc.Update(sshSess.SessionModel)

		sshSess.ViewersMu.Lock()
		for viewer := range sshSess.Viewers {
			close(viewer.Send)
			viewer.Conn.Close()
		}
		sshSess.Viewers = make(map[*Viewer]bool)
		sshSess.ViewersMu.Unlock()

		sshSess.OwnerMu.Lock()
		if sshSess.OwnerConn != nil {
			sshSess.OwnerConn.WriteMessage(websocket.CloseMessage,
				websocket.FormatCloseMessage(websocket.CloseNormalClosure, "session ended"))
			sshSess.OwnerConn.Close()
			sshSess.OwnerConn = nil
		}
		sshSess.OwnerMu.Unlock()

		sshSess.Session.Close()
		sshSess.Client.Close()

		m.mu.Lock()
		delete(m.sessions, sshSess.ID)
		m.mu.Unlock()
	})
}

func (m *SSHManager) JoinBroadcast(sessionID uint, username string, w http.ResponseWriter, r *http.Request) error {
	m.mu.RLock()
	sshSess, ok := m.sessions[sessionID]
	m.mu.RUnlock()

	if !ok || !sshSess.Active {
		return fmt.Errorf("session not found or not active")
	}

	wsConn, err := m.upgrader.Upgrade(w, r, nil)
	if err != nil {
		return fmt.Errorf("websocket upgrade failed: %w", err)
	}

	viewer := &Viewer{
		Conn:     wsConn,
		Send:     make(chan []byte, 256),
		Username: username,
	}

	sshSess.ViewersMu.Lock()
	sshSess.Viewers[viewer] = true
	sshSess.ViewersMu.Unlock()

	go m.writeToViewer(sshSess, viewer)
	go m.readViewerInput(sshSess, viewer)

	return nil
}

func (m *SSHManager) writeToViewer(sshSess *SSHSession, viewer *Viewer) {
	defer func() {
		sshSess.ViewersMu.Lock()
		delete(sshSess.Viewers, viewer)
		sshSess.ViewersMu.Unlock()
		viewer.Conn.Close()
	}()

	for {
		select {
		case <-sshSess.CloseCh:
			return
		case data, ok := <-viewer.Send:
			if !ok {
				return
			}
			viewer.Mu.Lock()
			err := viewer.Conn.WriteMessage(websocket.TextMessage, data)
			viewer.Mu.Unlock()
			if err != nil {
				return
			}
		}
	}
}

func (m *SSHManager) readViewerInput(sshSess *SSHSession, viewer *Viewer) {
	for {
		_, msg, err := viewer.Conn.ReadMessage()
		if err != nil {
			return
		}

		var wsMsg model.WSMessage
		if err := json.Unmarshal(msg, &wsMsg); err == nil {
			switch wsMsg.Type {
			case model.MsgTypeClose:
				return
			case model.MsgTypePing:
				viewer.Mu.Lock()
				pingMsg, _ := json.Marshal(model.WSMessage{Type: model.MsgTypePong})
				viewer.Conn.WriteMessage(websocket.TextMessage, pingMsg)
				viewer.Mu.Unlock()
			}
		}
	}
}

func (m *SSHManager) GetActiveSessions() []uint {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var ids []uint
	for id, sess := range m.sessions {
		if sess.Active {
			ids = append(ids, id)
		}
	}
	return ids
}

func (m *SSHManager) GetViewerCount(sessionID uint) int {
	m.mu.RLock()
	sshSess, ok := m.sessions[sessionID]
	m.mu.RUnlock()

	if !ok {
		return 0
	}

	sshSess.ViewersMu.RLock()
	defer sshSess.ViewersMu.RUnlock()
	return len(sshSess.Viewers)
}

func parseResize(data string) (int, int) {
	var resize struct {
		Cols int `json:"cols"`
		Rows int `json:"rows"`
	}
	if err := json.Unmarshal([]byte(data), &resize); err != nil {
		return 0, 0
	}
	return resize.Cols, resize.Rows
}

func splitEnv(env string) []string {
	for i, c := range env {
		if c == '=' {
			return []string{env[:i], env[i+1:]}
		}
	}
	return nil
}

func (m *SSHManager) dialDirect(server *model.Server) (*ssh.Client, error) {
	sshConfig := &ssh.ClientConfig{
		User:            server.Username,
		Auth:            []ssh.AuthMethod{},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         time.Duration(m.cfg.SSH.Timeout) * time.Second,
	}

	if server.Password != "" {
		sshConfig.Auth = append(sshConfig.Auth, ssh.Password(server.Password))
	}

	addr := fmt.Sprintf("%s:%d", server.Host, server.Port)
	return ssh.Dial("tcp", addr, sshConfig)
}

func (m *SSHManager) dialThroughJumpHost(jumpHost *model.JumpHost, target *model.Server) (*ssh.Client, error) {
	jumpConfig := &ssh.ClientConfig{
		User:            jumpHost.Username,
		Auth:            []ssh.AuthMethod{},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         time.Duration(m.cfg.SSH.Timeout) * time.Second,
	}

	if jumpHost.Password != "" {
		jumpConfig.Auth = append(jumpConfig.Auth, ssh.Password(jumpHost.Password))
	}

	jumpAddr := fmt.Sprintf("%s:%d", jumpHost.Host, jumpHost.Port)
	jumpClient, err := ssh.Dial("tcp", jumpAddr, jumpConfig)
	if err != nil {
		return nil, fmt.Errorf("jump host dial failed: %w", err)
	}

	targetConfig := &ssh.ClientConfig{
		User:            target.Username,
		Auth:            []ssh.AuthMethod{},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         time.Duration(m.cfg.SSH.Timeout) * time.Second,
	}

	if target.Password != "" {
		targetConfig.Auth = append(targetConfig.Auth, ssh.Password(target.Password))
	}

	targetAddr := fmt.Sprintf("%s:%d", target.Host, target.Port)
	targetConn, err := jumpClient.Dial("tcp", targetAddr)
	if err != nil {
		jumpClient.Close()
		return nil, fmt.Errorf("target dial through jump host failed: %w", err)
	}

	ncc, chans, reqs, err := ssh.NewClientConn(targetConn, targetAddr, targetConfig)
	if err != nil {
		jumpClient.Close()
		return nil, fmt.Errorf("target SSH handshake failed: %w", err)
	}

	return ssh.NewClient(ncc, chans, reqs), nil
}
