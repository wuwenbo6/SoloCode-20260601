package main

import (
	"flag"
	"fmt"
	"lisp-mapserver/internal/lisp"
	"lisp-mapserver/internal/mapping"
	"log"
	"math/rand"
	"net"
	"time"
)

func main() {
	serverAddr := flag.String("server", "127.0.0.1:4342", "LISP Map-Server address")
	httpAddr := flag.String("http", "127.0.0.1:8080", "Map-Server HTTP address")
	etrRLOC := flag.String("rloc", "192.168.1.100", "ETR RLOC address")
	eidPrefix := flag.String("eid", "10.0.1.0", "EID prefix")
	eidPrefixLen := flag.Int("prefix-len", 24, "EID prefix length")
	heartbeatInterval := flag.Duration("interval", 5*time.Second, "Heartbeat interval")
	numRLOCs := flag.Int("rlocs", 2, "Number of RLOCs to register")
	flag.Parse()

	rlocIP := net.ParseIP(*etrRLOC)
	if rlocIP == nil {
		log.Fatalf("Invalid RLOC address: %s", *etrRLOC)
	}

	eidIP := net.ParseIP(*eidPrefix)
	if eidIP == nil {
		log.Fatalf("Invalid EID prefix: %s", *eidPrefix)
	}

	conn, err := net.Dial("udp", *serverAddr)
	if err != nil {
		log.Fatalf("Failed to connect to Map-Server: %v", err)
	}
	defer conn.Close()

	rlocs := make([]mapping.RLOC, *numRLOCs)
	for i := 0; i < *numRLOCs; i++ {
		rlocAddr := fmt.Sprintf("192.168.1.%d", 100+i)
		rlocs[i] = mapping.RLOC{
			Address:  net.ParseIP(rlocAddr),
			Priority: i + 1,
			Weight:   100,
		}
	}

	nonce := rand.Uint64()
	regMsg := lisp.BuildMapRegister(1, nonce, true, 60, eidIP, *eidPrefixLen, rlocIP, rlocs)

	_, err = conn.Write(regMsg)
	if err != nil {
		log.Fatalf("Failed to send Map-Register: %v", err)
	}
	log.Printf("[etr] Sent Map-Register: EID=%s/%d ETR=%s", *eidPrefix, *eidPrefixLen, *etrRLOC)

	buf := make([]byte, 4096)
	conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	n, err := conn.Read(buf)
	if err != nil {
		log.Printf("[etr] No Map-Notify received (timeout): %v", err)
	} else {
		if n > 0 && buf[0] == lisp.TypeMapNotify {
			log.Printf("[etr] Received Map-Notify (%d bytes)", n)
		}
	}

	fmt.Println()
	fmt.Printf("  ETR Simulator Running\n")
	fmt.Printf("  Server: %s (UDP) / %s (HTTP)\n", *serverAddr, *httpAddr)
	fmt.Printf("  ETR RLOC: %s\n", *etrRLOC)
	fmt.Printf("  EID: %s/%d\n", *eidPrefix, *eidPrefixLen)
	fmt.Printf("  Heartbeat: every %s\n", *heartbeatInterval)
	fmt.Printf("  Dashboard: http://%s\n", *httpAddr)
	fmt.Println()

	ticker := time.NewTicker(*heartbeatInterval)
	defer ticker.Stop()

	go func() {
		readBuf := make([]byte, 4096)
		for {
			conn.SetReadDeadline(time.Now().Add(1 * time.Second))
			n, err := conn.Read(readBuf)
			if err != nil {
				if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
					continue
				}
				return
			}
			if n >= 9 {
				msgType := readBuf[0]
				if msgType == lisp.TypeHeartbeatAck {
					ackNonce := uint64(0)
					for i := 0; i < 8; i++ {
						ackNonce = (ackNonce << 8) | uint64(readBuf[1+i])
					}
					log.Printf("[etr] Received HeartbeatAck (nonce=%d)", ackNonce)
				}
			}
		}
	}()

	for range ticker.C {
		hbNonce := rand.Uint64()
		hbMsg := lisp.BuildHeartbeat(rlocIP, hbNonce)

		_, err := conn.Write(hbMsg)
		if err != nil {
			log.Printf("[etr] Heartbeat failed: %v", err)
			continue
		}
		log.Printf("[etr] Heartbeat sent (nonce=%d)", hbNonce)
	}
}
