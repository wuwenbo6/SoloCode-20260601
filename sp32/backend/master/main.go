package main

import (
	"compute-cluster/proto"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"fmt"
	"math/big"
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/quic-go/quic-go/http3"
	"github.com/quic-go/webtransport-go"
)

var (
	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}
)

type Server struct {
	wtServer    *webtransport.Server
	nodeManager *NodeManager
	taskManager *TaskManager
	frontends   map[*websocket.Conn]bool
	frontendsMu sync.RWMutex
}

func NewServer() *Server {
	return &Server{
		nodeManager: NewNodeManager(),
		taskManager: NewTaskManager(),
		frontends:   make(map[*websocket.Conn]bool),
	}
}

func (s *Server) generateTLSConfig() *tls.Config {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		panic(err)
	}

	template := x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject: pkix.Name{
			Organization: []string{"Compute Cluster"},
		},
		NotBefore:             time.Now(),
		NotAfter:              time.Now().Add(24 * time.Hour * 365),
		KeyUsage:              x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
		DNSNames:              []string{"localhost", "127.0.0.1"},
		IPAddresses:           []net.IP{net.ParseIP("127.0.0.1")},
	}

	certDER, err := x509.CreateCertificate(rand.Reader, &template, &template, &key.PublicKey, key)
	if err != nil {
		panic(err)
	}

	return &tls.Config{
		Certificates: []tls.Certificate{
			{
				Certificate: [][]byte{certDER},
				PrivateKey:  key,
			},
		},
		NextProtos: []string{"h3", "h3-29"},
	}
}

func (s *Server) HandleWebTransportSession(w http.ResponseWriter, r *http.Request) {
	session, err := s.wtServer.Upgrade(w, r)
	if err != nil {
		fmt.Printf("Failed to upgrade WebTransport: %v\n", err)
		return
	}

	go s.handleWorkerSession(session)
}

func (s *Server) handleWorkerSession(session *webtransport.Session) {
	ctx := session.Context()
	sendChan := make(chan []byte, 100)

	go func() {
		for msg := range sendChan {
			stream, err := session.OpenUniStream()
			if err != nil {
				fmt.Printf("Failed to open stream: %v\n", err)
				return
			}
			stream.Write(msg)
			stream.Close()
		}
	}()

	for {
		stream, err := session.AcceptStream(ctx)
		if err != nil {
			fmt.Printf("Session closed: %v\n", err)
			return
		}

		go s.handleWorkerStream(stream, sendChan)
	}
}

func (s *Server) handleWorkerStream(stream webtransport.Stream, sendChan chan []byte) {
	defer stream.Close()

	buf := make([]byte, 4096)
	n, err := stream.Read(buf)
	if err != nil {
		return
	}

	msgType, payload, err := proto.DecodeMessage(buf[:n])
	if err != nil {
		fmt.Printf("Failed to decode message: %v\n", err)
		return
	}

	switch msgType {
	case proto.MsgTypeRegister:
		s.handleRegister(payload, sendChan)
	case proto.MsgTypeHeartbeat:
		s.handleHeartbeat(payload)
	case proto.MsgTypeTaskProgress:
		s.handleTaskProgress(payload)
	case proto.MsgTypeTaskComplete:
		s.handleTaskComplete(payload)
	case proto.MsgTypeShardAck:
		s.handleShardAck(payload)
	case proto.MsgTypeTaskLog:
		s.handleTaskLog(payload)
	}
}

func (s *Server) handleRegister(payload json.RawMessage, sendChan chan []byte) {
	var req proto.RegisterRequest
	if err := json.Unmarshal(payload, &req); err != nil {
		return
	}

	node := s.nodeManager.AddNode(req.NodeID, req.Hostname, sendChan)
	fmt.Printf("Node registered: %s (%s)\n", node.ID, node.Hostname)

	resp := proto.RegisterResponse{
		Success: true,
		NodeID:  node.ID,
		Message: "Welcome to the cluster",
	}

	msgBytes, _ := proto.EncodeMessage(proto.MsgTypeRegisterResp, resp)
	sendChan <- msgBytes

	s.broadcastClusterStatus()
	s.scheduleTasks()
}

func (s *Server) handleHeartbeat(payload json.RawMessage) {
	var hb proto.Heartbeat
	if err := json.Unmarshal(payload, &hb); err != nil {
		return
	}

	s.nodeManager.UpdateHeartbeat(&hb)
}

func (s *Server) handleTaskProgress(payload json.RawMessage) {
	var update proto.TaskProgressUpdate
	if err := json.Unmarshal(payload, &update); err != nil {
		return
	}

	accepted := s.taskManager.UpdateShardProgress(update.TaskID, update.ShardIndex, update.Progress, update.Version)
	if !accepted {
		if s.taskManager.IsShardCanceled(update.TaskID, update.ShardIndex, update.Version) {
			s.sendTaskCancel(update.NodeID, update.TaskID, update.ShardIndex, update.Version, "stale_version")
		}
		return
	}
	s.broadcastTaskUpdate(update.TaskID)
}

