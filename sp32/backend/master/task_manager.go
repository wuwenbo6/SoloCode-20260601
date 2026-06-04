package main

import (
	"bufio"
	"compute-cluster/proto"
	"fmt"
	"io"
	"math/big"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	maxShardResultSize = 1024 * 1024
	streamBufferSize   = 64 * 1024
)

type Shard struct {
	Index      int
	NodeID     string
	Status     string
	Progress   float64
	Completed  bool
	Version    uint64
	Result     interface{}
	ResultFile string
}

type Task struct {
	ID             string
	Type           proto.TaskType
	Params         map[string]interface{}
	Status         string
	Progress       float64
	Result         interface{}
	Shards         []*Shard
	CreatedAt      time.Time
	CompletedAt    time.Time
	aggregator     ResultAggregator
	Priority       proto.TaskPriority
	AffinityTags   []string
	AntiAffinity   []string
	PreferredNodes []string
}

type LogEntry struct {
	TaskID     string
	ShardIndex int
	NodeID     string
	Timestamp  time.Time
	Level      string
	Message    string
}

type LogSubscriber struct {
	TaskID   string
	Chan     chan *proto.TaskLogResponse
	Since    time.Time
	Follow   bool
	Active   bool
}

type PriorityQueue []*PendingShard

type PendingShard struct {
	TaskID       string
	ShardIndex   int
	Params       map[string]interface{}
	TaskType     proto.TaskType
	ShardTotal   int
	Version      uint64
	Priority     proto.TaskPriority
	AffinityTags []string
}

func (pq PriorityQueue) Len() int { return len(pq) }

func (pq PriorityQueue) Less(i, j int) bool {
	if pq[i].Priority != pq[j].Priority {
		return pq[i].Priority > pq[j].Priority
	}
	return pq[i].ShardIndex < pq[j].ShardIndex
}

func (pq PriorityQueue) Swap(i, j int) {
	pq[i], pq[j] = pq[j], pq[i]
}

func (pq *PriorityQueue) Push(x interface{}) {
	item := x.(*PendingShard)
	*pq = append(*pq, item)
}

func (pq *PriorityQueue) Pop() interface{} {
	old := *pq
	n := len(old)
	item := old[n-1]
	old[n-1] = nil
	*pq = old[0 : n-1]
	return item
}

type ResultAggregator interface {
	AddShardResult(shardIndex int, result string) error
	Finalize() (string, error)
	Close() error
}

type PIResultAggregator struct {
	taskID     string
	shardCount int
	results    map[int]string
	resultsMu  sync.Mutex
	tempFile   *os.File
	writer     *bufio.Writer
	precision  uint
}

func NewPIResultAggregator(taskID string, shardCount int, precision uint) (*PIResultAggregator, error) {
	tempDir := os.TempDir()
	tempFile, err := os.Create(filepath.Join(tempDir, fmt.Sprintf("pi_%s.tmp", taskID)))
	if err != nil {
		return nil, err
	}

	return &PIResultAggregator{
		taskID:     taskID,
		shardCount: shardCount,
		results:    make(map[int]string),
		tempFile:   tempFile,
		writer:     bufio.NewWriterSize(tempFile, streamBufferSize),
		precision:  precision,
	}, nil
}

func (agg *PIResultAggregator) AddShardResult(shardIndex int, result string) error {
	agg.resultsMu.Lock()
	defer agg.resultsMu.Unlock()

	if _, exists := agg.results[shardIndex]; exists {
		return fmt.Errorf("shard %d already added", shardIndex)
	}

	if len(result) > maxShardResultSize {
		return fmt.Errorf("shard result too large: %d bytes", len(result))
	}

	agg.results[shardIndex] = result
	_, err := agg.writer.WriteString(fmt.Sprintf("%d:%s\n", shardIndex, result))
	if err != nil {
		return err
	}
	return agg.writer.Flush()
}

