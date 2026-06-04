package lisp

import (
	"encoding/binary"
	"fmt"
	"lisp-mapserver/internal/mapping"
	"log"
	"net"
	"sync"
	"time"
)

const (
	TypeMapRegister  = 1
	TypeMapNotify    = 2
	TypeHeartbeat    = 3
	TypeHeartbeatAck = 4
	TypeMapRequest   = 5
	TypeMapReply     = 6

	FlagWantNotify = 0x01
	FlagProxyReply = 0x02
	FlagEtrOnline  = 0x04
	FlagEtrGrace   = 0x08
	FlagEtrOffline = 0x10
)

type MapRegisterMsg struct {
	KeyNumber    uint16
	Nonce        uint64
	Flags        uint8
	ETRRLOC      net.IP
	EIDPrefix    string
	EIDPrefixLen int
	TTL          int
	RLOCs        []mapping.RLOC
	WantNotify   bool
}

type MapNotifyMsg struct {
	Nonce uint64
}

type HeartbeatMsg struct {
	ETRRLOC net.IP
	Nonce   uint64
}

type MapRequestMsg struct {
	Nonce        uint64
	EIDPrefix    string
	EIDPrefixLen int
	SourceEID    string
}

type MapReplyMsg struct {
	Nonce        uint64
	EIDPrefix    string
	EIDPrefixLen int
	Flags        uint8
	TTL          int
	RLOCs        []mapping.RLOC
}

type Handler struct {
	store    *mapping.Store
	conn     *net.UDPConn
	addr     *net.UDPAddr
	stop     chan struct{}
	wg       sync.WaitGroup
	onNotify func(addr string, nonce uint64)
}

func NewHandler(store *mapping.Store, listenAddr string) (*Handler, error) {
	addr, err := net.ResolveUDPAddr("udp", listenAddr)
	if err != nil {
		return nil, fmt.Errorf("resolve udp addr: %w", err)
	}

	return &Handler{
		store: store,
		addr:  addr,
		stop:  make(chan struct{}),
	}, nil
}

func (h *Handler) Start() error {
	conn, err := net.ListenUDP("udp", h.addr)
	if err != nil {
		return fmt.Errorf("listen udp: %w", err)
	}
	h.conn = conn

	h.wg.Add(1)
	go h.readLoop()
	log.Printf("[lisp] handler started on %s", h.addr.String())
	return nil
}

func (h *Handler) Stop() {
	close(h.stop)
	if h.conn != nil {
		h.conn.Close()
	}
	h.wg.Wait()
	log.Println("[lisp] handler stopped")
}

func (h *Handler) readLoop() {
	defer h.wg.Done()

	buf := make([]byte, 4096)
	for {
		select {
		case <-h.stop:
			return
		default:
		}

		h.conn.SetReadDeadline(time.Now().Add(1 * time.Second))
		n, remoteAddr, err := h.conn.ReadFromUDP(buf)
		if err != nil {
			if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
				continue
			}
			if h.isStopped() {
				return
			}
			log.Printf("[lisp] read error: %v", err)
			continue
		}

		h.handlePacket(buf[:n], remoteAddr)
	}
}

func (h *Handler) isStopped() bool {
	select {
	case <-h.stop:
		return true
	default:
		return false
	}
}

func (h *Handler) handlePacket(data []byte, remoteAddr *net.UDPAddr) {
	if len(data) < 1 {
		return
	}

	msgType := data[0]
	switch msgType {
	case TypeMapRegister:
		h.handleMapRegister(data, remoteAddr)
	case TypeHeartbeat:
		h.handleHeartbeat(data, remoteAddr)
	case TypeMapRequest:
		h.handleMapRequest(data, remoteAddr)
	default:
		log.Printf("[lisp] unknown message type %d from %s", msgType, remoteAddr.String())
	}
}

func (h *Handler) handleMapRegister(data []byte, remoteAddr *net.UDPAddr) {
	if len(data) < 28 {
		log.Printf("[lisp] map-register too short from %s", remoteAddr.String())
		return
	}

	msg, err := parseMapRegister(data)
	if err != nil {
		log.Printf("[lisp] parse map-register error from %s: %v", remoteAddr.String(), err)
		return
	}

	etrAddr := remoteAddr.IP.String()
	if msg.ETRRLOC != nil && msg.ETRRLOC.To4() != nil {
		etrAddr = msg.ETRRLOC.String()
	}

	h.store.Register(msg.EIDPrefix, msg.EIDPrefixLen, msg.RLOCs, etrAddr, msg.TTL)
	h.store.UpdateETRHeartbeat(etrAddr)

	log.Printf("[lisp] map-register: EID=%s/%d ETR=%s RLOCs=%v", msg.EIDPrefix, msg.EIDPrefixLen, etrAddr, formatRLOCs(msg.RLOCs))

	if msg.WantNotify {
		h.sendMapNotify(remoteAddr, msg.Nonce)
	}
}

