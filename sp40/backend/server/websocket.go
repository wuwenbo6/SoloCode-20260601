package server

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"robot-backend/protocol"
	"robot-backend/robot"

	"nhooyr.io/websocket"
	"nhooyr.io/websocket/wsjson"
)

type connState struct {
	selectedRobot    string
	playingRecording string
	playFrameIndex   int
	mu               sync.Mutex
}

type Server struct {
	manager  *robot.RobotManager
	vid      *robot.VideoGenerator
	planner  *robot.PathPlanner
	recorder *robot.VideoRecorder
}

func NewServer(mgr *robot.RobotManager, vid *robot.VideoGenerator, planner *robot.PathPlanner, recorder *robot.VideoRecorder) *Server {
	return &Server{
		manager:  mgr,
		vid:      vid,
		planner:  planner,
		recorder: recorder,
	}
}

func (s *Server) HandleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		OriginPatterns: []string{"localhost:*", "127.0.0.1:*"},
	})
	if err != nil {
		log.Printf("websocket accept error: %v", err)
		return
	}
	defer conn.Close(websocket.StatusInternalError, "closing")

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	state := &connState{}

	go s.readLoop(ctx, conn, cancel, state)
	s.writeLoop(ctx, conn, state)
}

func (s *Server) readLoop(ctx context.Context, conn *websocket.Conn, cancel context.CancelFunc, state *connState) {
	defer cancel()
	for {
		var raw map[string]interface{}
		err := wsjson.Read(ctx, conn, &raw)
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			log.Printf("read error: %v", err)
			return
		}

		msgType, _ := raw["type"].(string)

		if msgType == "ping" {
			id, _ := raw["id"].(float64)
			resp := map[string]interface{}{
				"type": "pong",
				"id":   int64(id),
			}
			msg, _ := json.Marshal(resp)
			conn.Write(ctx, websocket.MessageText, msg)
			continue
		}

		if msgType == "getRobots" {
			robots := s.manager.GetRobots()
			resp := protocol.RobotList{
				Type:   "robotList",
				Robots: robots,
			}
			msg, _ := json.Marshal(resp)
			conn.Write(ctx, websocket.MessageText, msg)
			continue
		}

		if msgType == "selectRobot" {
			cmdData, _ := json.Marshal(raw)
			var cmd protocol.SelectRobot
			if err := json.Unmarshal(cmdData, &cmd); err == nil {
				state.mu.Lock()
				state.selectedRobot = cmd.RobotId
				state.playingRecording = ""
				state.playFrameIndex = 0
				state.mu.Unlock()
			}
			continue
		}

		if msgType == "getObstacles" {
			obstacles := s.manager.GetObstaclesProtocol()
			resp := protocol.ObstacleList{
				Type:      "obstacleList",
				Obstacles: obstacles,
			}
			msg, _ := json.Marshal(resp)
			conn.Write(ctx, websocket.MessageText, msg)
			continue
		}

		if msgType == "pathPlanningRequest" {
			cmdData, _ := json.Marshal(raw)
			var cmd protocol.PathPlanningRequest
			if err := json.Unmarshal(cmdData, &cmd); err == nil {
				r := s.manager.GetRobot(cmd.RobotId)
				resp := protocol.PathPlanningResponse{
					Type:    "pathPlanningResponse",
					RobotId: cmd.RobotId,
					Success: false,
				}
				if r != nil {
					x, y := r.GetPosition()
					start := robot.Point{X: x, Y: y}
					target := robot.Point{X: cmd.Target.X, Y: cmd.Target.Y}
					waypoints := s.planner.PlanPath(start, target, s.manager.GetObstacles())
					if waypoints != nil {
						resp.Waypoints = waypoints
						resp.Success = true
						r.SetWaypoints(waypoints)
						r.ToggleAutoMode(true)
					}
				}
				msg, _ := json.Marshal(resp)
				conn.Write(ctx, websocket.MessageText, msg)
			}
			continue
		}

		if msgType == "recordingControl" {
			cmdData, _ := json.Marshal(raw)
			var cmd protocol.RecordingControl
			if err := json.Unmarshal(cmdData, &cmd); err == nil {
				s.handleRecordingControl(ctx, conn, cmd, state)
			}
			continue
		}

		if msgType == "control" {
			cmdData, _ := json.Marshal(raw)
			var cmd protocol.ControlCommand
			if err := json.Unmarshal(cmdData, &cmd); err == nil {
				targetId := cmd.RobotId
				if targetId == "" {
					state.mu.Lock()
					targetId = state.selectedRobot
					state.mu.Unlock()
				}
				if targetId != "" {
					r := s.manager.GetRobot(targetId)
					if r != nil {
						r.ProcessCommand(cmd)
					}
				}
			}
		}
	}
}

