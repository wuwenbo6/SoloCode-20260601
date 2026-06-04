package lsping

import (
	"crypto/rand"
	"encoding/binary"
	"mpls-l2vpn-simulator/pkg/pw"
	"sync"
	"time"
)

type LSPPingType uint8

const (
	LSPPingEchoRequest LSPPingType = 1
	LSPPingEchoReply   LSPPingType = 2
)

type LSPPingMode uint8

const (
	LSPModePing      LSPPingMode = 0
	LSPModeTraceroute LSPPingMode = 1
)

type LSPPingMessage struct {
	Version           uint8
	MsgType           LSPPingType
	Mode              LSPPingMode
	ReplyMode         uint8
	ReturnCode        uint8
	ReturnSubcode     uint8
	SenderHandle      uint32
	SequenceNumber    uint32
	TimestampSent     uint64
	TimestampReceived uint64
	Timeout           uint16
	TargetFECStack    []*FECElement
	TLVs              []TLV
}

type TLV struct {
	Type   uint16
	Length uint16
	Value  []byte
}

const (
	TLVTypeTargetFECStack uint16 = 1
	TLVTypePad            uint16 = 2
	TLVTypeVendorPrivate  uint16 = 5
	TLVTypeVCCV           uint16 = 0x0C00
)

type LSPPingResult struct {
	Success        bool
	SequenceNumber uint32
	RTT            time.Duration
	ReturnCode     uint8
	ReturnSubcode  uint8
	Error          string
	FECType        string
}

type PingSession struct {
	sync.Mutex
	pw              *pw.Pseudowire
	pendingRequests map[uint32]time.Time
	nextSeqNum      uint32
	handle          uint32
}

func NewLSPPingMessage(msgType LSPPingType) *LSPPingMessage {
	handle := make([]byte, 4)
	rand.Read(handle)
	return &LSPPingMessage{
		Version:        1,
		MsgType:        msgType,
		Mode:           LSPModePing,
		ReplyMode:      2,
		SenderHandle:   binary.BigEndian.Uint32(handle),
		SequenceNumber: 1,
		TimestampSent:  uint64(time.Now().UnixNano()),
	}
}

func NewPingSession(pseudowire *pw.Pseudowire) *PingSession {
	handle := make([]byte, 4)
	rand.Read(handle)
	return &PingSession{
		pw:              pseudowire,
		pendingRequests: make(map[uint32]time.Time),
		nextSeqNum:      1,
		handle:          binary.BigEndian.Uint32(handle),
	}
}

func buildFECElement(p *pw.Pseudowire) *FECElement {
	switch p.FECType {
	case pw.FECType129:
		return &FECElement{
			FEC129: &FEC129{
				PWType: uint16(p.Type),
				AGI:    p.AGI,
				SAII:   p.SAII,
				TAII:   p.TAII,
			},
		}
	default:
		return &FECElement{
			FEC128: &FEC128{
				PWType: uint16(p.Type),
				PWID:   p.ID,
			},
		}
	}
}

func (ps *PingSession) CreateEchoRequest() *LSPPingMessage {
	ps.Lock()
	defer ps.Unlock()

	msg := NewLSPPingMessage(LSPPingEchoRequest)
	msg.SenderHandle = ps.handle
	msg.SequenceNumber = ps.nextSeqNum
	msg.TimestampSent = uint64(time.Now().UnixNano())

	fecElement := buildFECElement(ps.pw)
	msg.TargetFECStack = []*FECElement{fecElement}

	fecTLV := EncodeTargetFECStackTLV(msg.TargetFECStack)
	msg.TLVs = append(msg.TLVs, fecTLV)

	vccvTLV := TLV{
		Type:   TLVTypeVCCV,
		Length: 4,
		Value:  []byte{0x00, 0x00, 0x00, 0x01},
	}
	msg.TLVs = append(msg.TLVs, vccvTLV)

	ps.pendingRequests[ps.nextSeqNum] = time.Now()
	ps.nextSeqNum++

	return msg
}

func (ps *PingSession) ProcessEchoReply(reply *LSPPingMessage) LSPPingResult {
	ps.Lock()
	defer ps.Unlock()

	fecTypeStr := "FEC128"
	if ps.pw.FECType == pw.FECType129 {
		fecTypeStr = "FEC129"
	}

	result := LSPPingResult{
		SequenceNumber: reply.SequenceNumber,
		ReturnCode:     reply.ReturnCode,
		ReturnSubcode:  reply.ReturnSubcode,
		FECType:        fecTypeStr,
	}

	sentTime, exists := ps.pendingRequests[reply.SequenceNumber]
	if !exists {
		result.Success = false
		result.Error = "unknown sequence number"
		return result
	}

	delete(ps.pendingRequests, reply.SequenceNumber)
	result.RTT = time.Since(sentTime)

	if reply.ReturnCode == 0 {
		result.Success = true
	} else {
		result.Success = false
		result.Error = getReturnCodeDescription(reply.ReturnCode, reply.ReturnSubcode)
	}

	return result
}

func GenerateEchoReply(request *LSPPingMessage) *LSPPingMessage {
	reply := &LSPPingMessage{
		Version:           1,
		MsgType:           LSPPingEchoReply,
		Mode:              request.Mode,
		ReplyMode:         request.ReplyMode,
		SenderHandle:      request.SenderHandle,
		SequenceNumber:    request.SequenceNumber,
		TimestampSent:     uint64(time.Now().UnixNano()),
		TimestampReceived: request.TimestampSent,
		TargetFECStack:    request.TargetFECStack,
		ReturnCode:        0,
		ReturnSubcode:     0,
	}
	return reply
}

func GenerateErrorReply(request *LSPPingMessage, returnCode, returnSubcode uint8) *LSPPingMessage {
	reply := GenerateEchoReply(request)
	reply.ReturnCode = returnCode
	reply.ReturnSubcode = returnSubcode
	return reply
}

func getReturnCodeDescription(code, subcode uint8) string {
	switch code {
	case 0:
		return "Success"
	case 1:
		return "Malformed echo request"
	case 2:
		return "One or more TLVs not understood"
	case 3:
		return "Replying router is an egress for the FEC"
	case 4:
		switch subcode {
		case 1:
			return "FEC unknown at transit"
		case 2:
			return "FEC mismatch (no matching PW)"
		default:
			return "FEC unknown"
		}
	case 5:
		return "Downstream mapping mismatch"
	case 6:
		return "MPLS label switched at egress"
	case 7:
		return "FEC validation failed"
	default:
		return "Unknown error"
	}
}
