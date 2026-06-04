package main

import (
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/csi-mock-driver/pkg/driver"
	"github.com/csi-mock-driver/pkg/store"
	"k8s.io/klog/v2"
)

var (
	endpoint = flag.String("endpoint", "0.0.0.0:10000", "CSI driver endpoint")
	nodeID   = flag.String("nodeid", "mock-node", "Node ID")
	httpAddr = flag.String("http-addr", "0.0.0.0:8080", "HTTP API server address")
)

type apiServer struct {
	driver *driver.Driver
	store  *store.Store
}

type VolumeResponse struct {
	ID            string                     `json:"id"`
	Name          string                     `json:"name"`
	SizeBytes     int64                      `json:"sizeBytes"`
	BlockCount    int                        `json:"blockCount"`
	ContentSource *store.VolumeContentSource `json:"contentSource"`
	Status        string                     `json:"status"`
	CreatedAt     string                     `json:"createdAt"`
}

type SnapshotResponse struct {
	ID             string   `json:"id"`
	Name           string   `json:"name"`
	SourceVolumeID string   `json:"sourceVolumeId"`
	ParentID       string   `json:"parentId"`
	ChildIDs       []string `json:"childIds"`
	SizeBytes      int64    `json:"sizeBytes"`
	BlockCount     int      `json:"blockCount"`
	ChangedBlocks  int      `json:"changedBlocks"`
	Checksum       string   `json:"checksum"`
	Status         string   `json:"status"`
	CreationTime   string   `json:"creationTime"`
	ReadyToUse     bool     `json:"readyToUse"`
	IsIncremental  bool     `json:"isIncremental"`
	ChainLength    int      `json:"chainLength"`
}

type ChecksumResponse struct {
	Valid           bool   `json:"valid"`
	StoredChecksum  string `json:"storedChecksum"`
	CurrentChecksum string `json:"currentChecksum"`
}

type WriteBlockRequest struct {
	VolumeID   string `json:"volumeId"`
	BlockIndex int    `json:"blockIndex"`
	Data       string `json:"data"`
}

func (s *apiServer) listVolumes(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	vols := s.store.ListVolumes()
	response := make([]VolumeResponse, len(vols))
	for i, v := range vols {
		response[i] = VolumeResponse{
			ID:            v.ID,
			Name:          v.Name,
			SizeBytes:     v.SizeBytes,
			BlockCount:    v.BlockCount,
			ContentSource: v.ContentSource,
			Status:        v.Status,
			CreatedAt:     v.CreatedAt.String(),
		}
	}
	json.NewEncoder(w).Encode(response)
}

func (s *apiServer) listSnapshots(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	snaps := s.store.ListSnapshots()
	response := make([]SnapshotResponse, len(snaps))
	for i, snap := range snaps {
		changedBlocks := 0
		if snap.ChangedBitmap != nil {
			changedBlocks = snap.ChangedBitmap.Count()
		}
		response[i] = SnapshotResponse{
			ID:             snap.ID,
			Name:           snap.Name,
			SourceVolumeID: snap.SourceVolumeID,
			ParentID:       snap.ParentID,
			ChildIDs:       snap.ChildIDs,
			SizeBytes:      snap.SizeBytes,
			BlockCount:     snap.BlockCount,
			ChangedBlocks:  changedBlocks,
			Checksum:       snap.Checksum,
			Status:         snap.Status,
			CreationTime:   snap.CreationTime.String(),
			ReadyToUse:     snap.ReadyToUse,
			IsIncremental:  snap.IsIncremental,
			ChainLength:    snap.ChainLength,
		}
	}
	json.NewEncoder(w).Encode(response)
}

