package store

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sync"
	"time"
)

const (
	BlockSize = 4096
)

type Block [BlockSize]byte

type Volume struct {
	ID            string
	Name          string
	SizeBytes     int64
	BlockCount    int
	Blocks        map[int]*Block
	ContentSource *VolumeContentSource
	Status        string
	CreatedAt     time.Time
}

type VolumeContentSource struct {
	SnapshotID    string
	VolumeCloneID string
}

type Bitmap struct {
	bits []uint64
	size int
}

func NewBitmap(size int) *Bitmap {
	numWords := (size + 63) / 64
	return &Bitmap{
		bits: make([]uint64, numWords),
		size: size,
	}
}

func (b *Bitmap) Set(pos int) {
	if pos >= b.size {
		return
	}
	word := pos / 64
	bit := pos % 64
	b.bits[word] |= 1 << bit
}

func (b *Bitmap) Clear(pos int) {
	if pos >= b.size {
		return
	}
	word := pos / 64
	bit := pos % 64
	b.bits[word] &^= 1 << bit
}

func (b *Bitmap) Test(pos int) bool {
	if pos >= b.size {
		return false
	}
	word := pos / 64
	bit := pos % 64
	return (b.bits[word] & (1 << bit)) != 0
}

func (b *Bitmap) Count() int {
	count := 0
	for _, word := range b.bits {
		for word != 0 {
			count += int(word & 1)
			word >>= 1
		}
	}
	return count
}

func (b *Bitmap) Bytes() []byte {
	result := make([]byte, len(b.bits)*8)
	for i, word := range b.bits {
		for j := 0; j < 8; j++ {
			result[i*8+j] = byte(word >> (j * 8))
		}
	}
	return result
}

func (b *Bitmap) GetChangedBlocks() []int {
	var changed []int
	for i := 0; i < b.size; i++ {
		if b.Test(i) {
			changed = append(changed, i)
		}
	}
	return changed
}

type Snapshot struct {
	ID             string
	Name           string
	SourceVolumeID string
	ParentID       string
	ChildIDs       []string
	SizeBytes      int64
	BlockCount     int
	Blocks         map[int]*Block
	ChangedBitmap  *Bitmap
	Checksum       string
	Status         string
	CreationTime   time.Time
	ReadyToUse     bool
	IsIncremental  bool
	ChainLength    int
}

type Store struct {
	mu        sync.RWMutex
	volumes   map[string]*Volume
	snapshots map[string]*Snapshot
}

func NewStore() *Store {
	return &Store{
		volumes:   make(map[string]*Volume),
		snapshots: make(map[string]*Snapshot),
	}
}

func calculateBlockChecksum(block *Block) string {
	hash := sha256.Sum256(block[:])
	return hex.EncodeToString(hash[:])
}

func calculateSnapshotChecksum(snap *Snapshot) string {
	h := sha256.New()
	for i := 0; i < snap.BlockCount; i++ {
		if block, ok := snap.Blocks[i]; ok {
			h.Write(block[:])
		}
	}
	return hex.EncodeToString(h.Sum(nil))
}

func (s *Store) CreateVolume(id, name string, sizeBytes int64, contentSource *VolumeContentSource) *Volume {
	s.mu.Lock()
	defer s.mu.Unlock()

	blockCount := int((sizeBytes + BlockSize - 1) / BlockSize)
	blocks := make(map[int]*Block)

	for i := 0; i < blockCount; i++ {
		blocks[i] = &Block{}
	}

	vol := &Volume{
		ID:            id,
		Name:          name,
		SizeBytes:     sizeBytes,
		BlockCount:    blockCount,
		Blocks:        blocks,
		ContentSource: contentSource,
		Status:        "available",
		CreatedAt:     time.Now(),
	}
	s.volumes[id] = vol
	return vol
}

func (s *Store) DeleteVolume(id string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.volumes[id]; !exists {
		return false
	}
	delete(s.volumes, id)
	return true
}

func (s *Store) GetVolume(id string) *Volume {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return s.volumes[id]
}

func (s *Store) GetVolumeByName(name string) *Volume {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, vol := range s.volumes {
		if vol.Name == name {
			return vol
		}
	}
	return nil
}