func (h *Handler) handleHeartbeat(data []byte, remoteAddr *net.UDPAddr) {
	if len(data) < 15 {
		log.Printf("[lisp] heartbeat too short from %s (len=%d)", remoteAddr.String(), len(data))
		return
	}

	msg, err := parseHeartbeat(data)
	if err != nil {
		log.Printf("[lisp] parse heartbeat error from %s: %v", remoteAddr.String(), err)
		return
	}

	etrAddr := remoteAddr.IP.String()
	if msg.ETRRLOC != nil && msg.ETRRLOC.To4() != nil {
		etrAddr = msg.ETRRLOC.String()
	}

	h.store.UpdateETRHeartbeat(etrAddr)
	log.Printf("[lisp] heartbeat from ETR=%s (nonce=%d)", etrAddr, msg.Nonce)

	h.sendHeartbeatAck(remoteAddr, msg.Nonce)
}

func (h *Handler) sendMapNotify(addr *net.UDPAddr, nonce uint64) {
	notify := make([]byte, 9)
	notify[0] = TypeMapNotify
	binary.BigEndian.PutUint64(notify[1:9], nonce)

	_, err := h.conn.WriteToUDP(notify, addr)
	if err != nil {
		log.Printf("[lisp] send map-notify error to %s: %v", addr.String(), err)
		return
	}
	log.Printf("[lisp] sent map-notify to %s (nonce=%d)", addr.String(), nonce)
}

func (h *Handler) sendHeartbeatAck(addr *net.UDPAddr, nonce uint64) {
	ack := make([]byte, 9)
	ack[0] = TypeHeartbeatAck
	binary.BigEndian.PutUint64(ack[1:9], nonce)

	_, err := h.conn.WriteToUDP(ack, addr)
	if err != nil {
		log.Printf("[lisp] send heartbeat-ack error to %s: %v", addr.String(), err)
		return
	}
	log.Printf("[lisp] sent heartbeat-ack to %s (nonce=%d)", addr.String(), nonce)
}

func (h *Handler) handleMapRequest(data []byte, remoteAddr *net.UDPAddr) {
	if len(data) < 25 {
		log.Printf("[lisp] map-request too short from %s (len=%d)", remoteAddr.String(), len(data))
		return
	}

	msg, err := parseMapRequest(data)
	if err != nil {
		log.Printf("[lisp] parse map-request error from %s: %v", remoteAddr.String(), err)
		return
	}

	log.Printf("[lisp] map-request for EID=%s/%d from %s", msg.EIDPrefix, msg.EIDPrefixLen, remoteAddr.String())

	entry, exists := h.store.Lookup(msg.EIDPrefix)
	if !exists {
		log.Printf("[lisp] map-request: no mapping found for EID=%s", msg.EIDPrefix)
		return
	}

	etr, etrExists := h.store.GetETR(entry.ETRAddr)
	if !etrExists {
		log.Printf("[lisp] map-request: ETR %s not found for EID=%s", entry.ETRAddr, msg.EIDPrefix)
		return
	}

	var flags uint8
	reply := false

	if etr.Online {
		flags |= FlagEtrOnline
		reply = true
	} else if etr.InGracePeriod {
		flags |= FlagEtrGrace | FlagProxyReply
		reply = true
	} else {
		flags |= FlagEtrOffline
		reply = false
	}

	if reply {
		h.store.IncrementProxyReplies()
		replyMsg := MapReplyMsg{
			Nonce:        msg.Nonce,
			EIDPrefix:    msg.EIDPrefix,
			EIDPrefixLen: msg.EIDPrefixLen,
			Flags:        flags,
			TTL:          entry.TTL,
			RLOCs:        entry.RLOCs,
		}

		replyBytes := BuildMapReply(replyMsg)
		_, err := h.conn.WriteToUDP(replyBytes, remoteAddr)
		if err != nil {
			log.Printf("[lisp] send map-reply error to %s: %v", remoteAddr.String(), err)
			return
		}

		state := "online"
		if etr.InGracePeriod {
			state = "grace-period"
		}
		log.Printf("[lisp] sent map-reply to %s (nonce=%d, state=%s, rlocs=%d)",
			remoteAddr.String(), msg.Nonce, state, len(entry.RLOCs))
	} else {
		log.Printf("[lisp] map-request: not replying for EID=%s (ETR offline)", msg.EIDPrefix)
	}
}

