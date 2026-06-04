package service

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"ssh-web-terminal/internal/model"
	"ssh-web-terminal/internal/recorder"
)

type TtyRecFrameWithDelay struct {
	Header     recorder.TtyRecHeader
	Content    []byte
	Delay      float64
	AbsoluteTs float64
}

type PlaybackService struct {
	minioSvc *MinIOService
}

func NewPlaybackService(minioSvc *MinIOService) *PlaybackService {
	return &PlaybackService{minioSvc: minioSvc}
}

func (s *PlaybackService) ParseTtyRec(data []byte) ([]TtyRecFrameWithDelay, error) {
	if len(data) < 12 {
		return nil, errors.New("invalid ttyrec file: too small")
	}

	var frames []TtyRecFrameWithDelay
	reader := bytes.NewReader(data)
	var prevSec, prevUsec uint32
	firstFrame := true
	var absoluteTs float64

	for reader.Len() > 0 {
		header, err := s.readHeader(reader)
		if err != nil {
			break
		}

		content := make([]byte, header.Len)
		if _, err := reader.Read(content); err != nil {
			break
		}

		var delay float64
		if firstFrame {
			delay = 0
			firstFrame = false
		} else {
			delay = float64(header.Sec-prevSec) + float64(header.Usec-prevUsec)/1000000.0
			if delay < 0 {
				delay = 0
			}
		}

		absoluteTs += delay
		prevSec = header.Sec
		prevUsec = header.Usec

		frames = append(frames, TtyRecFrameWithDelay{
			Header:     header,
			Content:    content,
			Delay:      delay,
			AbsoluteTs: absoluteTs,
		})
	}

	if len(frames) == 0 {
		return nil, errors.New("no frames found in ttyrec file")
	}

	return frames, nil
}

func (s *PlaybackService) readHeader(reader *bytes.Reader) (recorder.TtyRecHeader, error) {
	var header recorder.TtyRecHeader
	if err := binary.Read(reader, binary.LittleEndian, &header.Sec); err != nil {
		return header, err
	}
	if err := binary.Read(reader, binary.LittleEndian, &header.Usec); err != nil {
		return header, err
	}
	if err := binary.Read(reader, binary.LittleEndian, &header.Len); err != nil {
		return header, err
	}
	return header, nil
}

func (s *PlaybackService) LoadRecording(objectKey string) ([]TtyRecFrameWithDelay, error) {
	data, err := s.minioSvc.Download(objectKey)
	if err != nil {
		return nil, fmt.Errorf("failed to download recording: %w", err)
	}

	frames, err := s.ParseTtyRec(data)
	if err != nil {
		return nil, fmt.Errorf("failed to parse ttyrec: %w", err)
	}

	return frames, nil
}

func (s *PlaybackService) GetDuration(frames []TtyRecFrameWithDelay) float64 {
	if len(frames) == 0 {
		return 0
	}
	return frames[len(frames)-1].AbsoluteTs
}

func (s *PlaybackService) GeneratePlaybackFrames(frames []TtyRecFrameWithDelay, speed float64) []byte {
	type PlaybackMsg struct {
		Type       string  `json:"type"`
		Content    string  `json:"content"`
		Delay      float64 `json:"delay"`
		AbsoluteTs float64 `json:"absolute_ts"`
	}

	var result []map[string]interface{}
	for _, frame := range frames {
		result = append(result, map[string]interface{}{
			"type":        "frame",
			"content":     string(frame.Content),
			"delay":       frame.Delay / speed,
			"absolute_ts": frame.AbsoluteTs,
			"adjusted_ts": frame.AbsoluteTs / speed,
		})
	}

	data, _ := json.Marshal(result)
	return data
}

func (s *PlaybackService) FindFrameAtTime(frames []TtyRecFrameWithDelay, targetTime float64) (int, float64) {
	idx := findFrameIndexAtTime(frames, targetTime)
	if idx+1 < len(frames) {
		progress := (targetTime - frames[idx].AbsoluteTs) / (frames[idx+1].AbsoluteTs - frames[idx].AbsoluteTs)
		return idx, progress
	}
	return idx, 0
}

func findFrameIndexAtTime(frames []TtyRecFrameWithDelay, targetTime float64) int {
	left, right := 0, len(frames)-1
	result := 0

	for left <= right {
		mid := (left + right) / 2
		if frames[mid].AbsoluteTs <= targetTime {
			result = mid
			left = mid + 1
		} else {
			right = mid - 1
		}
	}

	return result
}

func (s *PlaybackService) GetContentUntilFrame(frames []TtyRecFrameWithDelay, frameIdx int) []byte {
	var buf bytes.Buffer
	for i := 0; i <= frameIdx; i++ {
		buf.Write(frames[i].Content)
	}
	return buf.Bytes()
}