func (s *Store) ListVolumes() []*Volume {
	s.mu.RLock()
	defer s.mu.RUnlock()

	vols := make([]*Volume, 0, len(s.volumes))
	for _, vol := range s.volumes {
		vols = append(vols, vol)
	}
	return vols
}

func (s *Store) WriteBlock(volumeID string, blockIndex int, data *Block) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	vol, exists := s.volumes[volumeID]
	if !exists {
		return false
	}
	if blockIndex < 0 || blockIndex >= vol.BlockCount {
		return false
	}

	vol.Blocks[blockIndex] = data
	return true
}

func (s *Store) ReadBlock(volumeID string, blockIndex int) *Block {
	s.mu.RLock()
	defer s.mu.RUnlock()

	vol, exists := s.volumes[volumeID]
	if !exists {
		return nil
	}
	if blockIndex < 0 || blockIndex >= vol.BlockCount {
		return nil
	}

	return vol.Blocks[blockIndex]
}

func (s *Store) CreateFullSnapshot(id, name, sourceVolumeID string, sizeBytes int64) *Snapshot {
	s.mu.Lock()
	defer s.mu.Unlock()

	vol, exists := s.volumes[sourceVolumeID]
	if !exists {
		return nil
	}

	blocks := make(map[int]*Block)
	for i, block := range vol.Blocks {
		newBlock := *block
		blocks[i] = &newBlock
	}

	blockCount := vol.BlockCount
	bitmap := NewBitmap(blockCount)
	for i := 0; i < blockCount; i++ {
		bitmap.Set(i)
	}

	snap := &Snapshot{
		ID:             id,
		Name:           name,
		SourceVolumeID: sourceVolumeID,
		ParentID:       "",
		ChildIDs:       []string{},
		SizeBytes:      sizeBytes,
		BlockCount:     blockCount,
		Blocks:         blocks,
		ChangedBitmap:  bitmap,
		Status:         "ready",
		CreationTime:   time.Now(),
		ReadyToUse:     true,
		IsIncremental:  false,
		ChainLength:    1,
	}

	snap.Checksum = calculateSnapshotChecksum(snap)
	s.snapshots[id] = snap
	return snap
}

func (s *Store) CreateIncrementalSnapshot(id, name, sourceVolumeID, parentSnapshotID string, sizeBytes int64) *Snapshot {
	s.mu.Lock()
	defer s.mu.Unlock()

	vol, volExists := s.volumes[sourceVolumeID]
	parentSnap, parentExists := s.snapshots[parentSnapshotID]

	if !volExists || !parentExists {
		return nil
	}

	blockCount := vol.BlockCount
	changedBitmap := NewBitmap(blockCount)
	changedBlocks := make(map[int]*Block)

	for i := 0; i < blockCount; i++ {
		volBlock := vol.Blocks[i]
		parentBlock := parentSnap.Blocks[i]

		if parentBlock == nil {
			newBlock := *volBlock
			changedBlocks[i] = &newBlock
			changedBitmap.Set(i)
			continue
		}

		if *volBlock != *parentBlock {
			newBlock := *volBlock
			changedBlocks[i] = &newBlock
			changedBitmap.Set(i)
		}
	}

	snap := &Snapshot{
		ID:             id,
		Name:           name,
		SourceVolumeID: sourceVolumeID,
		ParentID:       parentSnapshotID,
		ChildIDs:       []string{},
		SizeBytes:      sizeBytes,
		BlockCount:     blockCount,
		Blocks:         changedBlocks,
		ChangedBitmap:  changedBitmap,
		Status:         "ready",
		CreationTime:   time.Now(),
		ReadyToUse:     true,
		IsIncremental:  true,
		ChainLength:    parentSnap.ChainLength + 1,
	}

	snap.Checksum = calculateSnapshotChecksum(snap)
	parentSnap.ChildIDs = append(parentSnap.ChildIDs, id)
	s.snapshots[id] = snap
	return snap
}

func (s *Store) VerifySnapshotChecksum(snapshotID string) (bool, string, string) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	snap, exists := s.snapshots[snapshotID]
	if !exists {
		return false, "", ""
	}

	currentChecksum := calculateSnapshotChecksum(snap)
	return currentChecksum == snap.Checksum, snap.Checksum, currentChecksum
}

