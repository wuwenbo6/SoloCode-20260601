package robot

import (
	"fmt"
	"sync"
	"time"

	"robot-backend/protocol"
)

type activeRecording struct {
	robotId    string
	startTime  int64
	frames     [][]byte
	timestamps []int64
}

type savedRecording struct {
	id         string
	robotId    string
	startTime  int64
	endTime    int64
	frames     [][]byte
	timestamps []int64
}

type VideoRecorder struct {
	mu              sync.Mutex
	active          map[string]*activeRecording
	recordings      map[string]*savedRecording
	recordingCounter int
}

func NewVideoRecorder() *VideoRecorder {
	return &VideoRecorder{
		active:     make(map[string]*activeRecording),
		recordings: make(map[string]*savedRecording),
	}
}

func (r *VideoRecorder) StartRecording(robotId string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.active[robotId]; exists {
		return fmt.Errorf("recording already in progress for robot %s", robotId)
	}

	r.active[robotId] = &activeRecording{
		robotId:   robotId,
		startTime: time.Now().UnixMilli(),
		frames:    [][]byte{},
		timestamps: []int64{},
	}

	return nil
}

func (r *VideoRecorder) StopRecording(robotId string) (string, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	active, exists := r.active[robotId]
	if !exists {
		return "", fmt.Errorf("no active recording for robot %s", robotId)
	}

	r.recordingCounter++
	recordingId := fmt.Sprintf("rec-%d", r.recordingCounter)

	saved := &savedRecording{
		id:         recordingId,
		robotId:    robotId,
		startTime:  active.startTime,
		endTime:    time.Now().UnixMilli(),
		frames:     active.frames,
		timestamps: active.timestamps,
	}

	r.recordings[recordingId] = saved
	delete(r.active, robotId)

	return recordingId, nil
}

func (r *VideoRecorder) AddFrame(robotId string, frame []byte) {
	r.mu.Lock()
	defer r.mu.Unlock()

	active, exists := r.active[robotId]
	if !exists {
		return
	}

	active.frames = append(active.frames, frame)
	active.timestamps = append(active.timestamps, time.Now().UnixMilli())
}

func (r *VideoRecorder) GetRecordings() []protocol.RecordingInfo {
	r.mu.Lock()
	defer r.mu.Unlock()

	infos := []protocol.RecordingInfo{}
	for id, rec := range r.recordings {
		infos = append(infos, protocol.RecordingInfo{
			Type:       "recording",
			Id:         id,
			RobotId:    rec.robotId,
			StartTime:  rec.startTime,
			EndTime:    rec.endTime,
			FrameCount: len(rec.frames),
		})
	}
	return infos
}

func (r *VideoRecorder) GetFrame(recordingId string, frameIndex int) ([]byte, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	rec, exists := r.recordings[recordingId]
	if !exists {
		return nil, fmt.Errorf("recording %s not found", recordingId)
	}

	if frameIndex < 0 || frameIndex >= len(rec.frames) {
		return nil, fmt.Errorf("frame index %d out of range (0-%d)", frameIndex, len(rec.frames)-1)
	}

	return rec.frames[frameIndex], nil
}

func (r *VideoRecorder) GetFrameCount(recordingId string) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	rec, exists := r.recordings[recordingId]
	if !exists {
		return 0, fmt.Errorf("recording %s not found", recordingId)
	}

	return len(rec.frames), nil
}
