package service

import (
	"encoding/binary"
	"fmt"
	"image"
	"image/color"
	"io"
	"log"
	"math"
	"os/exec"
	"strings"
	"sync"
	"time"
)

type VideoMode int

const (
	ModeH264 VideoMode = iota
	ModeRGBA
)

type VideoFrame struct {
	Mode     VideoMode
	H264Nals [][]byte
	RGBA     []byte
	Width    int
	Height   int
	PTS      time.Duration
}

type GStreamerService struct {
	mu       sync.RWMutex
	running  bool
	mode     VideoMode
	frames   chan VideoFrame
	stopCh   chan struct{}
	cmd      *exec.Cmd
	width    int
	height   int
	fps      int
	frameIdx int64
}

func NewGStreamerService() *GStreamerService {
	return &GStreamerService{
		frames: make(chan VideoFrame, 60),
		stopCh: make(chan struct{}),
		width:  1280,
		height: 720,
		fps:    30,
	}
}

func (g *GStreamerService) IsRunning() bool {
	g.mu.RLock()
	defer g.mu.RUnlock()
	return g.running
}

func (g *GStreamerService) Mode() VideoMode {
	g.mu.RLock()
	defer g.mu.RUnlock()
	return g.mode
}

func (g *GStreamerService) Frames() <-chan VideoFrame {
	return g.frames
}

func (g *GStreamerService) Start() error {
	g.mu.Lock()
	if g.running {
		g.mu.Unlock()
		return fmt.Errorf("already running")
	}
	g.running = true
	g.stopCh = make(chan struct{})
	g.mu.Unlock()

	if g.tryGStreamer() {
		g.mu.Lock()
		g.mode = ModeH264
		g.mu.Unlock()
		log.Println("[GStreamer] Using GStreamer H.264 pipeline")
		return nil
	}

	log.Println("[GStreamer] GStreamer not available, falling back to RGBA test pattern")
	g.mu.Lock()
	g.mode = ModeRGBA
	g.mu.Unlock()
	go g.runRGBAFallback()
	return nil
}

func (g *GStreamerService) Stop() {
	g.mu.Lock()
	defer g.mu.Unlock()
	if !g.running {
		return
	}
	g.running = false
	close(g.stopCh)
	if g.cmd != nil && g.cmd.Process != nil {
		g.cmd.Process.Kill()
		g.cmd = nil
	}
}

func (g *GStreamerService) tryGStreamer() bool {
	if _, err := exec.LookPath("gst-launch-1.0"); err != nil {
		return false
	}

	pipeline := fmt.Sprintf(
		"videotestsrc pattern=ball ! video/x-raw,width=%d,height=%d,framerate=%d/1 ! "+
			"x264enc bitrate=2000 key-int-max=30 tune=zerolatency speed-preset=ultrafast ! "+
			"h264parse config-interval=-1 ! "+
			"appsink name=sink emit-signals=true drop=true max-buffers=2",
		g.width, g.height, g.fps,
	)

	cmd := exec.Command("gst-launch-1.0", strings.Fields(pipeline)...)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return false
	}
	if err := cmd.Start(); err != nil {
		return false
	}

	g.cmd = cmd
	go g.readGStreamerOutput(stdout)
	return true
}

func (g *GStreamerService) readGStreamerOutput(stdout io.Reader) {
	buf := make([]byte, 65536)
	var pending []byte

	for {
		select {
		case <-g.stopCh:
			return
		default:
		}

		n, err := stdout.Read(buf)
		if err != nil {
			log.Println("[GStreamer] Pipeline ended:", err)
			return
		}

		pending = append(pending, buf[:n]...)

		for {
			nals := extractNALUnits(pending)
			if len(nals) == 0 {
				break
			}

			var completeNals [][]byte
			totalEnd := 0
			for _, nal := range nals {
				if isCompleteNAL(nal) {
					completeNals = append(completeNals, nal)
					end := findNextNALOffset(pending, totalEnd+len(nal))
					if end > 0 {
						totalEnd = end
					} else {
						totalEnd = len(pending)
					}
				}
			}

			if len(completeNals) > 0 {
				select {
				case g.frames <- VideoFrame{
					Mode:     ModeH264,
					H264Nals: completeNals,
					Width:    g.width,
					Height:   g.height,
					PTS:      time.Duration(g.frameIdx) * time.Second / time.Duration(g.fps),
				}:
					g.frameIdx++
				default:
				}
				if totalEnd > 0 && totalEnd < len(pending) {
					pending = pending[totalEnd:]
				} else {
					pending = nil
				}
			} else {
				break
			}
		}

		if len(pending) > 4*1024*1024 {
			pending = pending[len(pending)-2*1024*1024:]
		}
	}
}

func extractNALUnits(data []byte) [][]byte {
	var nals [][]byte
	i := 0
	for i < len(data)-3 {
		if data[i] == 0 && data[i+1] == 0 {
			if data[i+2] == 1 {
				nals = append(nals, data[i:])
				i += 3
				continue
			}
			if i < len(data)-4 && data[i+2] == 0 && data[i+3] == 1 {
				nals = append(nals, data[i:])
				i += 4
				continue
			}
		}
		i++
	}
	return nals
}

func isCompleteNAL(nal []byte) bool {
	if len(nal) < 5 {
		return false
	}
	scLen := 3
	if nal[2] == 0 && len(nal) > 3 && nal[3] == 1 {
		scLen = 4
	}
	inner := nal[scLen:]
	for i := 0; i < len(inner)-3; i++ {
		if inner[i] == 0 && inner[i+1] == 0 && inner[i+2] == 1 {
			return true
		}
		if inner[i] == 0 && inner[i+1] == 0 && inner[i+2] == 0 && i < len(inner)-4 && inner[i+3] == 1 {
			return true
		}
	}
	return false
}