func (s *Store) GetSnapshotChain(snapshotID string) []*Snapshot {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var chain []*Snapshot
	currentID := snapshotID

	for currentID != "" {
		snap, exists := s.snapshots[currentID]
		if !exists {
			break
		}
		chain = append([]*Snapshot{snap}, chain...)
		currentID = snap.ParentID
	}

	return chain
}

func (s *Store) RestoreVolumeFromSnapshotChain(volumeID, snapshotID string) *Volume {
	s.mu.Lock()
	defer s.mu.Unlock()

	snap, snapExists := s.snapshots[snapshotID]
	if !snapExists {
		return nil
	}

	chain := s.getSnapshotChainLocked(snapshotID)

	blocks := make(map[int]*Block)
	for i := 0; i < snap.BlockCount; i++ {
		for _, s := range chain {
			if block, ok := s.Blocks[i]; ok {
				newBlock := *block
				blocks[i] = &newBlock
				break
			}
		}
	}

	vol, volExists := s.volumes[volumeID]
	if !volExists {
		return nil
	}

	for i, block := range blocks {
		vol.Blocks[i] = block
	}

	return vol
}

func (s *Store) getSnapshotChainLocked(snapshotID string) []*Snapshot {
	var chain []*Snapshot
	currentID := snapshotID

	for currentID != "" {
		snap, exists := s.snapshots[currentID]
		if !exists {
			break
		}
		chain = append([]*Snapshot{snap}, chain...)
		currentID = snap.ParentID
	}

	return chain
}

func (s *Store) DeleteSnapshot(id string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	snap, exists := s.snapshots[id]
	if !exists {
		return false
	}

	if snap.ParentID != "" {
		if parent, ok := s.snapshots[snap.ParentID]; ok {
			newChildren := make([]string, 0)
			for _, childID := range parent.ChildIDs {
				if childID != id {
					newChildren = append(newChildren, childID)
				}
			}
			parent.ChildIDs = newChildren
		}
	}

	delete(s.snapshots, id)
	return true
}

func (s *Store) GetSnapshot(id string) *Snapshot {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return s.snapshots[id]
}

func (s *Store) GetSnapshotByName(name string) *Snapshot {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, snap := range s.snapshots {
		if snap.Name == name {
			return snap
		}
	}
	return nil
}

func (s *Store) ListSnapshots() []*Snapshot {
	s.mu.RLock()
	defer s.mu.RUnlock()

	snaps := make([]*Snapshot, 0, len(s.snapshots))
	for _, snap := range s.snapshots {
		snaps = append(snaps, snap)
	}
	return snaps
}

func (s *Store) GetChangedBlockCount(snapshotID string) int {
	s.mu.RLock()
	defer s.mu.RUnlock()

	snap, exists := s.snapshots[snapshotID]
	if !exists || snap.ChangedBitmap == nil {
		return 0
	}
	return snap.ChangedBitmap.Count()
}

type SnapshotSpaceStats struct {
	TotalSize         int64
	LogicalSize       int64
	UniqueSize        int64
	FullSnapshotCount int
	IncrementalCount  int
	Details           []SnapshotSpaceDetail
}

type SnapshotSpaceDetail struct {
	SnapshotID    string
	SnapshotName  string
	IsIncremental bool
	BlockCount    int
	SizeBytes     int64
	UniqueBytes   int64
	ChangeRate    float64
}