func (s *apiServer) verifyChecksum(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		return
	}

	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		SnapshotID string `json:"snapshotId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	valid, stored, current := s.store.VerifySnapshotChecksum(req.SnapshotID)
	json.NewEncoder(w).Encode(ChecksumResponse{
		Valid:           valid,
		StoredChecksum:  stored,
		CurrentChecksum: current,
	})
}

func (s *apiServer) getSnapshotChain(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	snapshotID := r.URL.Query().Get("id")
	if snapshotID == "" {
		http.Error(w, "id parameter required", http.StatusBadRequest)
		return
	}

	chain := s.store.GetSnapshotChain(snapshotID)
	response := make([]SnapshotResponse, len(chain))
	for i, snap := range chain {
		changedBlocks := 0
		if snap.ChangedBitmap != nil {
			changedBlocks = snap.ChangedBitmap.Count()
		}
		response[i] = SnapshotResponse{
			ID:             snap.ID,
			Name:           snap.Name,
			SourceVolumeID: snap.SourceVolumeID,
			ParentID:       snap.ParentID,
			ChildIDs:       snap.ChildIDs,
			SizeBytes:      snap.SizeBytes,
			BlockCount:     snap.BlockCount,
			ChangedBlocks:  changedBlocks,
			Checksum:       snap.Checksum,
			Status:         snap.Status,
			CreationTime:   snap.CreationTime.String(),
			ReadyToUse:     snap.ReadyToUse,
			IsIncremental:  snap.IsIncremental,
			ChainLength:    snap.ChainLength,
		}
	}
	json.NewEncoder(w).Encode(response)
}

func (s *apiServer) writeBlock(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		return
	}

	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req WriteBlockRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	data, err := hex.DecodeString(req.Data)
	if err != nil {
		http.Error(w, "Invalid hex data", http.StatusBadRequest)
		return
	}

	var block store.Block
	copy(block[:], data)

	success := s.store.WriteBlock(req.VolumeID, req.BlockIndex, &block)
	json.NewEncoder(w).Encode(map[string]bool{"success": success})
}

func (s *apiServer) createFullSnapshot(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		return
	}

	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Name           string `json:"name"`
		SourceVolumeID string `json:"sourceVolumeId"`
		SizeBytes      int64  `json:"sizeBytes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	snapID := "snap-" + req.Name
	if req.SizeBytes == 0 {
		vol := s.store.GetVolume(req.SourceVolumeID)
		if vol != nil {
			req.SizeBytes = vol.SizeBytes
		}
	}

	snap := s.store.CreateFullSnapshot(snapID, req.Name, req.SourceVolumeID, req.SizeBytes)
	if snap == nil {
		http.Error(w, "Failed to create snapshot", http.StatusInternalServerError)
		return
	}

	changedBlocks := 0
	if snap.ChangedBitmap != nil {
		changedBlocks = snap.ChangedBitmap.Count()
	}

	json.NewEncoder(w).Encode(SnapshotResponse{
		ID:             snap.ID,
		Name:           snap.Name,
		SourceVolumeID: snap.SourceVolumeID,
		ParentID:       snap.ParentID,
		ChildIDs:       snap.ChildIDs,
		SizeBytes:      snap.SizeBytes,
		BlockCount:     snap.BlockCount,
		ChangedBlocks:  changedBlocks,
		Checksum:       snap.Checksum,
		Status:         snap.Status,
		CreationTime:   snap.CreationTime.String(),
		ReadyToUse:     snap.ReadyToUse,
		IsIncremental:  snap.IsIncremental,
		ChainLength:    snap.ChainLength,
	})
}