func findNextNALOffset(data []byte, startIdx int) int {
	for i := startIdx; i < len(data)-3; i++ {
		if data[i] == 0 && data[i+1] == 0 {
			if data[i+2] == 1 {
				return i
			}
			if i < len(data)-4 && data[i+2] == 0 && data[i+3] == 1 {
				return i
			}
		}
	}
	return -1
}

func (g *GStreamerService) runRGBAFallback() {
	defer func() {
		log.Println("[GStreamer] RGBA fallback stopped")
	}()

	w := 320
	h := 240
	interval := time.Second / time.Duration(g.fps)
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	ballX := float64(w / 2)
	ballY := float64(h / 2)
	vx := 3.0
	vy := 2.0
	ballR := 15.0

	for {
		select {
		case <-g.stopCh:
			return
		case <-ticker.C:
		}

		ballX += vx
		ballY += vy
		if ballX-ballR < 0 || ballX+ballR >= float64(w) {
			vx = -vx
		}
		if ballY-ballR < 0 || ballY+ballR >= float64(h) {
			vy = -vy
		}

		img := image.NewRGBA(image.Rect(0, 0, w, h))
		for y := 0; y < h; y++ {
			for x := 0; x < w; x++ {
				dx := float64(x) - ballX
				dy := float64(y) - ballY
				if dx*dx+dy*dy < ballR*ballR {
					img.SetRGBA(x, y, color.RGBA{R: 255, G: 80, B: 80, A: 255})
				} else if y < h/3 {
					barIdx := x / (w / 8)
					colors := []color.RGBA{
						{192, 192, 192, 255}, {192, 192, 192, 255},
						{0, 0, 192, 255}, {0, 0, 192, 255},
						{0, 192, 0, 255}, {0, 192, 0, 255},
						{192, 0, 0, 255}, {192, 0, 0, 255},
					}
					img.SetRGBA(x, y, colors[barIdx%len(colors)])
				} else {
					gray := uint8(40 + uint8(math.Sin(float64(x)*0.05+float64(g.frameIdx)*0.1)*20))
					img.SetRGBA(x, y, color.RGBA{R: gray, G: gray, B: gray + 20, A: 255})
				}
			}
		}

		overlayText(img, w, h, g.frameIdx)

		select {
		case g.frames <- VideoFrame{
			Mode:   ModeRGBA,
			RGBA:   img.Pix,
			Width:  w,
			Height: h,
			PTS:    time.Duration(g.frameIdx) * time.Second / time.Duration(g.fps),
		}:
		default:
		}
		g.frameIdx++
	}
}

func overlayText(img *image.RGBA, w, h int, frameIdx int64) {
	t := time.Now().Format("15:04:05.000")
	drawSimpleText(img, w, h, 10, 10, t, color.RGBA{R: 255, G: 255, B: 0, A: 255})

	fps := fmt.Sprintf("FRAME:%06d", frameIdx)
	drawSimpleText(img, w, h, 10, 25, fps, color.RGBA{R: 0, G: 255, B: 0, A: 255})

	rec := fmt.Sprintf("REC ●")
	if frameIdx%30 < 15 {
		drawSimpleText(img, w, h, w-70, 10, rec, color.RGBA{R: 255, G: 0, B: 0, A: 255})
	}
}

func drawSimpleText(img *image.RGBA, w, h, startX, startY int, text string, col color.RGBA) {
	font := map[rune][]string{
		'0': {"0110", "1001", "1001", "1001", "0110"},
		'1': {"0010", "0110", "0010", "0010", "0111"},
		'2': {"0110", "1001", "0010", "0100", "1111"},
		'3': {"0110", "1001", "0010", "1001", "0110"},
		'4': {"0001", "0011", "0101", "1111", "0001"},
		'5': {"1111", "1000", "1110", "0001", "1110"},
		'6': {"0110", "1000", "1110", "1001", "0110"},
		'7': {"1111", "0001", "0010", "0100", "0100"},
		'8': {"0110", "1001", "0110", "1001", "0110"},
		'9': {"0110", "1001", "0111", "0001", "0110"},
		':': {"00", "10", "00", "10", "00"},
		'.': {"0", "0", "0", "0", "1"},
		'F': {"1111", "1000", "1110", "1000", "1000"},
		'R': {"1110", "1001", "1110", "1010", "1001"},
		'A': {"0110", "1001", "1111", "1001", "1001"},
		'M': {"10001", "11011", "10101", "10001", "10001"},
		'E': {"1111", "1000", "1110", "1000", "1111"},
		'●': {"0110", "1111", "1111", "1111", "0110"},
		' ': {"00", "00", "00", "00", "00"},
	}

	x := startX
	for _, ch := range text {
		glyph, ok := font[ch]
		if !ok {
			x += 5
			continue
		}
		for row, line := range glyph {
			for bitIdx, c := range line {
				if c == '1' {
					px := x + bitIdx
					py := startY + row
					if px >= 0 && px < w && py >= 0 && py < h {
						idx := (py*w + px) * 4
						img.Pix[idx] = col.R
						img.Pix[idx+1] = col.G
						img.Pix[idx+2] = col.B
						img.Pix[idx+3] = col.A
					}
				}
			}
		}
		x += len(glyph[0]) + 1
	}
}

func makeBigEndianUint32(v uint32) []byte {
	b := make([]byte, 4)
	binary.BigEndian.PutUint32(b, v)
	return b
}