func (agg *PIResultAggregator) Finalize() (string, error) {
	agg.resultsMu.Lock()
	defer agg.resultsMu.Unlock()

	pi := new(big.Float).SetPrec(agg.precision)
	pi.SetFloat64(0)

	agg.writer.Flush()
	agg.tempFile.Seek(0, 0)

	reader := bufio.NewReaderSize(agg.tempFile, streamBufferSize)
	lineCount := 0

	for {
		line, err := reader.ReadString('\n')
		if err == io.EOF {
			break
		}
		if err != nil {
			return "", err
		}

		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			continue
		}

		_, err = strconv.Atoi(parts[0])
		if err != nil {
			continue
		}

		shardVal := new(big.Float).SetPrec(agg.precision)
		if _, ok := shardVal.SetString(parts[1]); ok {
			pi.Add(pi, shardVal)
			lineCount++
		}
	}

	return fmt.Sprintf("%.*f", 100, pi), nil
}

func (agg *PIResultAggregator) Close() error {
	if agg.tempFile != nil {
		agg.writer.Flush()
		agg.tempFile.Close()
		os.Remove(agg.tempFile.Name())
	}
	return nil
}

type DedupKey struct {
	TaskID     string
	ShardIndex int
	Version    uint64
}

type TaskManager struct {
	tasks          map[string]*Task
	dedup          map[DedupKey]bool
	canceled       map[DedupKey]bool
	logs           map[string][]*LogEntry
	logSubscribers map[string][]*LogSubscriber
	mu             sync.RWMutex
}

func NewTaskManager() *TaskManager {
	return &TaskManager{
		tasks:          make(map[string]*Task),
		dedup:          make(map[DedupKey]bool),
		canceled:       make(map[DedupKey]bool),
		logs:           make(map[string][]*LogEntry),
		logSubscribers: make(map[string][]*LogSubscriber),
	}
}

func (tm *TaskManager) CreateTask(taskID string, taskType proto.TaskType, params map[string]interface{}, shardCount int, priority proto.TaskPriority, affinityTags []string, antiAffinity []string, preferredNodes []string) (*Task, error) {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	shards := make([]*Shard, shardCount)
	for i := 0; i < shardCount; i++ {
		shards[i] = &Shard{
			Index:   i,
			Status:  "pending",
			Version: 1,
		}
	}

	digits := 1000
	if d, ok := params["digits"].(float64); ok {
		digits = int(d)
	}
	precision := uint(digits * 4)

	var aggregator ResultAggregator
	var err error
	switch taskType {
	case proto.TaskTypeComputePI:
		aggregator, err = NewPIResultAggregator(taskID, shardCount, precision)
		if err != nil {
			return nil, fmt.Errorf("failed to create aggregator: %w", err)
		}
	}

	task := &Task{
		ID:             taskID,
		Type:           taskType,
		Params:         params,
		Status:         "pending",
		Shards:         shards,
		CreatedAt:      time.Now(),
		aggregator:     aggregator,
		Priority:       priority,
		AffinityTags:   affinityTags,
		AntiAffinity:   antiAffinity,
		PreferredNodes: preferredNodes,
	}
	tm.tasks[taskID] = task
	tm.logs[taskID] = make([]*LogEntry, 0)

	tm.addLogEntry(taskID, -1, "master", "info", fmt.Sprintf("Task created with priority=%d, shards=%d", priority, shardCount))

	return task, nil
}

func (tm *TaskManager) addLogEntry(taskID string, shardIndex int, nodeID string, level string, message string) {
	entry := &LogEntry{
		TaskID:     taskID,
		ShardIndex: shardIndex,
		NodeID:     nodeID,
		Timestamp:  time.Now(),
		Level:      level,
		Message:    message,
	}

	if entries, exists := tm.logs[taskID]; exists {
		tm.logs[taskID] = append(entries, entry)
	}

	protoEntry := proto.TaskLogEntry{
		TaskID:     taskID,
		ShardIndex: shardIndex,
		NodeID:     nodeID,
		Timestamp:  entry.Timestamp.Unix(),
		Level:      level,
		Message:    message,
	}

	if subs, exists := tm.logSubscribers[taskID]; exists {
		for _, sub := range subs {
			if sub.Active {
				select {
				case sub.Chan <- &proto.TaskLogResponse{
					TaskID:  taskID,
					Entries: []proto.TaskLogEntry{protoEntry},
					Done:    false,
				}:
				default:
				}
			}
		}
	}
}

func (tm *TaskManager) AddTaskLog(log *proto.TaskLogEntry) {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	tm.addLogEntry(log.TaskID, log.ShardIndex, log.NodeID, log.Level, log.Message)
}

