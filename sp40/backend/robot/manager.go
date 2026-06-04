package robot

import (
	"robot-backend/protocol"
)

type RobotManager struct {
	robots    map[string]*RobotSimulator
	obstacles []Obstacle
	planner   *PathPlanner
}

func NewRobotManager(planner *PathPlanner) *RobotManager {
	rm := &RobotManager{
		robots:    make(map[string]*RobotSimulator),
		obstacles: []Obstacle{},
		planner:   planner,
	}

	rm.AddRobot("robot-1", "Alpha")
	rm.AddRobot("robot-2", "Beta")
	rm.AddRobot("robot-3", "Gamma")

	rm.AddObstacle("obs-1", 3.0, 0.0, 0.8, "static")
	rm.AddObstacle("obs-2", -2.5, 2.5, 0.6, "static")
	rm.AddObstacle("obs-3", 1.5, -3.0, 0.7, "static")
	rm.AddObstacle("obs-4", -1.0, -1.5, 0.5, "static")
	rm.AddObstacle("obs-5", 4.0, 3.5, 0.9, "static")

	rm.robots["robot-1"].PosX = -5
	rm.robots["robot-1"].PosY = -5

	rm.robots["robot-2"].PosX = 5
	rm.robots["robot-2"].PosY = -5

	rm.robots["robot-3"].PosX = 0
	rm.robots["robot-3"].PosY = 5

	return rm
}

func (m *RobotManager) AddRobot(id, name string) *RobotSimulator {
	robot := NewRobotSimulator(id, name, m.planner)
	m.robots[id] = robot
	return robot
}

func (m *RobotManager) GetRobot(id string) *RobotSimulator {
	return m.robots[id]
}

func (m *RobotManager) GetRobots() []protocol.RobotInfo {
	infos := []protocol.RobotInfo{}
	for _, robot := range m.robots {
		infos = append(infos, robot.GetRobotInfo())
	}
	return infos
}

func (m *RobotManager) AddObstacle(id string, x, y, radius float64, typ string) {
	m.obstacles = append(m.obstacles, Obstacle{
		ID:     id,
		X:      x,
		Y:      y,
		Radius: radius,
		Type:   typ,
	})
}

func (m *RobotManager) GetObstacles() []Obstacle {
	return m.obstacles
}

func (m *RobotManager) GetObstaclesProtocol() []protocol.Obstacle {
	obs := []protocol.Obstacle{}
	for _, o := range m.obstacles {
		obs = append(obs, o.ToProtocol())
	}
	return obs
}

func (m *RobotManager) UpdateAll(dt float64) {
	for _, robot := range m.robots {
		robot.Update(dt)
	}
}
