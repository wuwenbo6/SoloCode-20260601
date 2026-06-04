package robot

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"math"
)

type VideoGenerator struct {
	width  int
	height int
	frame  int64
}

func NewVideoGenerator() *VideoGenerator {
	return &VideoGenerator{
		width:  320,
		height: 240,
	}
}

func (v *VideoGenerator) GenerateFrame(jointAngles [6]float64, wheelSpeeds [2]float64) []byte {
	img := image.NewRGBA(image.Rect(0, 0, v.width, v.height))

	for y := 0; y < v.height; y++ {
		for x := 0; x < v.width; x++ {
			img.Set(x, y, color.RGBA{30, 30, 40, 255})
		}
	}

	gridSpacing := 40
	gridColor := color.RGBA{60, 60, 80, 255}
	for x := 0; x < v.width; x += gridSpacing {
		for y := 0; y < v.height; y++ {
			img.Set(x, y, gridColor)
		}
	}
	for y := 0; y < v.height; y += gridSpacing {
		for x := 0; x < v.width; x++ {
			img.Set(x, y, gridColor)
		}
	}

	offsetX := int(wheelSpeeds[0]*2) % gridSpacing
	offsetY := int(wheelSpeeds[1]*2) % gridSpacing
	markerColor := color.RGBA{0, 200, 100, 255}
	for x := offsetX; x < v.width; x += gridSpacing {
		for y := offsetY; y < v.height; y += gridSpacing {
			for dx := -2; dx <= 2; dx++ {
				for dy := -2; dy <= 2; dy++ {
					px, py := x+dx, y+dy
					if px >= 0 && px < v.width && py >= 0 && py < v.height {
						img.Set(px, py, markerColor)
					}
				}
			}
		}
	}

	horizonY := v.height / 2
	for x := 0; x < v.width; x++ {
		img.Set(x, horizonY, color.RGBA{100, 100, 120, 255})
	}

	crossSize := 15
	cx, cy := v.width/2, v.height/2
	crossColor := color.RGBA{200, 50, 50, 255}
	for i := -crossSize; i <= crossSize; i++ {
		img.Set(cx+i, cy, crossColor)
		img.Set(cx, cy+i, crossColor)
	}

	armColor := color.RGBA{50, 150, 255, 255}
	for j := 0; j < 6; j++ {
		angle := jointAngles[j]
		segLen := 20
		startX := 20
		startY := v.height - 30
		endX := startX + int(float64(segLen)*math.Cos(angle))
		endY := startY - int(float64(segLen)*math.Sin(angle))

		bresenhamLine(img, startX, startY, endX, endY, armColor)
		startX = endX
		startY = endY
	}

	var buf bytes.Buffer
	jpeg.Encode(&buf, img, &jpeg.Options{Quality: 50})
	v.frame++
	return buf.Bytes()
}

func bresenhamLine(img *image.RGBA, x0, y0, x1, y1 int, c color.Color) {
	dx := abs(x1 - x0)
	dy := abs(y1 - y0)
	sx, sy := 1, 1
	if x0 > x1 {
		sx = -1
	}
	if y0 > y1 {
		sy = -1
	}
	err := dx - dy

	for {
		if x0 >= 0 && x0 < img.Bounds().Dx() && y0 >= 0 && y0 < img.Bounds().Dy() {
			img.Set(x0, y0, c)
		}
		if x0 == x1 && y0 == y1 {
			break
		}
		e2 := 2 * err
		if e2 > -dy {
			err -= dy
			x0 += sx
		}
		if e2 < dx {
			err += dx
			y0 += sy
		}
	}
}

func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}
