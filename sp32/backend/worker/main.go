package main

import (
	"compute-cluster/proto"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"math"
	"math/big"
	"math/rand"
	"os"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/quic-go/quic-go/http3"
	"github.com/quic-go/webtransport-go"
)

type Worker struct {
	nodeID           string
	hostname         string
	session          *webtransport.Session
	dialer           *webtransport.Dialer
	tasks            map[string]*RunningTask
	tasksMu          sync.RWMutex
	canceledVersions map[string]uint64
	cpuUsage         float64
	memUsage         float64
}

func (w *Worker) isTaskCanceled(taskID string, shardIndex int, version uint64) bool {
	w.tasksMu.RLock()
	defer w.tasksMu.RUnlock()

	key := fmt.Sprintf("%s-%d", taskID, shardIndex)
	canceledVersion, exists := w.canceledVersions[key]
	if exists && version <= canceledVersion {
		return true
	}
	return false
}

func (w *Worker) markTaskCanceled(taskID string, shardIndex int, version uint64) {
	w.tasksMu.Lock()
	defer w.tasksMu.Unlock()

	key := fmt.Sprintf("%s-%d", taskID, shardIndex)
	if current, exists := w.canceledVersions[key]; !exists || version > current {
		w.canceledVersions[key] = version
	}
}

type RunningTask struct {
	TaskID     string
	ShardIndex int
	ShardTotal int
	Type       proto.TaskType
	Params     map[string]interface{}
	Version    uint64
	Cancel     context.CancelFunc
	Completed  bool
	Acked      bool
}

func NewWorker(nodeID string) *Worker {
	hostname, _ := os.Hostname()
	return &Worker{
		nodeID:           nodeID,
		hostname:         hostname,
		tasks:            make(map[string]*RunningTask),
		canceledVersions: make(map[string]uint64),
	}
}

func (w *Worker) Connect(ctx context.Context, addr string) error {
	tlsConf := &tls.Config{
		InsecureSkipVerify: true,
		NextProtos:         []string{"h3", "h3-29"},
	}

	w.dialer = &webtransport.Dialer{
		RoundTripper: &http3.RoundTripper{
			TLSClientConfig: tlsConf,
		},
	}

	resp, session, err := w.dialer.Dial(ctx, fmt.Sprintf("https://%s/webtransport", addr), nil)
	if err != nil {
		return fmt.Errorf("failed to connect: %w", err)
	}
	_ = resp

	w.session = session
	fmt.Printf("Connected to master at %s\n", addr)

	if err := w.register(); err != nil {
		return fmt.Errorf("failed to register: %w", err)
	}

	go w.receiveMessages()
	go w.sendHeartbeats()
	go w.simulateResourceUsage()

	return nil
}

func (w *Worker) register() error {
	req := proto.RegisterRequest{
		NodeID:   w.nodeID,
		Hostname: w.hostname,
	}

	msgBytes, err := proto.EncodeMessage(proto.MsgTypeRegister, req)
	if err != nil {
		return err
	}

	stream, err := w.session.OpenStream()
	if err != nil {
		return err
	}
	defer stream.Close()

	_, err = stream.Write(msgBytes)
	return err
}

func (w *Worker) sendHeartbeats() {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		if w.session == nil {
			continue
		}

		w.tasksMu.RLock()
		taskCount := len(w.tasks)
		w.tasksMu.RUnlock()

		hb := proto.Heartbeat{
			NodeID:    w.nodeID,
			Timestamp: time.Now().Unix(),
			CPUUsage:  w.cpuUsage,
			MemUsage:  w.memUsage,
			TaskCount: taskCount,
		}

		msgBytes, _ := proto.EncodeMessage(proto.MsgTypeHeartbeat, hb)

		stream, err := w.session.OpenStream()
		if err != nil {
			fmt.Printf("Failed to open heartbeat stream: %v\n", err)
			continue
		}

		_, err = stream.Write(msgBytes)
		stream.Close()
		if err != nil {
			fmt.Printf("Failed to send heartbeat: %v\n", err)
		}
	}
}

func (w *Worker) simulateResourceUsage() {
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for range ticker.C {
		w.tasksMu.RLock()
		taskCount := len(w.tasks)
		w.tasksMu.RUnlock()

		baseLoad := float64(taskCount) * 15
		w.cpuUsage = math.Min(95, baseLoad+rand.Float64()*10)
		w.memUsage = math.Min(85, 30+baseLoad*0.5+rand.Float64()*5)
	}
}

func (w *Worker) receiveMessages() {
	ctx := w.session.Context()

	for {
		stream, err := w.session.AcceptUniStream(ctx)
		if err != nil {
			fmt.Printf("Session closed: %v\n", err)
			return
		}

		go w.handleMessage(stream)
	}
}

