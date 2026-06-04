package service

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"encoding/binary"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"log"
	"math"
	"math/big"
	"net"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/quic-go/quic-go"
	"github.com/quic-go/quic-go/http3"
	"github.com/quic-go/webtransport-go"
)

const (
	FRAME_HEADER_SIZE     = 17
	TELEMETRY_HEADER_SIZE = 13
	MAX_CLIENTS           = 16
)

type WTClient struct {
	id           string
	sess         *webtransport.Session
	lastSeen     time.Time
	bytesSent    uint64
	lastAckTime  time.Time
	estimatedBW  float64
	rtt          float64
	qualityLevel int
	gopSize      int
	dropFrameCnt int
	mu           sync.RWMutex
}

type WebTransportServer struct {
	server    *webtransport.Server
	gs        *GStreamerService
	ts        *TelemetryService
	clients   sync.Map
	count     atomic.Int32
	addr      string
	stopCh    chan struct{}
	frameIdx  atomic.Uint64
	baseTime  time.Time
	svcLayers int
}

func NewWebTransportServer(gs *GStreamerService, ts *TelemetryService, addr string) *WebTransportServer {
	w := &WebTransportServer{
		gs:        gs,
		ts:        ts,
		addr:      addr,
		stopCh:    make(chan struct{}),
		baseTime:  time.Now(),
		svcLayers: 3,
	}

	tlsCert := generateSelfSignedCert()

	mux := http.NewServeMux()
	mux.HandleFunc("/wt", w.handleWebTransport)

	h3Server := &http3.Server{
		Addr: addr,
		TLSConfig: &tls.Config{
			Certificates: []tls.Certificate{tlsCert},
			NextProtos:   []string{"h3"},
		},
		Handler: mux,
		QUICConfig: &quic.Config{
			EnableDatagrams:                  true,
			EnableStreamResetPartialDelivery: true,
			MaxIdleTimeout:                   30 * time.Second,
		},
	}

	webtransport.ConfigureHTTP3Server(h3Server)

	w.server = &webtransport.Server{
		H3:          h3Server,
		CheckOrigin: func(r *http.Request) bool { return true },
	}

	return w
}

func (w *WebTransportServer) ClientCount() int32 {
	return w.count.Load()
}

func (w *WebTransportServer) Start() error {
	go w.broadcastVideo()
	go w.broadcastTelemetry()
	go w.bandwidthMonitor()

	log.Printf("[WebTransport] Listening on %s (SVC layers: %d)\n", w.addr, w.svcLayers)
	return w.server.ListenAndServe()
}

func (w *WebTransportServer) Stop() {
	close(w.stopCh)
	w.server.Close()
}

func (w *WebTransportServer) getPTS() uint64 {
	return uint64(time.Since(w.baseTime).Microseconds())
}

func (w *WebTransportServer) handleWebTransport(hw http.ResponseWriter, r *http.Request) {
	sess, err := w.server.Upgrade(hw, r)
	if err != nil {
		log.Printf("[WebTransport] Upgrade failed: %v\n", err)
		hw.WriteHeader(http.StatusInternalServerError)
		return
	}

	clientID := fmt.Sprintf("client-%d", time.Now().UnixNano())
	client := &WTClient{
		id:           clientID,
		sess:         sess,
		lastSeen:     time.Now(),
		estimatedBW:  5_000_000,
		rtt:          50,
		qualityLevel: 2,
		gopSize:      30,
	}

	w.clients.Store(clientID, client)
	w.count.Add(1)
	log.Printf("[WebTransport] Client %s connected (total: %d)\n", clientID, w.count.Load())

	go w.handleClientDatagrams(client)

	<-sess.Context().Done()
	w.clients.Delete(clientID)
	w.count.Add(-1)
	log.Printf("[WebTransport] Client %s disconnected (total: %d)\n", clientID, w.count.Load())
}

func (w *WebTransportServer) handleClientDatagrams(client *WTClient) {
	for {
		select {
		case <-w.stopCh:
			return
		case <-client.sess.Context().Done():
			return
		default:
		}

		msg, err := client.sess.ReceiveDatagram(client.sess.Context())
		if err != nil {
			return
		}

		if len(msg) >= 1 && msg[0] == 0xAA {
			client.mu.Lock()
			now := time.Now()
			if !client.lastAckTime.IsZero() {
				rtt := now.Sub(client.lastAckTime).Milliseconds()
				client.rtt = client.rtt*0.8 + float64(rtt)*0.2
			}
			client.lastAckTime = now
			client.lastSeen = now
			client.mu.Unlock()
		}
	}
}

