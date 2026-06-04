package robot

import (
	"math"
	"sort"

	"robot-backend/protocol"
)

type Point struct {
	X float64
	Y float64
}

type PathPlanner struct {
	gridSize   float64
	worldMinX float64
	worldMaxX float64
	worldMinY float64
	worldMaxY float64
}

type aStarNode struct {
	x        int
	y        int
	g        float64
	h        float64
	f        float64
	parent   *aStarNode
	closed   bool
}

func NewPathPlanner() *PathPlanner {
	return &PathPlanner{
		gridSize:   0.5,
		worldMinX: -10,
		worldMaxX: 10,
		worldMinY: -10,
		worldMaxY: 10,
	}
}

func (p *PathPlanner) worldToGrid(x, y float64) (int, int) {
	gx := int(math.Floor((x - p.worldMinX) / p.gridSize))
	gy := int(math.Floor((y - p.worldMinY) / p.gridSize))
	return gx, gy
}

func (p *PathPlanner) gridToWorld(gx, gy int) (float64, float64) {
	x := p.worldMinX + float64(gx)*p.gridSize + p.gridSize/2
	y := p.worldMinY + float64(gy)*p.gridSize + p.gridSize/2
	return x, y
}

func (p *PathPlanner) heuristic(x1, y1, x2, y2 float64) float64 {
	dx := x2 - x1
	dy := y2 - y1
	return math.Sqrt(dx*dx + dy*dy)
}

func (p *PathPlanner) isBlocked(x, y float64, obstacles []Obstacle) bool {
	radius := 0.3
	return CheckCollision(x, y, radius, obstacles)
}

func (p *PathPlanner) PlanPath(start, target Point, obstacles []Obstacle) []protocol.PathPoint {
	startGx, startGy := p.worldToGrid(start.X, start.Y)
	targetGx, targetGy := p.worldToGrid(target.X, target.Y)

	gridWidth := int(math.Ceil((p.worldMaxX - p.worldMinX) / p.gridSize))
	gridHeight := int(math.Ceil((p.worldMaxY - p.worldMinY) / p.gridSize))

	if startGx < 0 || startGx >= gridWidth || startGy < 0 || startGy >= gridHeight {
		return nil
	}
	if targetGx < 0 || targetGx >= gridWidth || targetGy < 0 || targetGy >= gridHeight {
		return nil
	}

	targetWx, targetWy := p.gridToWorld(targetGx, targetGy)
	if p.isBlocked(targetWx, targetWy, obstacles) {
		return nil
	}

	nodes := make(map[int]*aStarNode)
	getNode := func(gx, gy int) *aStarNode {
		key := gx*gridHeight + gy
		if n, ok := nodes[key]; ok {
			return n
		}
		wx, wy := p.gridToWorld(gx, gy)
		n := &aStarNode{
			x: gx,
			y: gy,
			g: math.Inf(1),
			h: p.heuristic(wx, wy, targetWx, targetWy),
			f: math.Inf(1),
		}
		nodes[key] = n
		return n
	}

	startNode := getNode(startGx, startGy)
	startNode.g = 0
	startNode.f = startNode.h

	openSet := []*aStarNode{startNode}
	dirs := []struct{ dx, dy int }{
		{-1, -1}, {0, -1}, {1, -1},
		{-1, 0},           {1, 0},
		{-1, 1},  {0, 1},  {1, 1},
	}

	for len(openSet) > 0 {
		sort.Slice(openSet, func(i, j int) bool {
			return openSet[i].f < openSet[j].f
		})

		current := openSet[0]
		openSet = openSet[1:]

		if current.x == targetGx && current.y == targetGy {
			path := []protocol.PathPoint{}
			for n := current; n != nil; n = n.parent {
				wx, wy := p.gridToWorld(n.x, n.y)
				path = append([]protocol.PathPoint{{X: wx, Y: wy}}, path...)
			}
			return path
		}

		current.closed = true

		for _, d := range dirs {
			nx, ny := current.x+d.dx, current.y+d.dy
			if nx < 0 || nx >= gridWidth || ny < 0 || ny >= gridHeight {
				continue
			}

			neighbor := getNode(nx, ny)
			if neighbor.closed {
				continue
			}

			wx, wy := p.gridToWorld(nx, ny)
			if p.isBlocked(wx, wy, obstacles) {
				continue
			}

			cwx, cwy := p.gridToWorld(current.x, current.y)
			moveCost := p.heuristic(cwx, cwy, wx, wy)
			tentativeG := current.g + moveCost

			if tentativeG < neighbor.g {
				neighbor.parent = current
				neighbor.g = tentativeG
				neighbor.f = neighbor.g + neighbor.h

				inOpen := false
				for _, n := range openSet {
					if n == neighbor {
						inOpen = true
						break
					}
				}
				if !inOpen {
					openSet = append(openSet, neighbor)
				}
			}
		}
	}

	return nil
}

func (p *PathPlanner) GetWaypointControl(robotPos, targetPos Point, currentSpeed float64) (float64, float64) {
	dx := targetPos.X - robotPos.X
	dy := targetPos.Y - robotPos.Y
	distance := math.Sqrt(dx*dx + dy*dy)

	if distance < 0.1 {
		return 0, 0
	}

	desiredHeading := math.Atan2(dy, dx)
	baseSpeed := math.Min(2.0, distance*1.5)

	wheelBase := 0.5
	turnRate := 2.0 * desiredHeading / wheelBase

	if turnRate > 0 {
		return baseSpeed - turnRate*wheelBase/2, baseSpeed + turnRate*wheelBase/2
	}
	return baseSpeed + turnRate*wheelBase/2, baseSpeed - turnRate*wheelBase/2
}