func (s *apiServer) createIncrementalSnapshot(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		return
	}

	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Name             string `json:"name"`
		SourceVolumeID   string `json:"sourceVolumeId"`
		ParentSnapshotID string `json:"parentSnapshotId"`
		SizeBytes        int64  `json:"sizeBytes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	snapID := "snap-" + req.Name
	if req.SizeBytes == 0 {
		vol := s.store.GetVolume(req.SourceVolumeID)
		if vol != nil {
			req.SizeBytes = vol.SizeBytes
		}
	}

	snap := s.store.CreateIncrementalSnapshot(snapID, req.Name, req.SourceVolumeID, req.ParentSnapshotID, req.SizeBytes)
	if snap == nil {
		http.Error(w, "Failed to create incremental snapshot", http.StatusInternalServerError)
		return
	}

	changedBlocks := 0
	if snap.ChangedBitmap != nil {
		changedBlocks = snap.ChangedBitmap.Count()
	}

	json.NewEncoder(w).Encode(SnapshotResponse{
		ID:             snap.ID,
		Name:           snap.Name,
		SourceVolumeID: snap.SourceVolumeID,
		ParentID:       snap.ParentID,
		ChildIDs:       snap.ChildIDs,
		SizeBytes:      snap.SizeBytes,
		BlockCount:     snap.BlockCount,
		ChangedBlocks:  changedBlocks,
		Checksum:       snap.Checksum,
		Status:         snap.Status,
		CreationTime:   snap.CreationTime.String(),
		ReadyToUse:     snap.ReadyToUse,
		IsIncremental:  snap.IsIncremental,
		ChainLength:    snap.ChainLength,
	})
}

type CloneVolumeRequest struct {
	SourceVolumeID string `json:"sourceVolumeId"`
	TargetName     string `json:"targetName"`
}

func (s *apiServer) cloneVolume(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	var req CloneVolumeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	targetID := "vol-clone-" + req.TargetName
	vol, err := s.store.CloneVolume(req.SourceVolumeID, targetID, req.TargetName)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(VolumeResponse{
		ID:            vol.ID,
		Name:          vol.Name,
		SizeBytes:     vol.SizeBytes,
		BlockCount:    vol.BlockCount,
		ContentSource: vol.ContentSource,
		Status:        vol.Status,
		CreatedAt:     vol.CreatedAt.String(),
	})
}

type SnapshotSpaceStatsResponse struct {
	TotalSize         int64                         `json:"totalSize"`
	LogicalSize       int64                         `json:"logicalSize"`
	UniqueSize        int64                         `json:"uniqueSize"`
	FullSnapshotCount int                           `json:"fullSnapshotCount"`
	IncrementalCount  int                           `json:"incrementalCount"`
	SavingPercent     float64                       `json:"savingPercent"`
	Details           []SnapshotSpaceDetailResponse `json:"details"`
}

type SnapshotSpaceDetailResponse struct {
	SnapshotID    string  `json:"snapshotId"`
	SnapshotName  string  `json:"snapshotName"`
	IsIncremental bool    `json:"isIncremental"`
	BlockCount    int     `json:"blockCount"`
	SizeBytes     int64   `json:"sizeBytes"`
	UniqueBytes   int64   `json:"uniqueBytes"`
	ChangeRate    float64 `json:"changeRate"`
}

func (s *apiServer) getSnapshotSpaceStats(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	snapshotID := r.URL.Query().Get("id")
	var stats *store.SnapshotSpaceStats

	if snapshotID != "" {
		stats = s.store.GetSnapshotSpaceStats(snapshotID)
	} else {
		stats = s.store.GetAllSnapshotsSpaceStats()
	}

	if stats == nil {
		http.Error(w, "Snapshot not found", http.StatusNotFound)
		return
	}

	details := make([]SnapshotSpaceDetailResponse, len(stats.Details))
	for i, d := range stats.Details {
		details[i] = SnapshotSpaceDetailResponse{
			SnapshotID:    d.SnapshotID,
			SnapshotName:  d.SnapshotName,
			IsIncremental: d.IsIncremental,
			BlockCount:    d.BlockCount,
			SizeBytes:     d.SizeBytes,
			UniqueBytes:   d.UniqueBytes,
			ChangeRate:    d.ChangeRate,
		}
	}

	savingPercent := 0.0
	if stats.LogicalSize > 0 {
		savingPercent = float64(stats.LogicalSize-stats.UniqueSize) / float64(stats.LogicalSize) * 100
	}

	json.NewEncoder(w).Encode(SnapshotSpaceStatsResponse{
		TotalSize:         stats.TotalSize,
		LogicalSize:       stats.LogicalSize,
		UniqueSize:        stats.UniqueSize,
		FullSnapshotCount: stats.FullSnapshotCount,
		IncrementalCount:  stats.IncrementalCount,
		SavingPercent:     savingPercent,
		Details:           details,
	})
}

func (s *apiServer) serveFrontend(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	http.FileServer(http.Dir("./frontend")).ServeHTTP(w, r)
}

func main() {
	klog.InitFlags(nil)
	flag.Parse()

	opts := &driver.Options{
		Endpoint:   *endpoint,
		NodeID:     *nodeID,
		MaxVolumes: 100,
	}

	d := driver.NewDriver(opts)
	if err := d.Run(); err != nil {
		klog.Fatalf("Failed to run driver: %v", err)
	}
	defer d.Stop()

	api := &apiServer{
		driver: d,
		store:  d.GetStore(),
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/volumes", api.listVolumes)
	mux.HandleFunc("/api/snapshots", api.listSnapshots)
	mux.HandleFunc("/api/snapshot/verify-checksum", api.verifyChecksum)
	mux.HandleFunc("/api/snapshot/chain", api.getSnapshotChain)
	mux.HandleFunc("/api/snapshot/space-stats", api.getSnapshotSpaceStats)
	mux.HandleFunc("/api/snapshot/create-full", api.createFullSnapshot)
	mux.HandleFunc("/api/snapshot/create-incremental", api.createIncrementalSnapshot)
	mux.HandleFunc("/api/volume/clone", api.cloneVolume)
	mux.HandleFunc("/api/volume/write-block", api.writeBlock)
	mux.HandleFunc("/", api.serveFrontend)

	httpServer := &http.Server{
		Addr:    *httpAddr,
		Handler: mux,
	}

	go func() {
		klog.Infof("HTTP API server starting on %s", *httpAddr)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			klog.Fatalf("HTTP server error: %v", err)
		}
	}()
	defer httpServer.Close()

	fmt.Println("\n========================================")
	fmt.Println("CSI Mock Driver is running!")
	fmt.Printf("CSI gRPC endpoint: %s\n", *endpoint)
	fmt.Printf("HTTP API endpoint: http://%s\n", *httpAddr)
	fmt.Println("========================================")
	fmt.Println("\nAPI Endpoints:")
	fmt.Println("  GET  /api/volumes                    - List all volumes")
	fmt.Println("  GET  /api/snapshots                  - List all snapshots")
	fmt.Println("  POST /api/snapshot/verify-checksum   - Verify snapshot checksum")
	fmt.Println("  GET  /api/snapshot/chain?id=...      - Get snapshot chain")
	fmt.Println("  GET  /api/snapshot/space-stats       - Get snapshot space stats (all or by id)")
	fmt.Println("  POST /api/snapshot/create-full       - Create full snapshot")
	fmt.Println("  POST /api/snapshot/create-incremental - Create incremental snapshot")
	fmt.Println("  POST /api/volume/clone               - Clone volume")
	fmt.Println("  POST /api/volume/write-block         - Write block to volume")
	fmt.Println("  GET  /                               - Web UI")
	fmt.Println("\nPress Ctrl+C to exit...")

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	klog.Info("Shutting down CSI Mock Driver...")
}