func (s *Server) handleTaskComplete(payload json.RawMessage) {
	var complete proto.TaskCompleteMsg
	if err := json.Unmarshal(payload, &complete); err != nil {
		return
	}

	if complete.Success {
		accepted, err := s.taskManager.CompleteShard(complete.TaskID, complete.ShardIndex, complete.Result, complete.Version)
		if err != nil {
			fmt.Printf("Complete shard failed: %v\n", err)
			if s.taskManager.IsShardCanceled(complete.TaskID, complete.ShardIndex, complete.Version) {
				s.sendTaskCancel(complete.NodeID, complete.TaskID, complete.ShardIndex, complete.Version, "duplicate_or_canceled")
			}
			return
		}
		if accepted {
			s.sendShardAck(complete.NodeID, complete.TaskID, complete.ShardIndex, complete.Version)
		}
	} else {
		reassigned := s.taskManager.ReassignShardsForNode(complete.NodeID)
		for _, shard := range reassigned {
			s.sendTaskCancel(shard.OldNodeID, shard.TaskID, shard.ShardIndex, shard.OldVersion, "task_failed")
		}
	}

	s.broadcastTaskUpdate(complete.TaskID)
	s.scheduleTasks()
}

func (s *Server) handleShardAck(payload json.RawMessage) {
	var ack proto.ShardAck
	if err := json.Unmarshal(payload, &ack); err != nil {
		return
	}
	s.taskManager.ClearCanceledShard(ack.TaskID, ack.ShardIndex, ack.Version)
}

func (s *Server) sendTaskCancel(nodeID, taskID string, shardIndex int, version uint64, reason string) {
	node, exists := s.nodeManager.GetNode(nodeID)
	if !exists {
		return
	}

	cancel := proto.TaskCancel{
		TaskID:     taskID,
		ShardIndex: shardIndex,
		Version:    version,
		Reason:     reason,
	}

	msgBytes, _ := proto.EncodeMessage(proto.MsgTypeTaskCancel, cancel)
	select {
	case node.SendChan <- msgBytes:
	default:
	}
}

func (s *Server) sendShardAck(nodeID, taskID string, shardIndex int, version uint64) {
	node, exists := s.nodeManager.GetNode(nodeID)
	if !exists {
		return
	}

	ack := proto.ShardAck{
		TaskID:     taskID,
		ShardIndex: shardIndex,
		NodeID:     nodeID,
		Version:    version,
	}

	msgBytes, _ := proto.EncodeMessage(proto.MsgTypeShardAck, ack)
	select {
	case node.SendChan <- msgBytes:
	default:
	}
}

func (s *Server) scheduleTasks() {
	onlineNodes := s.nodeManager.GetOnlineNodes()
	if len(onlineNodes) == 0 {
		return
	}

	assignedCount := make(map[string]int)
	for _, node := range onlineNodes {
		assignedCount[node.ID] = 0
	}

	for _, node := range onlineNodes {
		pq := s.taskManager.GetSchedulableShards(node.ID, node.Tags)
		if pq.Len() == 0 {
			continue
		}

		for pq.Len() > 0 {
			item := pq.Pop().(*PendingShard)

			if assignedCount[node.ID] >= 2 {
				pq.Push(item)
				break
			}

			version, err := s.taskManager.AssignShard(item.TaskID, item.ShardIndex, node.ID)
			if err != nil {
				continue
			}

			assign := proto.TaskAssign{
				TaskID:       item.TaskID,
				TaskType:     item.TaskType,
				Params:       item.Params,
				ShardIndex:   item.ShardIndex,
				ShardTotal:   item.ShardTotal,
				Version:      version,
				Priority:     item.Priority,
				AffinityTags: item.AffinityTags,
			}

			msgBytes, _ := proto.EncodeMessage(proto.MsgTypeTaskAssign, assign)
			select {
			case node.SendChan <- msgBytes:
				assignedCount[node.ID]++
				s.taskManager.AddTaskLog(&proto.TaskLogEntry{
					TaskID:     item.TaskID,
					ShardIndex: item.ShardIndex,
					NodeID:     node.ID,
					Timestamp:  time.Now().Unix(),
					Level:      "info",
					Message:    fmt.Sprintf("Shard assigned to node %s with priority %d", node.ID, item.Priority),
				})
			default:
			}
		}
	}
}

func (s *Server) broadcastTaskUpdate(taskID string) {
	update := s.taskManager.ToTaskUpdate(taskID)
	if update == nil {
		return
	}

	msgBytes, _ := proto.EncodeMessage(proto.MsgTypeTaskUpdate, update)
	s.broadcastToFrontends(msgBytes)
}

func (s *Server) broadcastClusterStatus() {
	status := proto.ClusterStatusUpdate{
		Nodes:     s.nodeManager.ToProtoStatus(),
		Tasks:     s.taskManager.ToTaskSummaries(),
		Timestamp: time.Now().Unix(),
	}

	msgBytes, _ := proto.EncodeMessage(proto.MsgTypeClusterStatus, status)
	s.broadcastToFrontends(msgBytes)
}

