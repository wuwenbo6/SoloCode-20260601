package lsping

import (
	"encoding/binary"
)

type FECType uint8

const (
	FECType128 FECType = 0x80
	FECType129 FECType = 0x81
)

type FEC128 struct {
	PWType uint16
	PWID   uint32
}

func (f *FEC128) Type() FECType {
	return FECType128
}

func (f *FEC128) Encode() []byte {
	buf := make([]byte, 7)
	buf[0] = uint8(FECType128)
	binary.BigEndian.PutUint16(buf[1:3], f.PWType)
	binary.BigEndian.PutUint32(buf[3:7], f.PWID)
	return buf
}

func DecodeFEC128(data []byte) (*FEC128, error) {
	if len(data) < 7 {
		return nil, nil
	}
	if data[0] != uint8(FECType128) {
		return nil, nil
	}
	return &FEC128{
		PWType: binary.BigEndian.Uint16(data[1:3]),
		PWID:   binary.BigEndian.Uint32(data[3:7]),
	}, nil
}

func (f *FEC128) Match(other *FEC128) bool {
	return f.PWType == other.PWType && f.PWID == other.PWID
}

type AIIType uint8

const (
	AIIPassword AIIType = 0x01
)

type FEC129 struct {
	PWType uint16
	AGI    []byte
	SAII   []byte
	TAII   []byte
}

func (f *FEC129) Type() FECType {
	return FECType129
}

func (f *FEC129) Encode() []byte {
	agiLen := len(f.AGI)
	saiiLen := len(f.SAII)
	taiiLen := len(f.TAII)

	totalLen := 1 + 2 + 1 + agiLen + 1 + saiiLen + 1 + taiiLen
	buf := make([]byte, totalLen)

	offset := 0
	buf[offset] = uint8(FECType129)
	offset++

	binary.BigEndian.PutUint16(buf[offset:offset+2], f.PWType)
	offset += 2

	buf[offset] = uint8(agiLen)
	offset++
	copy(buf[offset:offset+agiLen], f.AGI)
	offset += agiLen

	buf[offset] = uint8(saiiLen)
	offset++
	copy(buf[offset:offset+saiiLen], f.SAII)
	offset += saiiLen

	buf[offset] = uint8(taiiLen)
	offset++
	copy(buf[offset:offset+taiiLen], f.TAII)

	return buf
}

func DecodeFEC129(data []byte) (*FEC129, error) {
	if len(data) < 5 {
		return nil, nil
	}

	offset := 0
	if data[offset] != uint8(FECType129) {
		return nil, nil
	}
	offset++

	pwType := binary.BigEndian.Uint16(data[offset : offset+2])
	offset += 2

	agiLen := int(data[offset])
	offset++
	if offset+agiLen > len(data) {
		return nil, nil
	}
	agi := make([]byte, agiLen)
	copy(agi, data[offset:offset+agiLen])
	offset += agiLen

	if offset >= len(data) {
		return nil, nil
	}
	saiiLen := int(data[offset])
	offset++
	if offset+saiiLen > len(data) {
		return nil, nil
	}
	saii := make([]byte, saiiLen)
	copy(saii, data[offset:offset+saiiLen])
	offset += saiiLen

	if offset >= len(data) {
		return nil, nil
	}
	taiiLen := int(data[offset])
	offset++
	if offset+taiiLen > len(data) {
		return nil, nil
	}
	taii := make([]byte, taiiLen)
	copy(taii, data[offset:offset+taiiLen])

	return &FEC129{
		PWType: pwType,
		AGI:    agi,
		SAII:   saii,
		TAII:   taii,
	}, nil
}

func (f *FEC129) Match(other *FEC129) bool {
	if f.PWType != other.PWType {
		return false
	}
	if !bytesEqual(f.AGI, other.AGI) {
		return false
	}
	if !bytesEqual(f.SAII, other.SAII) {
		return false
	}
	if !bytesEqual(f.TAII, other.TAII) {
		return false
	}
	return true
}

func bytesEqual(a, b []byte) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

type FECElement struct {
	FEC128 *FEC128
	FEC129 *FEC129
}

func (e *FECElement) Type() FECType {
	if e.FEC128 != nil {
		return FECType128
	}
	return FECType129
}

func (e *FECElement) Encode() []byte {
	if e.FEC128 != nil {
		return e.FEC128.Encode()
	}
	return e.FEC129.Encode()
}

func DecodeFECElement(data []byte) (*FECElement, error) {
	if len(data) == 0 {
		return nil, nil
	}

	switch FECType(data[0]) {
	case FECType128:
		fec128, err := DecodeFEC128(data)
		if err != nil || fec128 == nil {
			return nil, err
		}
		return &FECElement{FEC128: fec128}, nil
	case FECType129:
		fec129, err := DecodeFEC129(data)
		if err != nil || fec129 == nil {
			return nil, err
		}
		return &FECElement{FEC129: fec129}, nil
	default:
		return nil, nil
	}
}

func EncodeTargetFECStackTLV(fecs []*FECElement) TLV {
	var value []byte
	for _, fec := range fecs {
		value = append(value, fec.Encode()...)
	}
	return TLV{
		Type:   TLVTypeTargetFECStack,
		Length: uint16(len(value)),
		Value:  value,
	}
}

func DecodeTargetFECStackTLV(tlv TLV) []*FECElement {
	var fecs []*FECElement
	data := tlv.Value

	for len(data) > 0 {
		var fecType FECType
		fecType = FECType(data[0])

		var consumed int
		switch fecType {
		case FECType128:
			if len(data) < 7 {
				return fecs
			}
			fec128, _ := DecodeFEC128(data[:7])
			if fec128 != nil {
				fecs = append(fecs, &FECElement{FEC128: fec128})
			}
			consumed = 7
		case FECType129:
			end := findFEC129End(data)
			if end == 0 {
				return fecs
			}
			fec129, _ := DecodeFEC129(data[:end])
			if fec129 != nil {
				fecs = append(fecs, &FECElement{FEC129: fec129})
			}
			consumed = end
		default:
			return fecs
		}

		data = data[consumed:]
	}

	return fecs
}

func findFEC129End(data []byte) int {
	if len(data) < 5 {
		return 0
	}

	offset := 1
	offset += 2

	if offset >= len(data) {
		return 0
	}
	agiLen := int(data[offset])
	offset += 1 + agiLen

	if offset >= len(data) {
		return 0
	}
	saiiLen := int(data[offset])
	offset += 1 + saiiLen

	if offset >= len(data) {
		return 0
	}
	taiiLen := int(data[offset])
	offset += 1 + taiiLen

	if offset > len(data) {
		return 0
	}

	return offset
}