func (w *Worker) handleMessage(stream webtransport.ReceiveStream) {
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
	case proto.MsgTypeRegisterResp:
		var resp proto.RegisterResponse
		json.Unmarshal(payload, &resp)
		fmt.Printf("Registered: %+v\n", resp)

	case proto.MsgTypeTaskAssign:
		var assign proto.TaskAssign
		json.Unmarshal(payload, &assign)
		
		if w.isTaskCanceled(assign.TaskID, assign.ShardIndex, assign.Version) {
			fmt.Printf("Ignoring stale task %s shard %d version %d (already canceled)\n", 
				assign.TaskID, assign.ShardIndex, assign.Version)
			return
		}
		
		fmt.Printf("Task assigned: %s, shard %d/%d, version %d\n", 
			assign.TaskID, assign.ShardIndex, assign.ShardTotal, assign.Version)
		go w.executeTask(&assign)

	case proto.MsgTypeTaskCancel:
		var cancel proto.TaskCancel
		json.Unmarshal(payload, &cancel)
		fmt.Printf("Task cancel: %s shard %d version %d, reason: %s\n",
			cancel.TaskID, cancel.ShardIndex, cancel.Version, cancel.Reason)
		
		w.markTaskCanceled(cancel.TaskID, cancel.ShardIndex, cancel.Version)
		
		taskKey := fmt.Sprintf("%s-%d", cancel.TaskID, cancel.ShardIndex)
		w.tasksMu.Lock()
		if task, exists := w.tasks[taskKey]; exists && task.Version <= cancel.Version {
			if !task.Completed {
				task.Cancel()
				fmt.Printf("Canceled running task %s shard %d\n", cancel.TaskID, cancel.ShardIndex)
			}
		}
		w.tasksMu.Unlock()

		w.sendShardAck(cancel.TaskID, cancel.ShardIndex, cancel.Version)

	case proto.MsgTypeShardAck:
		var ack proto.ShardAck
		json.Unmarshal(payload, &ack)
		
		taskKey := fmt.Sprintf("%s-%d", ack.TaskID, ack.ShardIndex)
		w.tasksMu.Lock()
		if task, exists := w.tasks[taskKey]; exists && task.Version == ack.Version {
			task.Acked = true
		}
		w.tasksMu.Unlock()
	}
}

func (w *Worker) executeTask(assign *proto.TaskAssign) {
	ctx, cancel := context.WithCancel(context.Background())
	taskKey := fmt.Sprintf("%s-%d", assign.TaskID, assign.ShardIndex)

	task := &RunningTask{
		TaskID:     assign.TaskID,
		ShardIndex: assign.ShardIndex,
		ShardTotal: assign.ShardTotal,
		Type:       assign.TaskType,
		Params:     assign.Params,
		Version:    assign.Version,
		Cancel:     cancel,
	}

	w.tasksMu.Lock()
	w.tasks[taskKey] = task
	w.tasksMu.Unlock()

	logger := &taskLogger{
		worker:     w,
		taskID:     assign.TaskID,
		shardIndex: assign.ShardIndex,
	}

	logger.Info("Task started: type=%s, priority=%d, version=%d", 
		assign.TaskType, assign.Priority, assign.Version)

	defer func() {
		w.tasksMu.Lock()
		task.Completed = true
		delete(w.tasks, taskKey)
		w.tasksMu.Unlock()
		cancel()
	}()

	var result interface{}
	var err error

	switch assign.TaskType {
	case proto.TaskTypeComputePI:
		logger.Info("Starting PI computation, shard %d/%d", assign.ShardIndex+1, assign.ShardTotal)
		result, err = w.computePI(ctx, assign, task, logger)
	}

	if w.isTaskCanceled(assign.TaskID, assign.ShardIndex, assign.Version) {
		logger.Warn("Task was canceled during execution, discarding result")
		fmt.Printf("Task %s shard %d version %d was canceled, discarding result\n",
			assign.TaskID, assign.ShardIndex, assign.Version)
		return
	}

	if err != nil {
		logger.Error("Task failed: %v", err)
	} else {
		logger.Info("Task completed successfully")
	}

	complete := proto.TaskCompleteMsg{
		TaskID:     assign.TaskID,
		ShardIndex: assign.ShardIndex,
		Success:    err == nil,
		Result:     result,
		NodeID:     w.nodeID,
		Version:    assign.Version,
	}
	if err != nil {
		complete.Error = err.Error()
	}

	msgBytes, _ := proto.EncodeMessage(proto.MsgTypeTaskComplete, complete)

	stream, _ := w.session.OpenStream()
	stream.Write(msgBytes)
	stream.Close()
}

