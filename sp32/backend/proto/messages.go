package proto

import "encoding/json"

type MessageType string

const (
	MsgTypeRegister        MessageType = "register"
	MsgTypeRegisterResp    MessageType = "register_resp"
	MsgTypeHeartbeat       MessageType = "heartbeat"
	MsgTypeHeartbeatResp   MessageType = "heartbeat_resp"
	MsgTypeTaskAssign      MessageType = "task_assign"
	MsgTypeTaskProgress    MessageType = "task_progress"
	MsgTypeTaskComplete    MessageType = "task_complete"
	MsgTypeTaskResult      MessageType = "task_result"
	MsgTypeNodeStatus      MessageType = "node_status"
	MsgTypeNodeOffline     MessageType = "node_offline"
	MsgTypeFrontendConnect MessageType = "frontend_connect"
	MsgTypeSubmitTask      MessageType = "submit_task"
	MsgTypeTaskUpdate      MessageType = "task_update"
	MsgTypeClusterStatus   MessageType = "cluster_status"
	MsgTypeTaskCancel      MessageType = "task_cancel"
	MsgTypeShardAck        MessageType = "shard_ack"
	MsgTypeTaskLog         MessageType = "task_log"
	MsgTypeTaskLogRequest  MessageType = "task_log_request"
)

type TaskPriority int

const (
	PriorityLow    TaskPriority = 0
	PriorityNormal TaskPriority = 1
	PriorityHigh   TaskPriority = 2
	PriorityUrgent TaskPriority = 3
)

type Message struct {
	Type    MessageType     `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

type RegisterRequest struct {
	NodeID   string `json:"node_id"`
	Hostname string `json:"hostname"`
}

type RegisterResponse struct {
	Success bool   `json:"success"`
	NodeID  string `json:"node_id"`
	Message string `json:"message"`
}

type Heartbeat struct {
	NodeID    string  `json:"node_id"`
	Timestamp int64   `json:"timestamp"`
	CPUUsage  float64 `json:"cpu_usage"`
	MemUsage  float64 `json:"mem_usage"`
	TaskCount int     `json:"task_count"`
}

type HeartbeatResponse struct {
	Success   bool  `json:"success"`
	Timestamp int64 `json:"timestamp"`
}

type TaskType string

const (
	TaskTypeComputePI TaskType = "compute_pi"
)

type Task struct {
	ID             string                 `json:"id"`
	Type           TaskType               `json:"type"`
	Params         map[string]interface{} `json:"params"`
	Status         string                 `json:"status"`
	Progress       float64                `json:"progress"`
	Result         interface{}            `json:"result"`
	AssignedTo     string                 `json:"assigned_to"`
	CreatedAt      int64                  `json:"created_at"`
	Priority       TaskPriority           `json:"priority"`
	AffinityTags   []string               `json:"affinity_tags"`
	AntiAffinity   []string               `json:"anti_affinity"`
	PreferredNodes []string               `json:"preferred_nodes"`
}

type TaskAssign struct {
	TaskID       string                 `json:"task_id"`
	TaskType     TaskType               `json:"task_type"`
	Params       map[string]interface{} `json:"params"`
	ShardIndex   int                    `json:"shard_index"`
	ShardTotal   int                    `json:"shard_total"`
	Version      uint64                 `json:"version"`
	Priority     TaskPriority           `json:"priority"`
	AffinityTags []string               `json:"affinity_tags"`
}

type TaskProgressUpdate struct {
	TaskID     string  `json:"task_id"`
	ShardIndex int     `json:"shard_index"`
	Progress   float64 `json:"progress"`
	NodeID     string  `json:"node_id"`
	Version    uint64  `json:"version"`
}

type TaskCompleteMsg struct {
	TaskID     string      `json:"task_id"`
	ShardIndex int         `json:"shard_index"`
	Result     interface{} `json:"result"`
	Success    bool        `json:"success"`
	Error      string      `json:"error"`
	NodeID     string      `json:"node_id"`
	Version    uint64      `json:"version"`
}

type TaskCancel struct {
	TaskID     string `json:"task_id"`
	ShardIndex int    `json:"shard_index"`
	Version    uint64 `json:"version"`
	Reason     string `json:"reason"`
}

type ShardAck struct {
	TaskID     string `json:"task_id"`
	ShardIndex int    `json:"shard_index"`
	NodeID     string `json:"node_id"`
	Version    uint64 `json:"version"`
}

type NodeStatus struct {
	NodeID    string   `json:"node_id"`
	Hostname  string   `json:"hostname"`
	Status    string   `json:"status"`
	CPUUsage  float64  `json:"cpu_usage"`
	MemUsage  float64  `json:"mem_usage"`
	TaskCount int      `json:"task_count"`
	LastSeen  int64    `json:"last_seen"`
	Tags      []string `json:"tags"`
}

type SubmitTaskRequest struct {
	Type           TaskType               `json:"type"`
	Params         map[string]interface{} `json:"params"`
	Priority       TaskPriority           `json:"priority"`
	AffinityTags   []string               `json:"affinity_tags"`
	AntiAffinity   []string               `json:"anti_affinity"`
	PreferredNodes []string               `json:"preferred_nodes"`
}

type TaskLogEntry struct {
	TaskID     string `json:"task_id"`
	ShardIndex int    `json:"shard_index"`
	NodeID     string `json:"node_id"`
	Timestamp  int64  `json:"timestamp"`
	Level      string `json:"level"`
	Message    string `json:"message"`
}

type TaskLogRequest struct {
	TaskID    string `json:"task_id"`
	Follow    bool   `json:"follow"`
	SinceTime int64  `json:"since_time"`
}

type TaskLogResponse struct {
	TaskID  string         `json:"task_id"`
	Entries []TaskLogEntry `json:"entries"`
	Done    bool           `json:"done"`
}

type SubmitTaskResponse struct {
	Success bool   `json:"success"`
	TaskID  string `json:"task_id"`
	Message string `json:"message"`
}

type TaskUpdate struct {
	TaskID   string      `json:"task_id"`
	Status   string      `json:"status"`
	Progress float64     `json:"progress"`
	Result   interface{} `json:"result"`
	Shards   []ShardInfo `json:"shards"`
}

type ShardInfo struct {
	Index     int     `json:"index"`
	NodeID    string  `json:"node_id"`
	Status    string  `json:"status"`
	Progress  float64 `json:"progress"`
	Completed bool    `json:"completed"`
	Version   uint64  `json:"version"`
}

type ClusterStatusUpdate struct {
	Nodes      []NodeStatus   `json:"nodes"`
	Tasks      []TaskSummary  `json:"tasks"`
	Timestamp  int64          `json:"timestamp"`
}

type TaskSummary struct {
	ID        string       `json:"id"`
	Type      TaskType     `json:"type"`
	Status    string       `json:"status"`
	Progress  float64      `json:"progress"`
	CreatedAt int64        `json:"created_at"`
	Priority  TaskPriority `json:"priority"`
}

func EncodeMessage(msgType MessageType, payload interface{}) ([]byte, error) {
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	msg := Message{
		Type:    msgType,
		Payload: payloadBytes,
	}
	return json.Marshal(msg)
}

func DecodeMessage(data []byte) (MessageType, json.RawMessage, error) {
	var msg Message
	if err := json.Unmarshal(data, &msg); err != nil {
		return "", nil, err
	}
	return msg.Type, msg.Payload, nil
}