func (s *Server) handleRecordingControl(ctx context.Context, conn *websocket.Conn, cmd protocol.RecordingControl, state *connState) {
	switch cmd.Action {
	case "start":
		if cmd.RobotId != "" {
			s.recorder.StartRecording(cmd.RobotId)
		}
	case "stop":
		if cmd.RobotId != "" {
			recId, _ := s.recorder.StopRecording(cmd.RobotId)
			resp := map[string]interface{}{
				"type":        "recordingStopped",
				"recordingId": recId,
			}
			msg, _ := json.Marshal(resp)
			conn.Write(ctx, websocket.MessageText, msg)
		}
	case "list":
		recordings := s.recorder.GetRecordings()
		resp := map[string]interface{}{
			"type":       "recordingList",
			"recordings": recordings,
		}
		msg, _ := json.Marshal(resp)
		conn.Write(ctx, websocket.MessageText, msg)
	case "play":
		if cmd.RecordingId != "" {
			state.mu.Lock()
			state.playingRecording = cmd.RecordingId
			state.playFrameIndex = 0
			state.mu.Unlock()
		}
	case "stopPlayback":
		state.mu.Lock()
		state.playingRecording = ""
		state.playFrameIndex = 0
		state.mu.Unlock()
	}
}

func (s *Server) writeLoop(ctx context.Context, conn *websocket.Conn, state *connState) {
	sensorTicker := time.NewTicker(time.Second / 60)
	videoTicker := time.NewTicker(time.Second / 30)
	defer sensorTicker.Stop()
	defer videoTicker.Stop()

	var seq int64
	lastUpdate := time.Now()

	for {
		select {
		case <-ctx.Done():
			return
		case <-sensorTicker.C:
			now := time.Now()
			dt := now.Sub(lastUpdate).Seconds()
			if dt > 0.05 {
				dt = 0.05
			}
			lastUpdate = now

			s.manager.UpdateAll(dt)

			state.mu.Lock()
			selectedRobot := state.selectedRobot
			playingRec := state.playingRecording
			state.mu.Unlock()

			if playingRec == "" && selectedRobot != "" {
				r := s.manager.GetRobot(selectedRobot)
				if r != nil {
					data := r.GetSensorData()
					msg, err := json.Marshal(data)
					if err == nil {
						conn.Write(ctx, websocket.MessageText, msg)
					}
				}
			}

		case <-videoTicker.C:
			state.mu.Lock()
			selectedRobot := state.selectedRobot
			playingRec := state.playingRecording
			playIdx := state.playFrameIndex
			state.mu.Unlock()

			var jpegData []byte
			if playingRec != "" {
				frame, err := s.recorder.GetFrame(playingRec, playIdx)
				if err == nil {
					jpegData = frame
					state.mu.Lock()
					total, _ := s.recorder.GetFrameCount(playingRec)
					state.playFrameIndex++
					if state.playFrameIndex >= total {
						state.playFrameIndex = 0
					}
					state.mu.Unlock()
				}
			} else if selectedRobot != "" {
				r := s.manager.GetRobot(selectedRobot)
				if r != nil {
					jpegData = s.vid.GenerateFrame(r.GetJointAngles(), r.GetWheelSpeeds())
					s.recorder.AddFrame(selectedRobot, jpegData)
				}
			}

			if jpegData != nil {
				header := make([]byte, 13)
				header[0] = 'V'
				binary.BigEndian.PutUint64(header[1:9], uint64(time.Now().UnixMilli()))
				binary.BigEndian.PutUint32(header[9:13], uint32(seq))

				fullMsg := make([]byte, len(header)+len(jpegData))
				copy(fullMsg, header)
				copy(fullMsg[len(header):], jpegData)

				conn.Write(ctx, websocket.MessageBinary, fullMsg)
				seq++
			}
		}
	}
}