func (tm *TaskManager) GetTaskLogs(taskID string, since time.Time) []proto.TaskLogEntry {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	entries, exists := tm.logs[taskID]
	if !exists {
		return nil
	}

	var result []proto.TaskLogEntry
	for _, entry := range entries {
		if entry.Timestamp.After(since) {
			result = append(result, proto.TaskLogEntry{
				TaskID:     entry.TaskID,
				ShardIndex: entry.ShardIndex,
				NodeID:     entry.NodeID,
				Timestamp:  entry.Timestamp.Unix(),
				Level:      entry.Level,
				Message:    entry.Message,
			})
		}
	}

	return result
}

func (tm *TaskManager) SubscribeToLogs(taskID string, since time.Time, follow bool) *LogSubscriber {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	sub := &LogSubscriber{
		TaskID: taskID,
		Chan:   make(chan *proto.TaskLogResponse, 100),
		Since:  since,
		Follow: follow,
		Active: true,
	}

	tm.logSubscribers[taskID] = append(tm.logSubscribers[taskID], sub)

	entries := tm.GetTaskLogs(taskID, since)
	if len(entries) > 0 {
		sub.Chan <- &proto.TaskLogResponse{
			TaskID:  taskID,
			Entries: entries,
			Done:    !follow,
		}
	} else if !follow {
		sub.Chan <- &proto.TaskLogResponse{
			TaskID:  taskID,
			Entries: []proto.TaskLogEntry{},
			Done:    true,
		}
	}

	return sub
}

func (tm *TaskManager) UnsubscribeFromLogs(sub *LogSubscriber) {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	sub.Active = false
	if subs, exists := tm.logSubscribers[sub.TaskID]; exists {
		for i, s := range subs {
			if s == sub {
				tm.logSubscribers[sub.TaskID] = append(subs[:i], subs[i+1:]...)
				break
			}
		}
	}
	close(sub.Chan)
}

func (tm *TaskManager) IsShardProcessed(taskID string, shardIndex int, version uint64) bool {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	key := DedupKey{TaskID: taskID, ShardIndex: shardIndex, Version: version}
	return tm.dedup[key]
}

func (tm *TaskManager) IsShardCanceled(taskID string, shardIndex int, version uint64) bool {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	key := DedupKey{TaskID: taskID, ShardIndex: shardIndex, Version: version}
	return tm.canceled[key]
}

func (tm *TaskManager) GetShardVersion(taskID string, shardIndex int) (uint64, bool) {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	task, exists := tm.tasks[taskID]
	if !exists || shardIndex >= len(task.Shards) {
		return 0, false
	}
	return task.Shards[shardIndex].Version, true
}

func (tm *TaskManager) AssignShard(taskID string, shardIndex int, nodeID string) (uint64, error) {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	task, exists := tm.tasks[taskID]
	if !exists {
		return 0, fmt.Errorf("task %s not found", taskID)
	}
	if shardIndex >= len(task.Shards) {
		return 0, fmt.Errorf("shard index %d out of range", shardIndex)
	}

	shard := task.Shards[shardIndex]
	if shard.Completed {
		return shard.Version, fmt.Errorf("shard already completed")
	}

	shard.NodeID = nodeID
	shard.Status = "running"
	return shard.Version, nil
}

func (tm *TaskManager) UpdateShardProgress(taskID string, shardIndex int, progress float64, version uint64) bool {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	task, exists := tm.tasks[taskID]
	if !exists || shardIndex >= len(task.Shards) {
		return false
	}

	shard := task.Shards[shardIndex]
	if shard.Version != version {
		return false
	}
	if shard.Completed {
		return false
	}

	key := DedupKey{TaskID: taskID, ShardIndex: shardIndex, Version: version}
	if tm.canceled[key] {
		return false
	}

	shard.Progress = progress
	tm.recalculateTaskProgress(task)
	return true
}