func (h *Handler) sendMapReply(addr *net.UDPAddr, msg *MapReplyMsg) {
	replyBytes := BuildMapReply(*msg)
	_, err := h.conn.WriteToUDP(replyBytes, addr)
	if err != nil {
		log.Printf("[lisp] send map-reply error to %s: %v", addr.String(), err)
		return
	}
	log.Printf("[lisp] sent map-reply to %s (nonce=%d, rlocs=%d)", addr.String(), msg.Nonce, len(msg.RLOCs))
}

func parseMapRequest(data []byte) (*MapRequestMsg, error) {
	msg := &MapRequestMsg{}

	offset := 1

	msg.Nonce = binary.BigEndian.Uint64(data[offset : offset+8])
	offset += 8

	eidAfi := binary.BigEndian.Uint16(data[offset : offset+2])
	offset += 2

	var eid net.IP
	if eidAfi == 1 {
		if len(data) < offset+4 {
			return nil, fmt.Errorf("insufficient data for IPv4 EID")
		}
		eid = net.IP(data[offset : offset+4])
		offset += 4
	} else if eidAfi == 2 {
		if len(data) < offset+16 {
			return nil, fmt.Errorf("insufficient data for IPv6 EID")
		}
		eid = net.IP(data[offset : offset+16])
		offset += 16
	} else {
		return nil, fmt.Errorf("unsupported EID AFI %d", eidAfi)
	}

	msg.EIDPrefix = eid.String()

	prefixLen := int(data[offset])
	msg.EIDPrefixLen = prefixLen
	offset += 1

	if len(data) >= offset+2 {
		srcAfi := binary.BigEndian.Uint16(data[offset : offset+2])
		offset += 2
		if srcAfi == 1 && len(data) >= offset+4 {
			msg.SourceEID = net.IP(data[offset : offset+4]).String()
			offset += 4
		} else if srcAfi == 2 && len(data) >= offset+16 {
			msg.SourceEID = net.IP(data[offset : offset+16]).String()
			offset += 16
		}
	}

	return msg, nil
}

func BuildMapReply(msg MapReplyMsg) []byte {
	eid := net.ParseIP(msg.EIDPrefix)
	size := 1 + 8 + 1 + 4 + 2

	if eid.To4() != nil {
		size += 4
	} else {
		size += 16
	}
	size += 1

	for _, rloc := range msg.RLOCs {
		size += 3 + 2
		if rloc.Address.To4() != nil {
			size += 4
		} else {
			size += 16
		}
	}

	buf := make([]byte, size)
	offset := 0

	buf[offset] = TypeMapReply
	offset++

	binary.BigEndian.PutUint64(buf[offset:offset+8], msg.Nonce)
	offset += 8

	buf[offset] = msg.Flags
	offset++

	binary.BigEndian.PutUint32(buf[offset:offset+4], uint32(msg.TTL))
	offset += 4

	buf[offset] = uint8(len(msg.RLOCs))
	offset++

	if eid.To4() != nil {
		binary.BigEndian.PutUint16(buf[offset:offset+2], 1)
		offset += 2
		copy(buf[offset:offset+4], eid.To4())
		offset += 4
	} else {
		binary.BigEndian.PutUint16(buf[offset:offset+2], 2)
		offset += 2
		copy(buf[offset:offset+16], eid.To16())
		offset += 16
	}

	buf[offset] = uint8(msg.EIDPrefixLen)
	offset++

	for _, rloc := range msg.RLOCs {
		buf[offset] = uint8(rloc.Priority)
		buf[offset+1] = uint8(rloc.Weight)
		if rloc.Multicast {
			buf[offset+2] = 1
		}
		offset += 3

		if rloc.Address.To4() != nil {
			binary.BigEndian.PutUint16(buf[offset:offset+2], 1)
			offset += 2
			copy(buf[offset:offset+4], rloc.Address.To4())
			offset += 4
		} else {
			binary.BigEndian.PutUint16(buf[offset:offset+2], 2)
			offset += 2
			copy(buf[offset:offset+16], rloc.Address.To16())
			offset += 16
		}
	}

	return buf
}