func (w *WebTransportServer) bandwidthMonitor() {
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-w.stopCh:
			return
		case <-ticker.C:
			w.adaptQuality()
		}
	}
}

func (w *WebTransportServer) adaptQuality() {
	w.clients.Range(func(key, value any) bool {
		client := value.(*WTClient)
		client.mu.Lock()
		defer client.mu.Unlock()

		rttMs := client.rtt
		var newQuality, newGOP int

		switch {
		case rttMs < 80:
			newQuality = 2
			newGOP = 60
		case rttMs < 150:
			newQuality = 2
			newGOP = 30
		case rttMs < 250:
			newQuality = 1
			newGOP = 15
		case rttMs < 400:
			newQuality = 1
			newGOP = 8
		default:
			newQuality = 0
			newGOP = 4
		}

		if newQuality != client.qualityLevel {
			log.Printf("[WebTransport] Client %s quality: %d -> %d (RTT: %.0fms)\n",
				client.id, client.qualityLevel, newQuality, rttMs)
			client.qualityLevel = newQuality
		}
		if newGOP != client.gopSize {
			log.Printf("[WebTransport] Client %s GOP: %d -> %d\n", client.id, client.gopSize, newGOP)
			client.gopSize = newGOP
		}

		return true
	})
}

func (w *WebTransportServer) broadcastVideo() {
	frames := w.gs.Frames()

	for {
		select {
		case <-w.stopCh:
			return
		case frame, ok := <-frames:
			if !ok {
				return
			}
			w.sendFrame(frame)
		}
	}
}

func (w *WebTransportServer) sendFrame(frame VideoFrame) {
	pts := w.getPTS()

	w.clients.Range(func(key, value any) bool {
		client := value.(*WTClient)
		client.mu.RLock()
		quality := client.qualityLevel
		client.mu.RUnlock()

		stream, err := client.sess.OpenUniStream()
		if err != nil {
			w.clients.Delete(key)
			w.count.Add(-1)
			return true
		}

		switch frame.Mode {
		case ModeH264:
			w.sendH264Frame(stream, frame, pts, quality)
		case ModeRGBA:
			w.sendRGBAFrame(stream, frame, pts, quality)
		}

		stream.Close()
		return true
	})
}

func (w *WebTransportServer) sendH264Frame(stream *webtransport.SendStream, frame VideoFrame, pts uint64, quality int) {
	frameIdx := w.frameIdx.Add(1)
	isKeyFrame := frameIdx%uint64(max(4, 60/int64(quality+1))) == 1

	for i, nal := range frame.H264Nals {
		nalData := stripStartCode(nal)
		if len(nalData) == 0 {
			continue
		}

		nalType := nalData[0] & 0x1f
		if nalType == 7 || nalType == 8 {
			// SPS/PPS: always send
		} else if !isKeyFrame && nalType == 5 {
			// IDR slice: only on keyframe
			continue
		} else if quality < 2 && i > len(frame.H264Nals)/2 {
			// Low quality: drop later NALs
			continue
		}

		header := make([]byte, FRAME_HEADER_SIZE)
		header[0] = 0x01
		binary.BigEndian.PutUint32(header[1:5], uint32(len(nalData)))
		binary.BigEndian.PutUint16(header[5:7], uint16(frame.Width))
		binary.BigEndian.PutUint16(header[7:9], uint16(frame.Height))
		binary.BigEndian.PutUint64(header[9:17], pts)

		if _, err := stream.Write(header); err != nil {
			return
		}
		if _, err := stream.Write(nalData); err != nil {
			return
		}
	}
}

func (w *WebTransportServer) sendRGBAFrame(stream *webtransport.SendStream, frame VideoFrame, pts uint64, quality int) {
	var pixelData []byte
	if quality >= 2 {
		pixelData = frame.RGBA
	} else if quality >= 1 {
		pixelData = w.downsampleRGBA(frame.RGBA, frame.Width, frame.Height, 2)
	} else {
		pixelData = w.downsampleRGBA(frame.RGBA, frame.Width, frame.Height, 4)
	}

	width := frame.Width
	height := frame.Height
	if quality == 1 {
		width /= 2
		height /= 2
	} else if quality == 0 {
		width /= 4
		height /= 4
	}

	header := make([]byte, FRAME_HEADER_SIZE)
	header[0] = 0x02
	binary.BigEndian.PutUint32(header[1:5], uint32(len(pixelData)))
	binary.BigEndian.PutUint16(header[5:7], uint16(width))
	binary.BigEndian.PutUint16(header[7:9], uint16(height))
	binary.BigEndian.PutUint64(header[9:17], pts)

	if _, err := stream.Write(header); err != nil {
		return
	}
	if _, err := stream.Write(pixelData); err != nil {
		return
	}
}