func (tm *TaskManager) CompleteShard(taskID string, shardIndex int, result interface{}, version uint64) (bool, error) {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	task, exists := tm.tasks[taskID]
	if !exists || shardIndex >= len(task.Shards) {
		return false, fmt.Errorf("task or shard not found")
	}

	shard := task.Shards[shardIndex]

	key := DedupKey{TaskID: taskID, ShardIndex: shardIndex, Version: version}
	if tm.dedup[key] {
		return false, fmt.Errorf("duplicate shard result")
	}

	if shard.Version != version && shard.Completed {
		return false, fmt.Errorf("stale version, current: %d, got: %d", shard.Version, version)
	}

	if tm.canceled[key] {
		return false, fmt.Errorf("shard canceled")
	}

	if shard.Version != version {
		shard.Version = version
	}

	shard.Completed = true
	shard.Status = "completed"
	shard.Result = result
	shard.Progress = 100.0
	tm.dedup[key] = true

	if resultStr, ok := result.(string); ok {
		if task.aggregator != nil {
			if err := task.aggregator.AddShardResult(shardIndex, resultStr); err != nil {
				fmt.Printf("Failed to add shard result to aggregator: %v\n", err)
			}
		}
	}

	tm.recalculateTaskProgress(task)

	if tm.allShardsCompleted(task) {
		task.Status = "completed"
		task.CompletedAt = time.Now()

		if task.aggregator != nil {
			finalResult, err := task.aggregator.Finalize()
			if err != nil {
				fmt.Printf("Failed to finalize aggregation: %v\n", err)
			} else {
				task.Result = finalResult
			}
			task.aggregator.Close()
		}
	}

	return true, nil
}

func (tm *TaskManager) GetShardsForNode(nodeID string) []struct{ TaskID string; ShardIndex int; Version uint64 } {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	var shards []struct{ TaskID string; ShardIndex int; Version uint64 }

	for taskID, task := range tm.tasks {
		for _, shard := range task.Shards {
			if shard.NodeID == nodeID && !shard.Completed {
				shards = append(shards, struct{ TaskID string; ShardIndex int; Version uint64 }{
					TaskID:     taskID,
					ShardIndex: shard.Index,
					Version:    shard.Version,
				})
			}
		}
	}

	return shards
}

func (tm *TaskManager) ReassignShardsForNode(nodeID string) []struct{ TaskID string; ShardIndex int; OldVersion uint64; OldNodeID string } {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	var reassigned []struct{ TaskID string; ShardIndex int; OldVersion uint64; OldNodeID string }

	for taskID, task := range tm.tasks {
		for _, shard := range task.Shards {
			if shard.NodeID == nodeID && !shard.Completed {
				oldVersion := shard.Version
				oldNodeID := shard.NodeID

				key := DedupKey{TaskID: taskID, ShardIndex: shard.Index, Version: oldVersion}
				tm.canceled[key] = true

				shard.Version++
				shard.NodeID = ""
				shard.Status = "pending"
				shard.Progress = 0

				tm.addLogEntry(taskID, shard.Index, "master", "warn", 
					fmt.Sprintf("Reassigning shard from node %s (offline), old version=%d, new version=%d", 
						oldNodeID, oldVersion, shard.Version))

				reassigned = append(reassigned, struct{ TaskID string; ShardIndex int; OldVersion uint64; OldNodeID string }{
					TaskID:     taskID,
					ShardIndex: shard.Index,
					OldVersion: oldVersion,
					OldNodeID:  oldNodeID,
				})
			}
		}
	}

	return reassigned
}

func (tm *TaskManager) GetCanceledShards() []proto.TaskCancel {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	var canceled []proto.TaskCancel
	for key := range tm.canceled {
		canceled = append(canceled, proto.TaskCancel{
			TaskID:     key.TaskID,
			ShardIndex: key.ShardIndex,
			Version:    key.Version,
			Reason:     "node_reassigned",
		})
	}
	return canceled
}

func (tm *TaskManager) ClearCanceledShard(taskID string, shardIndex int, version uint64) {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	key := DedupKey{TaskID: taskID, ShardIndex: shardIndex, Version: version}
	delete(tm.canceled, key)
}

func (tm *TaskManager) GetPendingShardsByPriority() PriorityQueue {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	pq := make(PriorityQueue, 0)

	for taskID, task := range tm.tasks {
		for _, shard := range task.Shards {
			if shard.Status == "pending" {
				item := &PendingShard{
					TaskID:       taskID,
					ShardIndex:   shard.Index,
					Params:       task.Params,
					TaskType:     task.Type,
					ShardTotal:   len(task.Shards),
					Version:      shard.Version,
					Priority:     task.Priority,
					AffinityTags: task.AffinityTags,
				}
				pq.Push(item)
			}
		}
	}

	sort.Sort(pq)
	return pq
}