func (w *Worker) computePI(ctx context.Context, assign *proto.TaskAssign, task *RunningTask, logger *taskLogger) (string, error) {
	digits := 1000
	if d, ok := assign.Params["digits"].(float64); ok {
		digits = int(d)
	}

	terms := 10000
	termsPerShard := terms / assign.ShardTotal
	start := assign.ShardIndex * termsPerShard
	end := start + termsPerShard

	if assign.ShardIndex == assign.ShardTotal-1 {
		end = terms
	}

	precision := uint(digits * 4)
	pi := new(big.Float).SetPrec(precision)
	pi.SetFloat64(0)

	logger.Info("Computing PI: digits=%d, terms=%d, start=%d, end=%d, precision=%d",
		digits, terms, start, end, precision)

	factor := new(big.Float).SetPrec(precision)
	divisor := new(big.Float).SetPrec(precision)
	term := new(big.Float).SetPrec(precision)

	lastLogProgress := 0.0

	for k := start; k < end; k++ {
		select {
		case <-ctx.Done():
			logger.Warn("Task canceled via context")
			return "", ctx.Err()
		default:
		}

		if w.isTaskCanceled(assign.TaskID, assign.ShardIndex, assign.Version) {
			logger.Warn("Task canceled via version check")
			return "", fmt.Errorf("task canceled")
		}

		kFloat := new(big.Float).SetPrec(precision).SetInt64(int64(k))
		fourK := new(big.Float).SetPrec(precision).SetFloat64(4)
		fourK.Mul(fourK, kFloat)

		factor.SetFloat64(1)
		if k%2 != 0 {
			factor.SetFloat64(-1)
		}

		divisor.SetFloat64(1)
		divisor.Add(divisor, fourK)

		term.Quo(factor, divisor)
		pi.Add(pi, term)

		if k%100 == 0 {
			progress := float64(k-start+1) / float64(end-start) * 100
			w.sendProgress(assign.TaskID, assign.ShardIndex, progress, assign.Version)

			if progress-lastLogProgress >= 25 {
				logger.Debug("Progress: %.1f%%, iteration %d/%d", progress, k-start+1, end-start)
				lastLogProgress = progress
			}
		}

		time.Sleep(10 * time.Microsecond)
	}

	pi.Mul(pi, big.NewFloat(4))

	result := pi.Text('f', digits/2)
	logger.Info("PI computation complete, result length: %d chars", len(result))

	return result, nil
}

func (w *Worker) sendProgress(taskID string, shardIndex int, progress float64, version uint64) {
	if w.isTaskCanceled(taskID, shardIndex, version) {
		return
	}

	update := proto.TaskProgressUpdate{
		TaskID:     taskID,
		ShardIndex: shardIndex,
		Progress:   progress,
		NodeID:     w.nodeID,
		Version:    version,
	}

	msgBytes, _ := proto.EncodeMessage(proto.MsgTypeTaskProgress, update)

	stream, err := w.session.OpenStream()
	if err != nil {
		return
	}
	stream.Write(msgBytes)
	stream.Close()
}

func (w *Worker) sendShardAck(taskID string, shardIndex int, version uint64) {
	ack := proto.ShardAck{
		TaskID:     taskID,
		ShardIndex: shardIndex,
		NodeID:     w.nodeID,
		Version:    version,
	}

	msgBytes, _ := proto.EncodeMessage(proto.MsgTypeShardAck, ack)

	stream, err := w.session.OpenStream()
	if err != nil {
		return
	}
	stream.Write(msgBytes)
	stream.Close()
}

func (w *Worker) sendTaskLog(taskID string, shardIndex int, level string, message string) {
	log := proto.TaskLogEntry{
		TaskID:     taskID,
		ShardIndex: shardIndex,
		NodeID:     w.nodeID,
		Timestamp:  time.Now().Unix(),
		Level:      level,
		Message:    message,
	}

	msgBytes, _ := proto.EncodeMessage(proto.MsgTypeTaskLog, log)

	stream, err := w.session.OpenStream()
	if err != nil {
		return
	}
	stream.Write(msgBytes)
	stream.Close()
}

type taskLogger struct {
	worker     *Worker
	taskID     string
	shardIndex int
}

func (tl *taskLogger) Info(msg string, args ...interface{}) {
	tl.worker.sendTaskLog(tl.taskID, tl.shardIndex, "info", fmt.Sprintf(msg, args...))
}

func (tl *taskLogger) Warn(msg string, args ...interface{}) {
	tl.worker.sendTaskLog(tl.taskID, tl.shardIndex, "warn", fmt.Sprintf(msg, args...))
}

func (tl *taskLogger) Error(msg string, args ...interface{}) {
	tl.worker.sendTaskLog(tl.taskID, tl.shardIndex, "error", fmt.Sprintf(msg, args...))
}

func (tl *taskLogger) Debug(msg string, args ...interface{}) {
	tl.worker.sendTaskLog(tl.taskID, tl.shardIndex, "debug", fmt.Sprintf(msg, args...))
}

func main() {
	nodeID := uuid.New().String()
	if len(os.Args) > 1 {
		nodeID = os.Args[1]
	}

	worker := NewWorker(nodeID)
	fmt.Printf("Starting worker %s (%s)\n", worker.nodeID, worker.hostname)

	ctx := context.Background()
	if err := worker.Connect(ctx, "localhost:4433"); err != nil {
		fmt.Printf("Error: %v\n", err)
		os.Exit(1)
	}

	select {}
}
