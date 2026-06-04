package robot

import (
	"math"
	"math/rand"
	"time"

	"robot-backend/protocol"
)

type RobotSimulator struct {
	RobotId string
	Name    string
	PosX    float64
	PosY    float64
	Heading float64

	jointAngles     [6]float64
	jointVelocities [6]float64
	desiredAngles   [6]float64
	wheelSpeeds     [2]float64
	desiredTorques  [6]float64
	actualTorques   [6]float64

	accel       protocol.Vector3
	gyro        protocol.Vector3
	orientation protocol.Orientation

	batteryVoltage    float64
	batteryPercentage float64
	batteryCurrent    float64

	startTime time.Time

	waypoints        []protocol.PathPoint
	currentWaypoint  int
	autoMode         bool
	pathPlanner      *PathPlanner
}

func NewRobotSimulator(id, name string, planner *PathPlanner) *RobotSimulator {
	return &RobotSimulator{
		RobotId:           id,
		Name:              name,
		PosX:              0,
		PosY:              0,
		Heading:           0,
		jointAngles:       [6]float64{},
		jointVelocities:   [6]float64{},
		desiredAngles:     [6]float64{},
		batteryVoltage:    48.0,
		batteryPercentage: 100.0,
		batteryCurrent:    0.5,
		startTime:         time.Now(),
		pathPlanner:       planner,
	}
}

func (s *RobotSimulator) Update(dt float64) {
	kp := 100.0
	kd := 5.0

	for i := 0; i < 6; i++ {
		error := s.desiredAngles[i] - s.jointAngles[i]
		torque := kp*error - kd*s.jointVelocities[i]
		torque = math.Max(-200, math.Min(200, torque))

		inertia := 0.5
		acceleration := torque / inertia
		s.jointVelocities[i] += acceleration * dt
		s.jointVelocities[i] *= 0.95
		s.jointAngles[i] += s.jointVelocities[i] * dt
		s.actualTorques[i] = torque + (rand.Float64()-0.5)*1.0
	}

	if s.autoMode && len(s.waypoints) > 0 && s.currentWaypoint < len(s.waypoints) {
		target := s.waypoints[s.currentWaypoint]
		robotPos := Point{X: s.PosX, Y: s.PosY}
		targetPos := Point{X: target.X, Y: target.Y}
		currentSpeed := (s.wheelSpeeds[0] + s.wheelSpeeds[1]) / 2.0

		left, right := s.pathPlanner.GetWaypointControl(robotPos, targetPos, currentSpeed)
		s.wheelSpeeds[0] = left
		s.wheelSpeeds[1] = right

		dx := target.X - s.PosX
		dy := target.Y - s.PosY
		dist := math.Sqrt(dx*dx + dy*dy)
		if dist < 0.2 {
			s.currentWaypoint++
			if s.currentWaypoint >= len(s.waypoints) {
				s.autoMode = false
				s.wheelSpeeds[0] = 0
				s.wheelSpeeds[1] = 0
			}
		}
	}

	avgSpeed := (s.wheelSpeeds[0] + s.wheelSpeeds[1]) / 2.0
	turnSpeed := (s.wheelSpeeds[1] - s.wheelSpeeds[0]) * 0.5
	s.PosX += math.Cos(s.Heading) * avgSpeed * dt
	s.PosY += math.Sin(s.Heading) * avgSpeed * dt
	s.Heading += turnSpeed * dt

	s.accel = protocol.Vector3{
		X: 0.1 * (rand.Float64() - 0.5),
		Y: 9.81 + 0.05*(rand.Float64()-0.5),
		Z: 0.1 * (rand.Float64() - 0.5),
	}

	s.gyro = protocol.Vector3{
		X: (s.wheelSpeeds[1]-s.wheelSpeeds[0])*0.01 + 0.01*(rand.Float64()-0.5),
		Y: 0.01 * (rand.Float64() - 0.5),
		Z: (s.wheelSpeeds[0]+s.wheelSpeeds[1])*0.005 + 0.01*(rand.Float64()-0.5),
	}

	s.orientation = protocol.Orientation{
		Roll:  0.02 * (rand.Float64() - 0.5),
		Pitch: 0.02 * (rand.Float64() - 0.5),
		Yaw:   s.orientation.Yaw + (s.wheelSpeeds[1]-s.wheelSpeeds[0])*0.001*dt,
	}

	drainRate := 0.0001 * dt
	loadFactor := 0.0
	for i := 0; i < 6; i++ {
		loadFactor += math.Abs(s.actualTorques[i])
	}
	loadFactor /= 600.0
	drainRate += loadFactor * dt * 0.001

	s.batteryPercentage -= drainRate
	if s.batteryPercentage < 0 {
		s.batteryPercentage = 0
	}
	s.batteryVoltage = 36.0 + 12.0*(s.batteryPercentage/100.0) + 0.1*(rand.Float64()-0.5)
	s.batteryCurrent = 0.5 + loadFactor*5.0 + 0.1*(rand.Float64()-0.5)
}

func (s *RobotSimulator) GetSensorData() protocol.SensorData {
	return protocol.SensorData{
		Type:      "sensor",
		RobotId:   s.RobotId,
		Timestamp: float64(time.Since(s.startTime).Milliseconds()),
		Position: protocol.Position{
			X: s.PosX,
			Y: s.PosY,
		},
		IMU: protocol.IMUData{
			Accel:       s.accel,
			Gyro:        s.gyro,
			Orientation: s.orientation,
		},
		Battery: protocol.Battery{
			Voltage:    s.batteryVoltage,
			Percentage: s.batteryPercentage,
			Current:    s.batteryCurrent,
		},
		ActualTorques: s.actualTorques,
		JointAngles:   s.jointAngles,
	}
}

func (s *RobotSimulator) GetJointAngles() [6]float64 {
	return s.jointAngles
}

func (s *RobotSimulator) GetWheelSpeeds() [2]float64 {
	return s.wheelSpeeds
}

func (s *RobotSimulator) ProcessCommand(cmd protocol.ControlCommand) {
	if s.autoMode {
		return
	}
	s.wheelSpeeds[0] = cmd.Wheels.LeftSpeed
	s.wheelSpeeds[1] = cmd.Wheels.RightSpeed
	s.desiredAngles = cmd.Arm.Joints
	s.desiredTorques = cmd.Force.DesiredTorques
}

func (s *RobotSimulator) SetWaypoints(points []protocol.PathPoint) {
	s.waypoints = points
	s.currentWaypoint = 0
}

func (s *RobotSimulator) ClearWaypoints() {
	s.waypoints = nil
	s.currentWaypoint = 0
}

func (s *RobotSimulator) ToggleAutoMode(enable bool) {
	s.autoMode = enable
	if enable {
		s.currentWaypoint = 0
	} else {
		s.wheelSpeeds[0] = 0
		s.wheelSpeeds[1] = 0
	}
}

func (s *RobotSimulator) GetPosition() (float64, float64) {
	return s.PosX, s.PosY
}

func (s *RobotSimulator) GetRobotInfo() protocol.RobotInfo {
	status := "idle"
	if s.autoMode {
		status = "auto"
	}
	if s.wheelSpeeds[0] != 0 || s.wheelSpeeds[1] != 0 {
		status = "moving"
	}
	return protocol.RobotInfo{
		Type: "robot",
		Id:   s.RobotId,
		Name: s.Name,
		Position: protocol.Position{
			X: s.PosX,
			Y: s.PosY,
		},
		Status: status,
	}
}