func (tm *TaskManager) CheckAffinityMatch(task *Task, nodeTags []string, nodeID string) bool {
	for _, antiTag := range task.AntiAffinity {
		for _, nodeTag := range nodeTags {
			if antiTag == nodeTag {
				return false
			}
		}
	}

	for _, preferred := range task.PreferredNodes {
		if preferred == nodeID {
			return true
		}
	}

	if len(task.AffinityTags) > 0 {
		hasMatch := false
		for _, affinityTag := range task.AffinityTags {
			for _, nodeTag := range nodeTags {
				if affinityTag == nodeTag {
					hasMatch = true
					break
				}
			}
		}
		if !hasMatch && len(task.PreferredNodes) == 0 {
			return false
		}
	}

	return true
}

func (tm *TaskManager) GetSchedulableShards(nodeID string, nodeTags []string) PriorityQueue {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	pq := make(PriorityQueue, 0)

	for taskID, task := range tm.tasks {
		if !tm.CheckAffinityMatch(task, nodeTags, nodeID) {
			continue
		}

		for _, shard := range task.Shards {
			if shard.Status == "pending" {
				item := &PendingShard{
					TaskID:       taskID,
					ShardIndex:   shard.Index,
					Params:       task.Params,
					TaskType:     task.Type,
					ShardTotal:   len(task.Shards),
					Version:      shard.Version,
					Priority:     task.Priority,
					AffinityTags: task.AffinityTags,
				}
				pq.Push(item)
			}
		}
	}

	sort.Sort(pq)
	return pq
}

func (tm *TaskManager) GetTask(taskID string) (*Task, bool) {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	task, exists := tm.tasks[taskID]
	return task, exists
}

func (tm *TaskManager) GetAllTasks() []*Task {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	tasks := make([]*Task, 0, len(tm.tasks))
	for _, task := range tm.tasks {
		tasks = append(tasks, task)
	}

	sort.Slice(tasks, func(i, j int) bool {
		return tasks[i].CreatedAt.After(tasks[j].CreatedAt)
	})

	return tasks
}

func (tm *TaskManager) recalculateTaskProgress(task *Task) {
	if len(task.Shards) == 0 {
		task.Progress = 0
		return
	}

	totalProgress := 0.0
	for _, shard := range task.Shards {
		totalProgress += shard.Progress
	}
	task.Progress = totalProgress / float64(len(task.Shards))
}

func (tm *TaskManager) allShardsCompleted(task *Task) bool {
	for _, shard := range task.Shards {
		if !shard.Completed {
			return false
		}
	}
	return true
}

func (tm *TaskManager) ToTaskUpdate(taskID string) *proto.TaskUpdate {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	task, exists := tm.tasks[taskID]
	if !exists {
		return nil
	}

	shards := make([]proto.ShardInfo, len(task.Shards))
	for i, shard := range task.Shards {
		shards[i] = proto.ShardInfo{
			Index:     shard.Index,
			NodeID:    shard.NodeID,
			Status:    shard.Status,
			Progress:  shard.Progress,
			Completed: shard.Completed,
			Version:   shard.Version,
		}
	}

	return &proto.TaskUpdate{
		TaskID:   task.ID,
		Status:   task.Status,
		Progress: task.Progress,
		Result:   task.Result,
		Shards:   shards,
	}
}

func (tm *TaskManager) ToTaskSummaries() []proto.TaskSummary {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	summaries := make([]proto.TaskSummary, 0, len(tm.tasks))
	for _, task := range tm.tasks {
		summaries = append(summaries, proto.TaskSummary{
			ID:        task.ID,
			Type:      task.Type,
			Status:    task.Status,
			Progress:  task.Progress,
			CreatedAt: task.CreatedAt.Unix(),
			Priority:  task.Priority,
		})
	}

	sort.Slice(summaries, func(i, j int) bool {
		if summaries[i].Priority != summaries[j].Priority {
			return summaries[i].Priority > summaries[j].Priority
		}
		return summaries[i].CreatedAt > summaries[j].CreatedAt
	})

	return summaries
}

func (tm *TaskManager) CleanupOldDedupEntries(maxAge time.Duration) {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	for key := range tm.dedup {
		task, exists := tm.tasks[key.TaskID]
		if !exists {
			delete(tm.dedup, key)
			continue
		}
		if time.Since(task.CompletedAt) > maxAge {
			delete(tm.dedup, key)
		}
	}
}