func BuildMapRequest(nonce uint64, eid net.IP, eidPrefixLen int, sourceEID net.IP) []byte {
	size := 1 + 8 + 2
	if eid.To4() != nil {
		size += 4
	} else {
		size += 16
	}
	size += 1

	if sourceEID != nil {
		size += 2
		if sourceEID.To4() != nil {
			size += 4
		} else {
			size += 16
		}
	}

	buf := make([]byte, size)
	offset := 0

	buf[offset] = TypeMapRequest
	offset++

	binary.BigEndian.PutUint64(buf[offset:offset+8], nonce)
	offset += 8

	if eid.To4() != nil {
		binary.BigEndian.PutUint16(buf[offset:offset+2], 1)
		offset += 2
		copy(buf[offset:offset+4], eid.To4())
		offset += 4
	} else {
		binary.BigEndian.PutUint16(buf[offset:offset+2], 2)
		offset += 2
		copy(buf[offset:offset+16], eid.To16())
		offset += 16
	}

	buf[offset] = uint8(eidPrefixLen)
	offset++

	if sourceEID != nil {
		if sourceEID.To4() != nil {
			binary.BigEndian.PutUint16(buf[offset:offset+2], 1)
			offset += 2
			copy(buf[offset:offset+4], sourceEID.To4())
			offset += 4
		} else {
			binary.BigEndian.PutUint16(buf[offset:offset+2], 2)
			offset += 2
			copy(buf[offset:offset+16], sourceEID.To16())
			offset += 16
		}
	}

	return buf
}

func parseMapRegister(data []byte) (*MapRegisterMsg, error) {
	msg := &MapRegisterMsg{}

	offset := 1

	msg.KeyNumber = binary.BigEndian.Uint16(data[offset : offset+2])
	offset += 2

	msg.Nonce = binary.BigEndian.Uint64(data[offset : offset+8])
	offset += 8

	msg.Flags = data[offset]
	offset += 1

	msg.WantNotify = msg.Flags&FlagWantNotify != 0

	ttl := binary.BigEndian.Uint32(data[offset : offset+4])
	msg.TTL = int(ttl)
	offset += 4

	rlocCount := int(data[offset])
	offset += 1

	eidAfi := binary.BigEndian.Uint16(data[offset : offset+2])
	offset += 2

	var eid net.IP
	if eidAfi == 1 {
		if len(data) < offset+4 {
			return nil, fmt.Errorf("insufficient data for IPv4 EID")
		}
		eid = net.IP(data[offset : offset+4])
		offset += 4
	} else if eidAfi == 2 {
		if len(data) < offset+16 {
			return nil, fmt.Errorf("insufficient data for IPv6 EID")
		}
		eid = net.IP(data[offset : offset+16])
		offset += 16
	} else {
		return nil, fmt.Errorf("unsupported EID AFI %d", eidAfi)
	}

	msg.EIDPrefix = eid.String()

	prefixLen := int(data[offset])
	msg.EIDPrefixLen = prefixLen
	offset += 1

	etrAfi := binary.BigEndian.Uint16(data[offset : offset+2])
	offset += 2

	if etrAfi == 1 {
		if len(data) < offset+4 {
			return nil, fmt.Errorf("insufficient data for IPv4 ETR RLOC")
		}
		msg.ETRRLOC = net.IP(data[offset : offset+4])
		offset += 4
	} else if etrAfi == 2 {
		if len(data) < offset+16 {
			return nil, fmt.Errorf("insufficient data for IPv6 ETR RLOC")
		}
		msg.ETRRLOC = net.IP(data[offset : offset+16])
		offset += 16
	}

	msg.RLOCs = make([]mapping.RLOC, 0, rlocCount)
	for i := 0; i < rlocCount; i++ {
		if len(data) < offset+7 {
			break
		}
		rloc := mapping.RLOC{
			Priority:  int(data[offset]),
			Weight:    int(data[offset+1]),
			Multicast: data[offset+2] != 0,
		}
		offset += 3

		rlocAfi := binary.BigEndian.Uint16(data[offset : offset+2])
		offset += 2

		if rlocAfi == 1 {
			if len(data) < offset+4 {
				break
			}
			rloc.Address = net.IP(data[offset : offset+4])
			offset += 4
		} else if rlocAfi == 2 {
			if len(data) < offset+16 {
				break
			}
			rloc.Address = net.IP(data[offset : offset+16])
			offset += 16
		}

		msg.RLOCs = append(msg.RLOCs, rloc)
	}

	return msg, nil
}