func (s *Store) GetSnapshotSpaceStats(snapshotID string) *SnapshotSpaceStats {
	s.mu.RLock()
	defer s.mu.RUnlock()

	chain := s.getSnapshotChainLocked(snapshotID)
	if len(chain) == 0 {
		return nil
	}

	seenBlocks := make(map[int]bool)
	var details []SnapshotSpaceDetail
	var totalUniqueSize int64
	fullCount := 0
	incrementalCount := 0

	for _, snap := range chain {
		if snap.IsIncremental {
			incrementalCount++
		} else {
			fullCount++
		}

		uniqueBlocks := 0
		for blockIdx := range snap.Blocks {
			if !seenBlocks[blockIdx] {
				seenBlocks[blockIdx] = true
				uniqueBlocks++
			}
		}

		uniqueSize := int64(uniqueBlocks) * int64(BlockSize)
		totalUniqueSize += uniqueSize

		changeRate := 0.0
		if snap.BlockCount > 0 {
			changeRate = float64(len(snap.Blocks)) / float64(snap.BlockCount)
		}

		details = append(details, SnapshotSpaceDetail{
			SnapshotID:    snap.ID,
			SnapshotName:  snap.Name,
			IsIncremental: snap.IsIncremental,
			BlockCount:    len(snap.Blocks),
			SizeBytes:     int64(len(snap.Blocks)) * int64(BlockSize),
			UniqueBytes:   uniqueSize,
			ChangeRate:    changeRate,
		})
	}

	rootSnap := chain[0]

	return &SnapshotSpaceStats{
		TotalSize:         int64(len(seenBlocks)) * int64(BlockSize),
		LogicalSize:       rootSnap.SizeBytes,
		UniqueSize:        totalUniqueSize,
		FullSnapshotCount: fullCount,
		IncrementalCount:  incrementalCount,
		Details:           details,
	}
}

func (s *Store) CloneVolume(sourceVolumeID, targetVolumeID, targetName string) (*Volume, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	sourceVol, sourceExists := s.volumes[sourceVolumeID]
	if !sourceExists {
		return nil, fmt.Errorf("source volume %s not found", sourceVolumeID)
	}

	if _, targetExists := s.volumes[targetVolumeID]; targetExists {
		return nil, fmt.Errorf("target volume %s already exists", targetVolumeID)
	}

	blocks := make(map[int]*Block)
	for i, block := range sourceVol.Blocks {
		newBlock := *block
		blocks[i] = &newBlock
	}

	targetVol := &Volume{
		ID:         targetVolumeID,
		Name:       targetName,
		SizeBytes:  sourceVol.SizeBytes,
		BlockCount: sourceVol.BlockCount,
		Blocks:     blocks,
		ContentSource: &VolumeContentSource{
			VolumeCloneID: sourceVolumeID,
		},
		Status:    "available",
		CreatedAt: time.Now(),
	}

	s.volumes[targetVolumeID] = targetVol
	return targetVol, nil
}

func (s *Store) GetAllSnapshotsSpaceStats() *SnapshotSpaceStats {
	s.mu.RLock()
	defer s.mu.RUnlock()

	seenBlocks := make(map[string]map[int]bool)
	var totalUniqueSize int64
	fullCount := 0
	incrementalCount := 0
	var details []SnapshotSpaceDetail
	var totalSize int64
	var logicalSize int64

	for _, snap := range s.snapshots {
		if _, ok := seenBlocks[snap.SourceVolumeID]; !ok {
			seenBlocks[snap.SourceVolumeID] = make(map[int]bool)
		}

		if snap.IsIncremental {
			incrementalCount++
		} else {
			fullCount++
		}

		uniqueBlocks := 0
		volSeen := seenBlocks[snap.SourceVolumeID]
		for blockIdx := range snap.Blocks {
			if !volSeen[blockIdx] {
				volSeen[blockIdx] = true
				uniqueBlocks++
			}
		}

		uniqueSize := int64(uniqueBlocks) * int64(BlockSize)
		totalUniqueSize += uniqueSize
		totalSize += int64(len(snap.Blocks)) * int64(BlockSize)
		logicalSize += snap.SizeBytes

		changeRate := 0.0
		if snap.BlockCount > 0 {
			changeRate = float64(len(snap.Blocks)) / float64(snap.BlockCount)
		}

		details = append(details, SnapshotSpaceDetail{
			SnapshotID:    snap.ID,
			SnapshotName:  snap.Name,
			IsIncremental: snap.IsIncremental,
			BlockCount:    len(snap.Blocks),
			SizeBytes:     int64(len(snap.Blocks)) * int64(BlockSize),
			UniqueBytes:   uniqueSize,
			ChangeRate:    changeRate,
		})
	}

	return &SnapshotSpaceStats{
		TotalSize:         totalSize,
		LogicalSize:       logicalSize,
		UniqueSize:        totalUniqueSize,
		FullSnapshotCount: fullCount,
		IncrementalCount:  incrementalCount,
		Details:           details,
	}
}
