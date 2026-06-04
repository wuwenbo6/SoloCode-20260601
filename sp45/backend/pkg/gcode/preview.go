package gcode

type PathSegment struct {
	Type    string  `json:"type"`
	FromX   float64 `json:"from_x"`
	FromY   float64 `json:"from_y"`
	FromZ   float64 `json:"from_z"`
	ToX     float64 `json:"to_x"`
	ToY     float64 `json:"to_y"`
	ToZ     float64 `json:"to_z"`
	Extrude bool    `json:"extrude"`
	Speed   float64 `json:"speed"`
	Layer   int     `json:"layer"`
	LineNum int     `json:"line_num"`
}

type GCodePreview struct {
	Segments   []PathSegment `json:"segments"`
	Bounds     Bounds        `json:"bounds"`
	LayerCount int           `json:"layer_count"`
	TotalLines int           `json:"total_lines"`
	FilamentMM float64       `json:"filament_mm"`
	EstTime    float64       `json:"est_time_min"`
}

type Bounds struct {
	MinX float64 `json:"min_x"`
	MaxX float64 `json:"max_x"`
	MinY float64 `json:"min_y"`
	MaxY float64 `json:"max_y"`
	MinZ float64 `json:"min_z"`
	MaxZ float64 `json:"max_z"`
}

func GeneratePreview(content string) *GCodePreview {
	preview := &GCodePreview{
		Segments: make([]PathSegment, 0),
		Bounds: Bounds{
			MinX: 1e9, MinY: 1e9, MinZ: 1e9,
			MaxX: -1e9, MaxY: -1e9, MaxZ: -1e9,
		},
	}

	curX, curY, curZ := 0.0, 0.0, 0.0
	curE := 0.0
	relativeE := false
	layer := 0
	lineNum := 0
	lastZ := -1e9
	totalFilament := 0.0

	lines := splitLines(content)

	for _, line := range lines {
		lineNum++
		cmd, err := Parse(line)
		if err != nil {
			continue
		}

		switch {
		case cmd.Letter == "G" && (cmd.Number == 0 || cmd.Number == 1):
			newX := curX
			newY := curY
			newZ := curZ
			newE := curE

			if x, ok := cmd.GetParam("X"); ok {
				newX = x
			}
			if y, ok := cmd.GetParam("Y"); ok {
				newY = y
			}
			if z, ok := cmd.GetParam("Z"); ok {
				newZ = z
			}
			if e, ok := cmd.GetParam("E"); ok {
				if relativeE {
					newE = curE + e
				} else {
					newE = e
				}
			}

			extruding := newE > curE
			speed := cmd.GetParamDefault("F", 1200)

			if newZ != curZ && newZ > lastZ+0.01 && extruding {
				layer++
				lastZ = newZ
			}

			if newX != curX || newY != curY || newZ != curZ {
				seg := PathSegment{
					Type:    map[int]string{0: "rapid", 1: "linear"}[cmd.Number],
					FromX:   curX,
					FromY:   curY,
					FromZ:   curZ,
					ToX:     newX,
					ToY:     newY,
					ToZ:     newZ,
					Extrude: extruding,
					Speed:   speed,
					Layer:   layer,
					LineNum: lineNum,
				}
				preview.Segments = append(preview.Segments, seg)

				if extruding {
					dx := newX - curX
					dy := newY - curY
					dz := newZ - curZ
					dist := sqrt(dx*dx + dy*dy + dz*dz)
					totalFilament += absFloat(newE-curE) + dist*0.01
				}

				preview.Bounds.MinX = minF(preview.Bounds.MinX, newX)
				preview.Bounds.MaxX = maxF(preview.Bounds.MaxX, newX)
				preview.Bounds.MinY = minF(preview.Bounds.MinY, newY)
				preview.Bounds.MaxY = maxF(preview.Bounds.MaxY, newY)
				preview.Bounds.MinZ = minF(preview.Bounds.MinZ, newZ)
				preview.Bounds.MaxZ = maxF(preview.Bounds.MaxZ, newZ)
			}

			curX, curY, curZ, curE = newX, newY, newZ, newE

		case cmd.Letter == "G" && cmd.Number == 28:
			curX, curY, curZ = 0, 0, 0
			curE = 0

		case cmd.Letter == "G" && cmd.Number == 92:
			if e, ok := cmd.GetParam("E"); ok {
				curE = e
			}

		case cmd.Letter == "M" && cmd.Number == 82:
			relativeE = false

		case cmd.Letter == "M" && cmd.Number == 83:
			relativeE = true
		}
	}

	preview.LayerCount = layer + 1
	preview.TotalLines = lineNum
	preview.FilamentMM = totalFilament
	preview.EstTime = totalFilament / 50.0

	return preview
}

func GetLayerSegments(preview *GCodePreview, layer int) []PathSegment {
	var result []PathSegment
	for _, seg := range preview.Segments {
		if seg.Layer == layer {
			result = append(result, seg)
		}
	}
	return result
}

func splitLines(s string) []string {
	var lines []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == '\n' || s[i] == '\r' {
			if i > start {
				lines = append(lines, s[start:i])
			}
			start = i + 1
		}
	}
	if start < len(s) {
		lines = append(lines, s[start:])
	}
	return lines
}

func minF(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

func maxF(a, b float64) float64 {
	if a > b {
		return a
	}
	return b
}

func absFloat(f float64) float64 {
	if f < 0 {
		return -f
	}
	return f
}

func sqrt(f float64) float64 {
	if f < 0 {
		return 0
	}
	z := f
	for i := 0; i < 10; i++ {
		z = (z + f/z) / 2
	}
	return z
}
