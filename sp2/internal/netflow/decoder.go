package netflow

import (
	"encoding/binary"
	"errors"
	"fmt"
	"net"
)

var ErrInvalidPacket = errors.New("invalid netflow v9 packet")

func DecodePacket(data []byte, sourceAddr string) (*Packet, error) {
	if len(data) < 20 {
		return nil, fmt.Errorf("%w: header too short (%d bytes)", ErrInvalidPacket, len(data))
	}

	header := PacketHeader{
		Version:   binary.BigEndian.Uint16(data[0:2]),
		Count:     binary.BigEndian.Uint16(data[2:4]),
		SysUptime: binary.BigEndian.Uint32(data[4:8]),
		UNIXSecs:  binary.BigEndian.Uint32(data[8:12]),
		Sequence:  binary.BigEndian.Uint32(data[12:16]),
		SourceID:  binary.BigEndian.Uint32(data[16:20]),
	}

	if header.Version != 9 {
		return nil, fmt.Errorf("%w: unsupported version %d", ErrInvalidPacket, header.Version)
	}

	packet := &Packet{
		Header: header,
	}

	offset := 20
	for offset < len(data) && (len(packet.TemplateSets)+len(packet.DataSets) < int(header.Count)) {
		if offset+4 > len(data) {
			break
		}

		fsHeader := FlowSetHeader{
			FlowSetID: binary.BigEndian.Uint16(data[offset : offset+2]),
			Length:    binary.BigEndian.Uint16(data[offset+2 : offset+4]),
		}

		if fsHeader.Length < 4 {
			break
		}

		if offset+int(fsHeader.Length) > len(data) {
			break
		}

		setData := data[offset+4 : offset+int(fsHeader.Length)]

		switch {
		case fsHeader.FlowSetID == 0:
			ts, err := decodeTemplateFlowSet(setData, header.SourceID)
			if err != nil {
				offset += int(fsHeader.Length)
				continue
			}
			ts.FlowSetHeader = fsHeader
			packet.TemplateSets = append(packet.TemplateSets, ts)

		case fsHeader.FlowSetID == 1:
			offset += int(fsHeader.Length)
			continue

		default:
			if fsHeader.FlowSetID >= 256 {
				ds := DataFlowSet{
					FlowSetHeader: fsHeader,
				}
				ds.Records = [][]byte{setData}
				packet.DataSets = append(packet.DataSets, ds)
			}
		}

		offset += int(fsHeader.Length)
	}

	return packet, nil
}

func decodeTemplateFlowSet(data []byte, sourceID uint32) (TemplateFlowSet, error) {
	result := TemplateFlowSet{}
	offset := 0

	for offset+4 <= len(data) {
		templateID := binary.BigEndian.Uint16(data[offset : offset+2])
		fieldCount := binary.BigEndian.Uint16(data[offset+2 : offset+4])
		offset += 4

		if templateID < 256 {
			continue
		}

		record := TemplateRecord{
			TemplateID: templateID,
			FieldCount: fieldCount,
		}

		fieldsRemaining := int(fieldCount)
		for fieldsRemaining > 0 {
			if offset+2 > len(data) {
				break
			}
			fieldType := binary.BigEndian.Uint16(data[offset : offset+2])
			isEnterprise := (fieldType & 0x8000) != 0

			if isEnterprise {
				if offset+8 > len(data) {
					break
				}
				field := FieldSpecifier{
					Type:             fieldType & 0x7FFF,
					Length:           binary.BigEndian.Uint16(data[offset+2 : offset+4]),
					EnterpriseNumber: binary.BigEndian.Uint32(data[offset+4 : offset+8]),
					IsEnterprise:     true,
				}
				record.Fields = append(record.Fields, field)
				offset += 8
			} else {
				if offset+4 > len(data) {
					break
				}
				field := FieldSpecifier{
					Type:         fieldType,
					Length:       binary.BigEndian.Uint16(data[offset+2 : offset+4]),
					IsEnterprise: false,
				}
				record.Fields = append(record.Fields, field)
				offset += 4
			}
			fieldsRemaining--
		}

		result.Templates = append(result.Templates, record)
	}

	return result, nil
}

func DecodeDataRecords(data []byte, template *TemplateRecord) ([]map[string]interface{}, error) {
	if template == nil {
		return nil, errors.New("nil template")
	}

	rowLength := 0
	for _, f := range template.Fields {
		rowLength += int(f.Length)
	}

	if rowLength == 0 {
		return nil, errors.New("template has zero-length row")
	}

	var records []map[string]interface{}
	offset := 0

	for offset+rowLength <= len(data) {
		record := make(map[string]interface{})
		fieldOffset := 0

		for i, field := range template.Fields {
			if offset+fieldOffset+int(field.Length) > len(data) {
				break
			}

			fieldData := data[offset+fieldOffset : offset+fieldOffset+int(field.Length)]
			fieldName := GetFieldTypeName(field.Type)
			if field.IsEnterprise {
				fieldName = fmt.Sprintf("PEN%d_%s", field.EnterpriseNumber, fieldName)
			}
			key := fmt.Sprintf("%s_%d", fieldName, i)

			record[key] = decodeFieldValue(field.Type, field.IsEnterprise, field.EnterpriseNumber, field.Length, fieldData)
			fieldOffset += int(field.Length)
		}

		records = append(records, record)
		offset += rowLength
	}

	return records, nil
}

func decodeFieldValue(fieldType uint16, isEnterprise bool, enterpriseNumber uint32, length uint16, data []byte) interface{} {
	if int(length) > len(data) {
		return nil
	}

	switch {
	case IsIPField(fieldType):
		switch length {
		case 4:
			return net.IP(data).To4().String()
		case 16:
			return net.IP(data).String()
		}

	case IsPortField(fieldType):
		if length == 2 {
			return binary.BigEndian.Uint16(data)
		}

	case fieldType == 4: // PROTOCOL
		if length == 1 {
			return data[0]
		}

	case fieldType == 6: // TCP_FLAGS
		return fmt.Sprintf("0x%02x", data[0])

	case fieldType == 21 || fieldType == 22: // LAST_SWITCHED / FIRST_SWITCHED
		if length == 4 {
			return binary.BigEndian.Uint32(data)
		}

	case fieldType == 32: // ICMP_TYPE
		if length == 2 {
			return binary.BigEndian.Uint16(data)
		}
	}

	switch length {
	case 1:
		return data[0]
	case 2:
		return binary.BigEndian.Uint16(data)
	case 4:
		return binary.BigEndian.Uint32(data)
	case 8:
		hi := binary.BigEndian.Uint32(data[0:4])
		lo := binary.BigEndian.Uint32(data[4:8])
		return uint64(hi)<<32 | uint64(lo)
	default:
		return fmt.Sprintf("%x", data)
	}
}