func (w *WebTransportServer) downsampleRGBA(src []byte, wd, ht, factor int) []byte {
	newW := wd / factor
	newH := ht / factor
	dst := make([]byte, newW*newH*4)

	for y := 0; y < newH; y++ {
		for x := 0; x < newW; x++ {
			srcY := y * factor
			srcX := x * factor
			srcIdx := (srcY*wd + srcX) * 4
			dstIdx := (y*newW + x) * 4
			dst[dstIdx] = src[srcIdx]
			dst[dstIdx+1] = src[srcIdx+1]
			dst[dstIdx+2] = src[srcIdx+2]
			dst[dstIdx+3] = src[srcIdx+3]
		}
	}
	return dst
}

func stripStartCode(nal []byte) []byte {
	if len(nal) >= 4 && nal[0] == 0 && nal[1] == 0 && nal[2] == 0 && nal[3] == 1 {
		return nal[4:]
	}
	if len(nal) >= 3 && nal[0] == 0 && nal[1] == 0 && nal[2] == 1 {
		return nal[3:]
	}
	return nal
}

func (w *WebTransportServer) broadcastTelemetry() {
	ticker := time.NewTicker(33 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-w.stopCh:
			return
		case <-ticker.C:
			data, gimbal := w.ts.GetCombined()
			w.sendTelemetry(data, gimbal)
		}
	}
}

func (w *WebTransportServer) sendTelemetry(data TelemetryData, gimbal GimbalAngles) {
	pts := w.getPTS()

	payload := map[string]any{
		"timestamp": data.Timestamp,
		"altitude":  data.Altitude,
		"speed":     data.Speed,
		"latitude":  data.Latitude,
		"longitude": data.Longitude,
		"battery":   data.Battery,
		"signal":    data.Signal,
		"heading":   data.Heading,
		"mode":      data.Mode,
		"gimbal": map[string]float64{
			"yaw":   gimbal.Yaw,
			"pitch": gimbal.Pitch,
			"roll":  gimbal.Roll,
		},
		"pts": pts,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return
	}

	w.clients.Range(func(key, value any) bool {
		client := value.(*WTClient)

		stream, err := client.sess.OpenUniStream()
		if err != nil {
			return true
		}

		header := make([]byte, TELEMETRY_HEADER_SIZE)
		header[0] = 0x03
		binary.BigEndian.PutUint32(header[1:5], uint32(len(jsonData)))
		binary.BigEndian.PutUint64(header[5:13], pts)

		if _, err := stream.Write(header); err != nil {
			stream.Close()
			return true
		}
		if _, err := stream.Write(jsonData); err != nil {
			stream.Close()
			return true
		}

		stream.Close()
		return true
	})
}

func generateSelfSignedCert() tls.Certificate {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		log.Fatal("Failed to generate RSA key:", err)
	}

	template := x509.Certificate{
		SerialNumber: big.NewInt(1),
		NotBefore:    time.Now(),
		NotAfter:     time.Now().Add(365 * 24 * time.Hour),
		IsCA:         true,
		KeyUsage:     x509.KeyUsageCertSign | x509.KeyUsageDigitalSignature,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		IPAddresses:  []net.IP{net.ParseIP("127.0.0.1"), net.ParseIP("::1")},
		DNSNames:     []string{"localhost"},
	}

	certDER, err := x509.CreateCertificate(rand.Reader, &template, &template, &key.PublicKey, key)
	if err != nil {
		log.Fatal("Failed to create certificate:", err)
	}

	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: certDER})
	keyPEM := pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)})

	tlsCert, err := tls.X509KeyPair(certPEM, keyPEM)
	if err != nil {
		log.Fatal("Failed to load TLS cert:", err)
	}

	return tlsCert
}

func max(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}

type BandwidthEstimate struct {
	EstimatedMbps float64
	RTTms         float64
	QualityLevel  int
	GOP           int
}

func (w *WebTransportServer) GetBandwidthStats() map[string]BandwidthEstimate {
	stats := make(map[string]BandwidthEstimate)
	w.clients.Range(func(key, value any) bool {
		client := value.(*WTClient)
		client.mu.RLock()
		stats[client.id] = BandwidthEstimate{
			EstimatedMbps: math.Round(client.estimatedBW/1_000_000*100) / 100,
			RTTms:         math.Round(client.rtt*100) / 100,
			QualityLevel:  client.qualityLevel,
			GOP:           client.gopSize,
		}
		client.mu.RUnlock()
		return true
	})
	return stats
}