func parseHeartbeat(data []byte) (*HeartbeatMsg, error) {
	msg := &HeartbeatMsg{}

	offset := 1

	afi := binary.BigEndian.Uint16(data[offset : offset+2])
	offset += 2

	if afi == 1 {
		if len(data) < offset+4 {
			return nil, fmt.Errorf("insufficient data for IPv4 ETR RLOC")
		}
		msg.ETRRLOC = net.IP(data[offset : offset+4])
		offset += 4
	} else if afi == 2 {
		if len(data) < offset+16 {
			return nil, fmt.Errorf("insufficient data for IPv6 ETR RLOC")
		}
		msg.ETRRLOC = net.IP(data[offset : offset+16])
		offset += 16
	}

	if len(data) >= offset+8 {
		msg.Nonce = binary.BigEndian.Uint64(data[offset : offset+8])
	}

	return msg, nil
}

func formatRLOCs(rlocs []mapping.RLOC) string {
	result := ""
	for i, rloc := range rlocs {
		if i > 0 {
			result += ", "
		}
		result += rloc.Address.String()
	}
	return result
}

func BuildMapRegister(keyNumber uint16, nonce uint64, wantNotify bool, ttl uint32, eid net.IP, eidPrefixLen int, etrRLOC net.IP, rlocs []mapping.RLOC) []byte {
	size := 1 + 2 + 8 + 1 + 4 + 1 + 2
	if eid.To4() != nil {
		size += 4
	} else {
		size += 16
	}
	size += 1
	if etrRLOC.To4() != nil {
		size += 2 + 4
	} else {
		size += 2 + 16
	}
	for _, rloc := range rlocs {
		size += 3 + 2
		if rloc.Address.To4() != nil {
			size += 4
		} else {
			size += 16
		}
	}

	buf := make([]byte, size)
	offset := 0

	buf[offset] = TypeMapRegister
	offset++

	binary.BigEndian.PutUint16(buf[offset:offset+2], keyNumber)
	offset += 2

	binary.BigEndian.PutUint64(buf[offset:offset+8], nonce)
	offset += 8

	flags := uint8(0)
	if wantNotify {
		flags |= FlagWantNotify
	}
	buf[offset] = flags
	offset++

	binary.BigEndian.PutUint32(buf[offset:offset+4], ttl)
	offset += 4

	buf[offset] = uint8(len(rlocs))
	offset++

	if eid.To4() != nil {
		binary.BigEndian.PutUint16(buf[offset:offset+2], 1)
		offset += 2
		copy(buf[offset:offset+4], eid.To4())
		offset += 4
	} else {
		binary.BigEndian.PutUint16(buf[offset:offset+2], 2)
		offset += 2
		copy(buf[offset:offset+16], eid.To16())
		offset += 16
	}

	buf[offset] = uint8(eidPrefixLen)
	offset++

	if etrRLOC.To4() != nil {
		binary.BigEndian.PutUint16(buf[offset:offset+2], 1)
		offset += 2
		copy(buf[offset:offset+4], etrRLOC.To4())
		offset += 4
	} else {
		binary.BigEndian.PutUint16(buf[offset:offset+2], 2)
		offset += 2
		copy(buf[offset:offset+16], etrRLOC.To16())
		offset += 16
	}

	for _, rloc := range rlocs {
		buf[offset] = uint8(rloc.Priority)
		buf[offset+1] = uint8(rloc.Weight)
		if rloc.Multicast {
			buf[offset+2] = 1
		}
		offset += 3

		if rloc.Address.To4() != nil {
			binary.BigEndian.PutUint16(buf[offset:offset+2], 1)
			offset += 2
			copy(buf[offset:offset+4], rloc.Address.To4())
			offset += 4
		} else {
			binary.BigEndian.PutUint16(buf[offset:offset+2], 2)
			offset += 2
			copy(buf[offset:offset+16], rloc.Address.To16())
			offset += 16
		}
	}

	return buf
}

func BuildHeartbeat(etrRLOC net.IP, nonce uint64) []byte {
	size := 1 + 2
	if etrRLOC.To4() != nil {
		size += 4
	} else {
		size += 16
	}
	size += 8

	buf := make([]byte, size)
	offset := 0

	buf[offset] = TypeHeartbeat
	offset++

	if etrRLOC.To4() != nil {
		binary.BigEndian.PutUint16(buf[offset:offset+2], 1)
		offset += 2
		copy(buf[offset:offset+4], etrRLOC.To4())
		offset += 4
	} else {
		binary.BigEndian.PutUint16(buf[offset:offset+2], 2)
		offset += 2
		copy(buf[offset:offset+16], etrRLOC.To16())
		offset += 16
	}

	binary.BigEndian.PutUint64(buf[offset:offset+8], nonce)

	return buf
}
