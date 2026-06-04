package robot

import (
	"math"

	"robot-backend/protocol"
)

type Obstacle struct {
	ID     string
	X      float64
	Y      float64
	Radius float64
	Type   string
}

func (o *Obstacle) ToProtocol() protocol.Obstacle {
	return protocol.Obstacle{
		Type:     "obstacle",
		Id:       o.ID,
		Position: protocol.Position{X: o.X, Y: o.Y},
		Radius:   o.Radius,
		TypeObst: o.Type,
	}
}

func CheckCollision(x, y, radius float64, obstacles []Obstacle) bool {
	for _, obs := range obstacles {
		dx := x - obs.X
		dy := y - obs.Y
		dist := math.Sqrt(dx*dx + dy*dy)
		if dist < radius+obs.Radius {
			return true
		}
	}
	return false
}

func LineCircleCollision(x1, y1, x2, y2, cx, cy, r float64) bool {
	dx := x2 - x1
	dy := y2 - y1
	fx := x1 - cx
	fy := y1 - cy

	a := dx*dx + dy*dy
	b := 2 * (fx*dx + fy*dy)
	c := fx*fx + fy*fy - r*r

	discriminant := b*b - 4*a*c
	if discriminant < 0 {
		return false
	}

	discriminant = math.Sqrt(discriminant)
	t1 := (-b - discriminant) / (2 * a)
	t2 := (-b + discriminant) / (2 * a)

	if (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1) {
		return true
	}

	return false
}
