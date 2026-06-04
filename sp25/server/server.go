package main

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"log"
	"math/big"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/quic-go/quic-go/http3"
	"github.com/quic-go/webtransport-go"
)

type Server struct {
	wtServer    *webtransport.Server
	simulator   *SensorSimulator
	sm          *SessionManager
	db          *PostgresRepo
	influx      *InfluxRepo
	threshold   *ThresholdManager
	alertEngine *AlertEngine
	apiHandler  *APIHandler
	httpMux     *http.ServeMux
	influxCh    chan SensorData
}

func NewServer(db *PostgresRepo, influx *InfluxRepo, tm *ThresholdManager, ae *AlertEngine) *Server {
	sim := NewSensorSimulator()
	sm := NewSessionManager()
	apiHandler := NewAPIHandler(db, sim, tm, ae)

	mux := http.NewServeMux()
	apiHandler.RegisterRoutes(mux)

	tlsConfig := generateTLSConfig()

	wt := &webtransport.Server{
		H3: http3.Server{
			Addr:      ":4433",
			TLSConfig: tlsConfig,
		},
		CheckOrigin: func(r *http.Request) bool { return true },
	}

	s := &Server{
		wtServer:    wt,
		simulator:   sim,
		sm:          sm,
		db:          db,
		influx:      influx,
		threshold:   tm,
		alertEngine: ae,
		apiHandler:  apiHandler,
		httpMux:     mux,
		influxCh:    make(chan SensorData, 50000),
	}

	mux.HandleFunc("/sensor-stream", func(w http.ResponseWriter, r *http.Request) {
		sess, err := wt.Upgrade(w, r)
		if err != nil {
			log.Printf("failed to upgrade to WebTransport: %v", err)
			w.WriteHeader(500)
			return
		}
		HandleWebTransport(sess, sm, influx, tm)
	})

	wt.H3.Handler = mux

	return s
}

func (s *Server) Start() error {
	go s.simulator.Start()
	go s.fanOutData()
	go s.batchWriteInflux()

	log.Printf("server starting on :4433 (HTTP/3 + WebTransport)")

	errCh := make(chan error, 1)
	go func() {
		if err := s.wtServer.ListenAndServe(); err != nil {
			errCh <- err
		}
	}()

	select {
	case err := <-errCh:
		return fmt.Errorf("server error: %w", err)
	case <-time.After(100 * time.Millisecond):
		return nil
	}
}

func (s *Server) fanOutData() {
	for data := range s.simulator.DataChannel() {
		s.sm.BroadcastData(data)

		alerts := s.alertEngine.ProcessData(data)
		for _, alert := range alerts {
			s.sm.BroadcastAlert(alert)
		}

		select {
		case s.influxCh <- data:
		default:
		}
	}
}

func (s *Server) batchWriteInflux() {
	if s.influx == nil {
		return
	}

	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	var batch []SensorData

	for {
		select {
		case data := <-s.influxCh:
			batch = append(batch, data)
			if len(batch) > 10000 {
				batch = batch[len(batch)-10000:]
			}
		case <-ticker.C:
			if len(batch) == 0 {
				continue
			}
			toWrite := make([]SensorData, len(batch))
			copy(toWrite, batch)
			batch = batch[:0]

			if err := s.influx.WriteSensorDataBatch(toWrite); err != nil {
				log.Printf("failed to write batch to influx: %v", err)
			}
		}
	}
}

func (s *Server) Shutdown(ctx context.Context) error {
	log.Printf("shutting down server...")
	s.simulator.Stop()

	if s.db != nil {
		s.db.Close()
	}
	if s.influx != nil {
		s.influx.Close()
	}

	return s.wtServer.Close()
}

func (s *Server) Run() error {
	if err := s.Start(); err != nil {
		return err
	}

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return s.Shutdown(ctx)
}

func generateTLSConfig() *tls.Config {
	certFile := os.Getenv("TLS_CERT_FILE")
	keyFile := os.Getenv("TLS_KEY_FILE")

	if certFile != "" && keyFile != "" {
		cert, err := tls.LoadX509KeyPair(certFile, keyFile)
		if err != nil {
			log.Fatalf("failed to load TLS cert: %v", err)
		}
		return &tls.Config{
			Certificates: []tls.Certificate{cert},
			NextProtos:   []string{"h3"},
		}
	}

	cert, err := generateSelfSignedCert()
	if err != nil {
		log.Fatalf("failed to generate self-signed cert: %v", err)
	}
	return &tls.Config{
		Certificates: []tls.Certificate{cert},
		NextProtos:   []string{"h3"},
	}
}

func generateSelfSignedCert() (tls.Certificate, error) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return tls.Certificate{}, err
	}

	template := x509.Certificate{
		SerialNumber: big.NewInt(1),
		NotBefore:    time.Now(),
		NotAfter:     time.Now().Add(365 * 24 * time.Hour),
		IPAddresses:  []net.IP{net.IPv4(127, 0, 0, 1), net.IPv6loopback},
		DNSNames:     []string{"localhost"},
	}

	certDER, err := x509.CreateCertificate(rand.Reader, &template, &template, &key.PublicKey, key)
	if err != nil {
		return tls.Certificate{}, err
	}

	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: certDER})
	privDER, err := x509.MarshalECPrivateKey(key)
	if err != nil {
		return tls.Certificate{}, err
	}
	keyPEM := pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: privDER})

	return tls.X509KeyPair(certPEM, keyPEM)
}
