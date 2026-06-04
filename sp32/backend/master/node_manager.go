package main

import (
	"compute-cluster/proto"
	"sync"
	"time"
)

const (
	HeartbeatTimeout = 5 * time.Second
)

type Node struct {
	ID        string
	Hostname  string
	Status    string
	CPUUsage  float64
	MemUsage  float64
	TaskCount int
	LastSeen  time.Time
	SendChan  chan []byte
	Tags      []string
	mu        sync.RWMutex
}

type NodeManager struct {
	nodes map[string]*Node
	mu    sync.RWMutex
}

func NewNodeManager() *NodeManager {
	return &NodeManager{
		nodes: make(map[string]*Node),
	}
}

func (nm *NodeManager) AddNode(nodeID, hostname string, sendChan chan []byte) *Node {
	nm.mu.Lock()
	defer nm.mu.Unlock()

	tags := generateNodeTags(nodeID, hostname)

	node := &Node{
		ID:       nodeID,
		Hostname: hostname,
		Status:   "online",
		LastSeen: time.Now(),
		SendChan: sendChan,
		Tags:     tags,
	}
	nm.nodes[nodeID] = node
	return node
}

func generateNodeTags(nodeID, hostname string) []string {
	tags := []string{"all"}

	if len(nodeID) > 0 {
		prefix := nodeID[:4]
		if prefix == "comp" {
			tags = append(tags, "compute")
		}
	}

	hash := 0
	for _, c := range nodeID {
		hash = (hash + int(c)) % 3
	}
	zoneTags := []string{"zone-a", "zone-b", "zone-c"}
	tags = append(tags, zoneTags[hash])

	if hash == 0 {
		tags = append(tags, "high-mem")
	}

	return tags
}

func (nm *NodeManager) RemoveNode(nodeID string) {
	nm.mu.Lock()
	defer nm.mu.Unlock()

	if node, exists := nm.nodes[nodeID]; exists {
		close(node.SendChan)
		delete(nm.nodes, nodeID)
	}
}

func (nm *NodeManager) UpdateHeartbeat(hb *proto.Heartbeat) {
	nm.mu.Lock()
	defer nm.mu.Unlock()

	if node, exists := nm.nodes[hb.NodeID]; exists {
		node.CPUUsage = hb.CPUUsage
		node.MemUsage = hb.MemUsage
		node.TaskCount = hb.TaskCount
		node.LastSeen = time.Now()
		node.Status = "online"
	}
}

func (nm *NodeManager) GetNode(nodeID string) (*Node, bool) {
	nm.mu.RLock()
	defer nm.mu.RUnlock()

	node, exists := nm.nodes[nodeID]
	return node, exists
}

func (nm *NodeManager) GetAllNodes() []*Node {
	nm.mu.RLock()
	defer nm.mu.RUnlock()

	nodes := make([]*Node, 0, len(nm.nodes))
	for _, node := range nm.nodes {
		nodes = append(nodes, node)
	}
	return nodes
}

func (nm *NodeManager) GetOnlineNodes() []*Node {
	nm.mu.RLock()
	defer nm.mu.RUnlock()

	nodes := make([]*Node, 0)
	for _, node := range nm.nodes {
		if node.Status == "online" {
			nodes = append(nodes, node)
		}
	}
	return nodes
}

func (nm *NodeManager) CheckHeartbeats() []string {
	nm.mu.Lock()
	defer nm.mu.Unlock()

	var offlineNodes []string
	now := time.Now()

	for id, node := range nm.nodes {
		if node.Status == "online" && now.Sub(node.LastSeen) > HeartbeatTimeout {
			node.Status = "offline"
			offlineNodes = append(offlineNodes, id)
		}
	}

	return offlineNodes
}

func (nm *NodeManager) ToProtoStatus() []proto.NodeStatus {
	nm.mu.RLock()
	defer nm.mu.RUnlock()

	statuses := make([]proto.NodeStatus, 0, len(nm.nodes))
	for _, node := range nm.nodes {
		statuses = append(statuses, proto.NodeStatus{
			NodeID:    node.ID,
			Hostname:  node.Hostname,
			Status:    node.Status,
			CPUUsage:  node.CPUUsage,
			MemUsage:  node.MemUsage,
			TaskCount: node.TaskCount,
			LastSeen:  node.LastSeen.Unix(),
			Tags:      node.Tags,
		})
	}
	return statuses
}