func (s *Server) broadcastToFrontends(msg []byte) {
	s.frontendsMu.RLock()
	defer s.frontendsMu.RUnlock()

	for conn := range s.frontends {
		err := conn.WriteMessage(websocket.TextMessage, msg)
		if err != nil {
			conn.Close()
			delete(s.frontends, conn)
		}
	}
}

func (s *Server) HandleFrontendWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		fmt.Printf("WebSocket upgrade failed: %v\n", err)
		return
	}

	s.frontendsMu.Lock()
	s.frontends[conn] = true
	s.frontendsMu.Unlock()

	s.broadcastClusterStatus()

	go func() {
		defer func() {
			s.frontendsMu.Lock()
			delete(s.frontends, conn)
			s.frontendsMu.Unlock()
			conn.Close()
		}()

		for {
			_, msg, err := conn.ReadMessage()
			if err != nil {
				return
			}

			msgType, payload, err := proto.DecodeMessage(msg)
			if err != nil {
				continue
			}

			switch msgType {
			case proto.MsgTypeSubmitTask:
				s.handleSubmitTask(payload)
			case proto.MsgTypeTaskLogRequest:
				s.handleTaskLogRequest(conn, payload)
			}
		}
	}()
}

func (s *Server) handleSubmitTask(payload json.RawMessage) {
	var req proto.SubmitTaskRequest
	if err := json.Unmarshal(payload, &req); err != nil {
		return
	}

	taskID := uuid.New().String()
	shardCount := 10

	priority := req.Priority
	if priority == 0 {
		priority = proto.PriorityNormal
	}

	_, err := s.taskManager.CreateTask(taskID, req.Type, req.Params, shardCount, 
		priority, req.AffinityTags, req.AntiAffinity, req.PreferredNodes)
	if err != nil {
		fmt.Printf("Failed to create task: %v\n", err)
		return
	}
	fmt.Printf("Task submitted: %s (%s), shards: %d, priority: %d\n", taskID, req.Type, shardCount, priority)

	resp := proto.SubmitTaskResponse{
		Success: true,
		TaskID:  taskID,
		Message: "Task created successfully",
	}
	msgBytes, _ := proto.EncodeMessage(proto.MsgTypeTaskResult, resp)
	s.broadcastToFrontends(msgBytes)

	go s.scheduleTasks()
	s.broadcastClusterStatus()
}

func (s *Server) handleTaskLog(payload json.RawMessage) {
	var logEntry proto.TaskLogEntry
	if err := json.Unmarshal(payload, &logEntry); err != nil {
		return
	}
	s.taskManager.AddTaskLog(&logEntry)
}

func (s *Server) handleTaskLogRequest(conn *websocket.Conn, payload json.RawMessage) {
	var req proto.TaskLogRequest
	if err := json.Unmarshal(payload, &req); err != nil {
		return
	}

	since := time.Unix(req.SinceTime, 0)
	sub := s.taskManager.SubscribeToLogs(req.TaskID, since, req.Follow)

	go func() {
		defer s.taskManager.UnsubscribeFromLogs(sub)

		for resp := range sub.Chan {
			msgBytes, err := proto.EncodeMessage(proto.MsgTypeTaskLog, resp)
			if err != nil {
				continue
			}
			err = conn.WriteMessage(websocket.TextMessage, msgBytes)
			if err != nil {
				return
			}
			if resp.Done && !req.Follow {
				return
			}
		}
	}()
}

func (s *Server) healthChecker() {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	dedupCleanupTicker := time.NewTicker(5 * time.Minute)
	defer dedupCleanupTicker.Stop()

	for {
		select {
		case <-ticker.C:
			offlineNodes := s.nodeManager.CheckHeartbeats()

			for _, nodeID := range offlineNodes {
				fmt.Printf("Node offline: %s\n", nodeID)
				reassigned := s.taskManager.ReassignShardsForNode(nodeID)
				for _, shard := range reassigned {
					fmt.Printf("Reassigning shard %d of task %s (old version: %d, node: %s)\n", 
						shard.ShardIndex, shard.TaskID, shard.OldVersion, shard.OldNodeID)
				}
				go s.scheduleTasks()
			}

			s.broadcastClusterStatus()

		case <-dedupCleanupTicker.C:
			s.taskManager.CleanupOldDedupEntries(1 * time.Hour)
		}
	}
}

func (s *Server) Start() error {
	tlsConf := s.generateTLSConfig()

	s.wtServer = &webtransport.Server{
		H3: http3.Server{
			TLSConfig: tlsConf,
			Addr:      ":4433",
		},
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/webtransport", s.HandleWebTransportSession)
	mux.HandleFunc("/ws", s.HandleFrontendWebSocket)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		fmt.Fprintf(w, "Compute Cluster Master Server")
	})

	go s.healthChecker()

	fmt.Println("WebTransport server starting on :4433")
	fmt.Println("WebSocket server starting on :8080")

	go func() {
		httpServer := &http.Server{
			Addr:    ":8080",
			Handler: mux,
		}
		httpServer.ListenAndServe()
	}()

	return s.wtServer.ListenAndServe()
}

func main() {
	server := NewServer()
	if err := server.Start(); err != nil {
		fmt.Printf("Server error: %v\n", err)
	}
}
