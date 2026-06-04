package pw

import (
	"mpls-l2vpn-simulator/pkg/mpls"
	"time"
)

type PWType uint16

const (
	PWTypeEthernet PWType = 0x0005
)

type PWStatus uint32

const (
	PWStatusUp        PWStatus = 0x00000000
	PWStatusDown      PWStatus = 0x00000001
	PWStatusNoFCS     PWStatus = 0x00000020
	LocalPEID                = "PE1"
	RemotePEID               = "PE2"
)

type FECType uint8

const (
	FECType128 FECType = 0x80
	FECType129 FECType = 0x81
)

type Pseudowire struct {
	ID              uint32
	Type            PWType
	FECType         FECType
	LocalLabel      mpls.Label
	RemoteLabel     mpls.Label
	Status          PWStatus
	MTU             uint16
	ControlWord     bool
	VCCVEnabled     bool
	LocalEndpoint   string
	RemoteEndpoint  string
	CreatedAt       time.Time
	AGI             []byte
	SAII            []byte
	TAII            []byte
}

type VCCVControlWord struct {
	ChannelType    uint8
	Flags          uint8
	SequenceNumber uint16
}

const (
	VCCVChannelTypeControl uint8 = 0x01
	VCCVChannelTypePing    uint8 = 0x02
)

func EncodeVCCVControlWord(cw VCCVControlWord) uint32 {
	return uint32(cw.ChannelType)<<24 | uint32(cw.Flags)<<16 | uint32(cw.SequenceNumber)
}

func DecodeVCCVControlWord(val uint32) VCCVControlWord {
	return VCCVControlWord{
		ChannelType:    uint8(val >> 24),
		Flags:          uint8((val >> 16) & 0xFF),
		SequenceNumber: uint16(val & 0xFFFF),
	}
}

func NewPseudowire(id uint32, localLabel, remoteLabel mpls.Label) *Pseudowire {
	return &Pseudowire{
		ID:             id,
		Type:           PWTypeEthernet,
		FECType:        FECType128,
		LocalLabel:     localLabel,
		RemoteLabel:    remoteLabel,
		Status:         PWStatusDown,
		MTU:            1500,
		ControlWord:    true,
		VCCVEnabled:    true,
		LocalEndpoint:  LocalPEID,
		RemoteEndpoint: RemotePEID,
		CreatedAt:      time.Now(),
	}
}

func NewPseudowireFEC129(id uint32, localLabel, remoteLabel mpls.Label, agi, saii, taii []byte) *Pseudowire {
	return &Pseudowire{
		ID:             id,
		Type:           PWTypeEthernet,
		FECType:        FECType129,
		LocalLabel:     localLabel,
		RemoteLabel:    remoteLabel,
		Status:         PWStatusDown,
		MTU:            1500,
		ControlWord:    true,
		VCCVEnabled:    true,
		LocalEndpoint:  LocalPEID,
		RemoteEndpoint: RemotePEID,
		CreatedAt:      time.Now(),
		AGI:            agi,
		SAII:           saii,
		TAII:           taii,
	}
}

func (pw *Pseudowire) SetStatus(status PWStatus) {
	pw.Status = status
}

func (pw *Pseudowire) IsUp() bool {
	return pw.Status == PWStatusUp
}