func (s *PlaybackService) GetContentUntilTime(frames []TtyRecFrameWithDelay, targetTime float64) []byte {
	idx, _ := s.FindFrameAtTime(frames, targetTime)
	return s.GetContentUntilFrame(frames, idx)
}

type PlaybackController struct {
	frames       []TtyRecFrameWithDelay
	speed        float64
	startTime    time.Time
	paused       bool
	pauseElapsed float64
	currentFrame int
	totalTime    float64
}

func NewPlaybackController(frames []TtyRecFrameWithDelay, speed float64) *PlaybackController {
	return &PlaybackController{
		frames:       frames,
		speed:        speed,
		startTime:    time.Now(),
		paused:       false,
		pauseElapsed: 0,
		currentFrame: -1,
		totalTime:    frames[len(frames)-1].AbsoluteTs,
	}
}

func (pc *PlaybackController) GetElapsed() float64 {
	if pc.paused {
		return pc.pauseElapsed
	}
	return pc.pauseElapsed + time.Since(pc.startTime).Seconds()*pc.speed
}

func (pc *PlaybackController) GetAdjustedElapsed() float64 {
	return pc.GetElapsed() / pc.speed
}

func (pc *PlaybackController) GetFramesSinceLastCheck() []TtyRecFrameWithDelay {
	elapsed := pc.GetElapsed()

	var newFrames []TtyRecFrameWithDelay
	for pc.currentFrame+1 < len(pc.frames) {
		nextFrame := pc.frames[pc.currentFrame+1]
		if nextFrame.AbsoluteTs <= elapsed {
			newFrames = append(newFrames, nextFrame)
			pc.currentFrame++
		} else {
			break
		}
	}

	return newFrames
}

func (pc *PlaybackController) IsFinished() bool {
	return pc.currentFrame >= len(pc.frames)-1 && pc.GetElapsed() >= pc.totalTime
}

func (pc *PlaybackController) Pause() {
	if !pc.paused {
		pc.paused = true
		pc.pauseElapsed = pc.GetElapsed()
	}
}

func (pc *PlaybackController) Resume() {
	if pc.paused {
		pc.paused = false
		pc.startTime = time.Now()
	}
}

func (pc *PlaybackController) SetSpeed(speed float64) {
	currentElapsed := pc.GetElapsed()
	pc.speed = speed
	pc.startTime = time.Now()
	pc.pauseElapsed = currentElapsed
}

func (pc *PlaybackController) Seek(targetTime float64) {
	targetTime = float64(int(targetTime*1000)) / 1000
	pc.pauseElapsed = targetTime
	pc.startTime = time.Now()
	pc.currentFrame = findFrameIndexAtTime(pc.frames, targetTime)
}

func (pc *PlaybackController) WaitForNextFrame() time.Duration {
	if pc.IsFinished() {
		return 0
	}

	nextFrameIdx := pc.currentFrame + 1
	if nextFrameIdx >= len(pc.frames) {
		return 0
	}

	nextFrameTs := pc.frames[nextFrameIdx].AbsoluteTs
	elapsed := pc.GetElapsed()
	remaining := (nextFrameTs - elapsed) / pc.speed

	if remaining <= 0 {
		return 0
	}

	if remaining > 1 {
		remaining = 1
	}

	return time.Duration(remaining * float64(time.Second))
}

func (s *PlaybackService) StreamFramesWithInterpolation(frames []TtyRecFrameWithDelay, speed float64, sendFn func([]byte) error) error {
	controller := NewPlaybackController(frames, speed)

	for !controller.IsFinished() {
		newFrames := controller.GetFramesSinceLastCheck()

		for _, frame := range newFrames {
			msg := model.WSMessage{
				Type: model.MsgTypeStdout,
				Data: string(frame.Content),
			}

			data, err := json.Marshal(msg)
			if err != nil {
				return err
			}

			if err := sendFn(data); err != nil {
				return err
			}
		}

		waitTime := controller.WaitForNextFrame()
		if waitTime > 0 {
			time.Sleep(waitTime)
		}
	}

	return nil
}

func (s *PlaybackService) StreamFrames(frames []TtyRecFrameWithDelay, speed float64, sendFn func([]byte) error) error {
	return s.StreamFramesWithInterpolation(frames, speed, sendFn)
}

func (s *PlaybackService) GetFramesForSpeedWithTimestamps(frames []TtyRecFrameWithDelay, speed float64) []map[string]interface{} {
	result := make([]map[string]interface{}, len(frames))
	for i, frame := range frames {
		result[i] = map[string]interface{}{
			"index":          i,
			"content":        string(frame.Content),
			"delay":          frame.Delay / speed,
			"original_delay": frame.Delay,
			"absolute_ts":    frame.AbsoluteTs,
			"adjusted_ts":    frame.AbsoluteTs / speed,
		}
	}
	return result
}
