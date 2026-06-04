package protocol

type Position struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type RobotInfo struct {
	Type     string   `json:"type"`
	Id       string   `json:"id"`
	Name     string   `json:"name"`
	Position Position `json:"position"`
	Status   string   `json:"status"`
}

type RobotList struct {
	Type   string      `json:"type"`
	Robots []RobotInfo `json:"robots"`
}

type Obstacle struct {
	Type     string   `json:"type"`
	Id       string   `json:"id"`
	Position Position `json:"position"`
	Radius   float64  `json:"radius"`
	TypeObst string   `json:"typeObst"`
}

type ObstacleList struct {
	Type      string     `json:"type"`
	Obstacles []Obstacle `json:"obstacles"`
}

type PathPoint struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type PathPlanningRequest struct {
	Type   string   `json:"type"`
	RobotId string   `json:"robotId"`
	Target Position `json:"target"`
}

type PathPlanningResponse struct {
	Type     string      `json:"type"`
	RobotId  string      `json:"robotId"`
	Waypoints []PathPoint `json:"waypoints"`
	Success  bool        `json:"success"`
}

type RecordingControl struct {
	Type        string `json:"type"`
	Action      string `json:"action"`
	RobotId     string `json:"robotId"`
	RecordingId string `json:"recordingId"`
}

type RecordingInfo struct {
	Type       string `json:"type"`
	Id         string `json:"id"`
	RobotId    string `json:"robotId"`
	StartTime  int64  `json:"startTime"`
	EndTime    int64  `json:"endTime"`
	FrameCount int    `json:"frameCount"`
}

type ControlCommand struct {
	Type      string  `json:"type"`
	RobotId   string  `json:"robotId"`
	Timestamp float64 `json:"timestamp"`
	Wheels    Wheels  `json:"wheels"`
	Arm       Arm     `json:"arm"`
	Force     Force   `json:"force"`
}

type Wheels struct {
	LeftSpeed  float64 `json:"leftSpeed"`
	RightSpeed float64 `json:"rightSpeed"`
}

type Arm struct {
	Joints [6]float64 `json:"joints"`
}

type Force struct {
	DesiredTorques [6]float64 `json:"desiredTorques"`
}

type SensorData struct {
	Type          string     `json:"type"`
	RobotId       string     `json:"robotId"`
	Timestamp     float64    `json:"timestamp"`
	Position      Position   `json:"position"`
	IMU           IMUData    `json:"imu"`
	Battery       Battery    `json:"battery"`
	ActualTorques [6]float64 `json:"actualTorques"`
	JointAngles   [6]float64 `json:"jointAngles"`
}

type IMUData struct {
	Accel       Vector3     `json:"accel"`
	Gyro        Vector3     `json:"gyro"`
	Orientation Orientation `json:"orientation"`
}

type Vector3 struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}

type Orientation struct {
	Roll  float64 `json:"roll"`
	Pitch float64 `json:"pitch"`
	Yaw   float64 `json:"yaw"`
}

type Battery struct {
	Voltage    float64 `json:"voltage"`
	Percentage float64 `json:"percentage"`
	Current    float64 `json:"current"`
}

type VideoFrame struct {
	Type       string `json:"type"`
	Timestamp  int64  `json:"timestamp"`
	Sequence   int64  `json:"sequence"`
	IsKeyframe bool   `json:"isKeyframe"`
	Data       string `json:"data"`
}

type GetRobots struct {
	Type string `json:"type"`
}

type SelectRobot struct {
	Type    string `json:"type"`
	RobotId string `json:"robotId"`
}

type GetObstacles struct {
	Type string `json:"type"`
}
