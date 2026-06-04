package service

import (
	"bytes"
	"regexp"
	"strings"
	"sync"
	"time"

	"ssh-web-terminal/internal/model"
	"ssh-web-terminal/internal/repository"
)

type CommandInterceptor struct {
	blacklistRepo *repository.BlacklistRepository
	patterns      []*BlacklistPattern
	mu            sync.RWMutex
	lastUpdate    time.Time
}

type BlacklistPattern struct {
	ID          uint
	Pattern     string
	Regex       *regexp.Regexp
	Description string
	Severity    string
	Enabled     bool
	Block       bool
}

func NewCommandInterceptor(blacklistRepo *repository.BlacklistRepository) *CommandInterceptor {
	ci := &CommandInterceptor{
		blacklistRepo: blacklistRepo,
	}
	ci.loadPatterns()
	return ci
}

func (ci *CommandInterceptor) loadPatterns() {
	ci.mu.Lock()
	defer ci.mu.Unlock()

	rules, err := ci.blacklistRepo.FindAllEnabled()
	if err != nil {
		return
	}

	ci.patterns = make([]*BlacklistPattern, 0, len(rules))
	for _, rule := range rules {
		re, err := regexp.Compile(`(?i)` + rule.Pattern)
		if err != nil {
			continue
		}
		ci.patterns = append(ci.patterns, &BlacklistPattern{
			ID:          rule.ID,
			Pattern:     rule.Pattern,
			Regex:       re,
			Description: rule.Description,
			Severity:    rule.Severity,
			Enabled:     rule.Enabled,
			Block:       rule.Block,
		})
	}
	ci.lastUpdate = time.Now()
}

func (ci *CommandInterceptor) RefreshPatterns() {
	ci.loadPatterns()
}

type CommandCheckResult struct {
	Blocked      bool
	MatchedRule  *BlacklistPattern
	MatchedIndex int
}

func (ci *CommandInterceptor) CheckCommand(command string) CommandCheckResult {
	cmd := strings.TrimSpace(command)
	if cmd == "" {
		return CommandCheckResult{Blocked: false}
	}

	ci.mu.RLock()
	patterns := ci.patterns
	ci.mu.RUnlock()

	for i, p := range patterns {
		if !p.Enabled {
			continue
		}
		if p.Regex.MatchString(cmd) {
			return CommandCheckResult{
				Blocked:      p.Block,
				MatchedRule:  p,
				MatchedIndex: i,
			}
		}
	}

	return CommandCheckResult{Blocked: false}
}

type CommandParser struct {
	buffer   string
	cursor   int
	promptRE *regexp.Regexp
}

func NewCommandParser() *CommandParser {
	return &CommandParser{
		buffer:   "",
		promptRE: regexp.MustCompile(`[\$#]\s*$`),
	}
}

func (cp *CommandParser) Feed(data string) []string {
	cp.buffer += data

	var commands []string
	lines := strings.Split(cp.buffer, "\n")

	if len(lines) <= 1 {
		return commands
	}

	for i := 0; i < len(lines)-1; i++ {
		line := lines[i]
		cleanLine := cp.cleanLine(line)
		if cleanLine != "" && !cp.isPrompt(cleanLine) {
			commands = append(commands, cleanLine)
		}
	}

	cp.buffer = lines[len(lines)-1]
	return commands
}

func (cp *CommandParser) cleanLine(line string) string {
	line = regexp.MustCompile(`\x1b\[[0-9;]*[a-zA-Z]`).ReplaceAllString(line, "")
	line = strings.TrimSpace(line)
	return line
}

func (cp *CommandParser) isPrompt(line string) bool {
	return cp.promptRE.MatchString(line)
}

type StdinParser struct {
	buffer bytes.Buffer
}

func NewStdinParser() *StdinParser {
	return &StdinParser{}
}

func (sp *StdinParser) Feed(data []byte) []string {
	sp.buffer.Write(data)

	var commands []string
	content := sp.buffer.String()

	for {
		newlineIdx := strings.IndexByte(content, '\n')
		if newlineIdx == -1 {
			break
		}

		line := content[:newlineIdx]
		content = content[newlineIdx+1:]

		if cmd := parseShellLine(line); cmd != "" {
			commands = append(commands, cmd)
		}
	}

	sp.buffer.Reset()
	sp.buffer.WriteString(content)
	return commands
}

func parseShellLine(line string) string {
	line = strings.TrimRight(line, "\r")
	line = strings.TrimSpace(line)
	return line
}

type CommandSession struct {
	SessionID   uint
	UserID      uint
	ServerID    uint
	Parser      *StdinParser
	LogRepo     *repository.CommandLogRepository
	Interceptor *CommandInterceptor
	BlockedCmds map[string]bool
}

func NewCommandSession(sessionID, userID, serverID uint, logRepo *repository.CommandLogRepository, interceptor *CommandInterceptor) *CommandSession {
	return &CommandSession{
		SessionID:   sessionID,
		UserID:      userID,
		ServerID:    serverID,
		Parser:      NewStdinParser(),
		LogRepo:     logRepo,
		Interceptor: interceptor,
		BlockedCmds: make(map[string]bool),
	}
}

func (cs *CommandSession) ProcessStdin(data []byte) ([]byte, bool) {
	commands := cs.Parser.Feed(data)
	shouldBlock := false

	for _, cmd := range commands {
		result := cs.Interceptor.CheckCommand(cmd)

		var matchedRuleID *uint
		if result.MatchedRule != nil {
			matchedRuleID = &result.MatchedRule.ID
		}

		logEntry := &model.CommandLog{
			SessionID:   cs.SessionID,
			UserID:      cs.UserID,
			ServerID:    cs.ServerID,
			Command:     cmd,
			Blocked:     result.Blocked,
			MatchedRule: matchedRuleID,
			ExecutedAt:  time.Now(),
		}
		cs.LogRepo.Create(logEntry)

		if result.Blocked {
			shouldBlock = true
			cs.BlockedCmds[cmd] = true
		}
	}

	if shouldBlock {
		return []byte("\x07\r\n\x1b[31m[BLOCKED] Command blocked by security policy\x1b[0m\r\n"), true
	}

	return data, false
}
