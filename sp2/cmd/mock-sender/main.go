package main

import (
	"encoding/binary"
	"log"
	"math/rand"
	"net"
	"time"
)

func buildTemplatePacket(sourceID uint32, templateID uint16) []byte {
	header := make([]byte, 20)
	binary.BigEndian.PutUint16(header[0:2], 9)
	binary.BigEndian.PutUint16(header[2:4], 1)
	binary.BigEndian.PutUint32(header[4:8], uint32(time.Now().Unix()))
	binary.BigEndian.PutUint32(header[8:12], uint32(time.Now().Unix()))
	binary.BigEndian.PutUint32(header[12:16], 1)
	binary.BigEndian.PutUint32(header[16:20], sourceID)

	fields := []struct {
		ft uint16
		fl uint16
	}{
		{8, 4},  // IPV4_SRC_ADDR
		{12, 4}, // IPV4_DST_ADDR
		{7, 2},  // L4_SRC_PORT
		{11, 2}, // L4_DST_PORT
		{4, 1},  // PROTOCOL
		{2, 4},  // IN_PKTS
		{1, 4},  // IN_BYTES
		{22, 4}, // FIRST_SWITCHED
		{21, 4}, // LAST_SWITCHED
		{6, 1},  // TCP_FLAGS
	}

	fieldCount := uint16(len(fields))
	templateDataLen := 4 + int(fieldCount)*4
	setLength := 4 + templateDataLen

	flowSet := make([]byte, 4+templateDataLen)
	binary.BigEndian.PutUint16(flowSet[0:2], 0)
	binary.BigEndian.PutUint16(flowSet[2:4], uint16(setLength))

	offset := 4
	binary.BigEndian.PutUint16(flowSet[offset:offset+2], templateID)
	binary.BigEndian.PutUint16(flowSet[offset+2:offset+4], fieldCount)
	offset += 4

	for _, f := range fields {
		binary.BigEndian.PutUint16(flowSet[offset:offset+2], f.ft)
		binary.BigEndian.PutUint16(flowSet[offset+2:offset+4], f.fl)
		offset += 4
	}

	packet := make([]byte, 20+len(flowSet))
	copy(packet[0:20], header)
	copy(packet[20:], flowSet)

	return packet
}

func buildDataPacket(sourceID uint32, templateID uint16) []byte {
	header := make([]byte, 20)
	binary.BigEndian.PutUint16(header[0:2], 9)
	binary.BigEndian.PutUint16(header[2:4], 1)
	binary.BigEndian.PutUint32(header[4:8], uint32(time.Now().Unix()))
	binary.BigEndian.PutUint32(header[8:12], uint32(time.Now().Unix()))
	binary.BigEndian.PutUint32(header[12:16], 2)
	binary.BigEndian.PutUint32(header[16:20], sourceID)

	rowLen := 4 + 4 + 2 + 2 + 1 + 4 + 4 + 4 + 4 + 1 // = 30
	setLength := 4 + rowLen

	flowSet := make([]byte, setLength)
	binary.BigEndian.PutUint16(flowSet[0:2], templateID)
	binary.BigEndian.PutUint16(flowSet[2:4], uint16(setLength))

	offset := 4
	binary.BigEndian.PutUint32(flowSet[offset:offset+4], uint32(rand.Intn(0xFFFFFF00)))
	offset += 4
	binary.BigEndian.PutUint32(flowSet[offset:offset+4], uint32(rand.Intn(0xFFFFFF00)))
	offset += 4
	binary.BigEndian.PutUint16(flowSet[offset:offset+2], uint16(rand.Intn(65535)))
	offset += 2
	binary.BigEndian.PutUint16(flowSet[offset:offset+2], uint16(rand.Intn(65535)))
	offset += 2
	flowSet[offset] = byte(rand.Intn(256))
	offset += 1
	binary.BigEndian.PutUint32(flowSet[offset:offset+4], uint32(rand.Intn(10000)))
	offset += 4
	binary.BigEndian.PutUint32(flowSet[offset:offset+4], uint32(rand.Intn(1000000)))
	offset += 4
	binary.BigEndian.PutUint32(flowSet[offset:offset+4], uint32(time.Now().Unix()-int64(rand.Intn(300))))
	offset += 4
	binary.BigEndian.PutUint32(flowSet[offset:offset+4], uint32(time.Now().Unix()))
	offset += 4
	flowSet[offset] = byte(rand.Intn(256))

	packet := make([]byte, 20+len(flowSet))
	copy(packet[0:20], header)
	copy(packet[20:], flowSet)

	return packet
}

func buildConflictingTemplatePacket(sourceID uint32, templateID uint16) []byte {
	header := make([]byte, 20)
	binary.BigEndian.PutUint16(header[0:2], 9)
	binary.BigEndian.PutUint16(header[2:4], 1)
	binary.BigEndian.PutUint32(header[4:8], uint32(time.Now().Unix()))
	binary.BigEndian.PutUint32(header[8:12], uint32(time.Now().Unix()))
	binary.BigEndian.PutUint32(header[12:16], 1)
	binary.BigEndian.PutUint32(header[16:20], sourceID)

	fields := []struct {
		ft uint16
		fl uint16
	}{
		{8, 4},  // IPV4_SRC_ADDR
		{12, 4}, // IPV4_DST_ADDR
		{7, 2},  // L4_SRC_PORT
		{11, 2}, // L4_DST_PORT
		{4, 1},  // PROTOCOL
		{2, 8},  // IN_PKTS - changed from 4 to 8 to trigger rejection
		{1, 8},  // IN_BYTES - changed from 4 to 8 to trigger rejection
		{22, 4}, // FIRST_SWITCHED
		{21, 4}, // LAST_SWITCHED
		{6, 1},  // TCP_FLAGS
	}

	fieldCount := uint16(len(fields))
	templateDataLen := 4 + int(fieldCount)*4
	setLength := 4 + templateDataLen

	flowSet := make([]byte, 4+templateDataLen)
	binary.BigEndian.PutUint16(flowSet[0:2], 0)
	binary.BigEndian.PutUint16(flowSet[2:4], uint16(setLength))

	offset := 4
	binary.BigEndian.PutUint16(flowSet[offset:offset+2], templateID)
	binary.BigEndian.PutUint16(flowSet[offset+2:offset+4], fieldCount)
	offset += 4

	for _, f := range fields {
		binary.BigEndian.PutUint16(flowSet[offset:offset+2], f.ft)
		binary.BigEndian.PutUint16(flowSet[offset+2:offset+4], f.fl)
		offset += 4
	}

	packet := make([]byte, 20+len(flowSet))
	copy(packet[0:20], header)
	copy(packet[20:], flowSet)

	return packet
}

func buildTemplatePacketWithEnterprise(sourceID uint32, templateID uint16) []byte {
	header := make([]byte, 20)
	binary.BigEndian.PutUint16(header[0:2], 9)
	binary.BigEndian.PutUint16(header[2:4], 1)
	binary.BigEndian.PutUint32(header[4:8], uint32(time.Now().Unix()))
	binary.BigEndian.PutUint32(header[8:12], uint32(time.Now().Unix()))
	binary.BigEndian.PutUint32(header[12:16], 1)
	binary.BigEndian.PutUint32(header[16:20], sourceID)

	type fieldDef struct {
		ft           uint16
		fl           uint16
		isEnterprise bool
		pen          uint32
	}
	fields := []fieldDef{
		{8, 4, false, 0},      // IPV4_SRC_ADDR
		{12, 4, false, 0},     // IPV4_DST_ADDR
		{7, 2, false, 0},      // L4_SRC_PORT
		{11, 2, false, 0},     // L4_DST_PORT
		{4, 1, false, 0},      // PROTOCOL
		{2, 4, false, 0},      // IN_PKTS
		{1, 4, false, 0},      // IN_BYTES
		{100, 4, true, 12345}, // Enterprise field: type 100, PEN 12345
		{200, 8, true, 12345}, // Enterprise field: type 200, PEN 12345
		{6, 1, false, 0},      // TCP_FLAGS
	}

	fieldCount := uint16(len(fields))

	templateDataLen := 4
	for _, f := range fields {
		if f.isEnterprise {
			templateDataLen += 8
		} else {
			templateDataLen += 4
		}
	}
	setLength := 4 + templateDataLen

	flowSet := make([]byte, 4+templateDataLen)
	binary.BigEndian.PutUint16(flowSet[0:2], 0)
	binary.BigEndian.PutUint16(flowSet[2:4], uint16(setLength))

	offset := 4
	binary.BigEndian.PutUint16(flowSet[offset:offset+2], templateID)
	binary.BigEndian.PutUint16(flowSet[offset+2:offset+4], fieldCount)
	offset += 4

	for _, f := range fields {
		if f.isEnterprise {
			binary.BigEndian.PutUint16(flowSet[offset:offset+2], 0x8000|f.ft)
			binary.BigEndian.PutUint16(flowSet[offset+2:offset+4], f.fl)
			binary.BigEndian.PutUint32(flowSet[offset+4:offset+8], f.pen)
			offset += 8
		} else {
			binary.BigEndian.PutUint16(flowSet[offset:offset+2], f.ft)
			binary.BigEndian.PutUint16(flowSet[offset+2:offset+4], f.fl)
			offset += 4
		}
	}

	packet := make([]byte, 20+len(flowSet))
	copy(packet[0:20], header)
	copy(packet[20:], flowSet)

	return packet
}

func buildDataPacketWithEnterprise(sourceID uint32, templateID uint16) []byte {
	header := make([]byte, 20)
	binary.BigEndian.PutUint16(header[0:2], 9)
	binary.BigEndian.PutUint16(header[2:4], 1)
	binary.BigEndian.PutUint32(header[4:8], uint32(time.Now().Unix()))
	binary.BigEndian.PutUint32(header[8:12], uint32(time.Now().Unix()))
	binary.BigEndian.PutUint32(header[12:16], 2)
	binary.BigEndian.PutUint32(header[16:20], sourceID)

	rowLen := 4 + 4 + 2 + 2 + 1 + 4 + 4 + 4 + 8 + 1 // with enterprise fields
	setLength := 4 + rowLen

	flowSet := make([]byte, setLength)
	binary.BigEndian.PutUint16(flowSet[0:2], templateID)
	binary.BigEndian.PutUint16(flowSet[2:4], uint16(setLength))

	offset := 4
	binary.BigEndian.PutUint32(flowSet[offset:offset+4], uint32(rand.Intn(0xFFFFFF00)))
	offset += 4
	binary.BigEndian.PutUint32(flowSet[offset:offset+4], uint32(rand.Intn(0xFFFFFF00)))
	offset += 4
	binary.BigEndian.PutUint16(flowSet[offset:offset+2], uint16(rand.Intn(65535)))
	offset += 2
	binary.BigEndian.PutUint16(flowSet[offset:offset+2], uint16(rand.Intn(65535)))
	offset += 2
	flowSet[offset] = byte(rand.Intn(256))
	offset += 1
	binary.BigEndian.PutUint32(flowSet[offset:offset+4], uint32(rand.Intn(10000)))
	offset += 4
	binary.BigEndian.PutUint32(flowSet[offset:offset+4], uint32(rand.Intn(1000000)))
	offset += 4
	binary.BigEndian.PutUint32(flowSet[offset:offset+4], uint32(rand.Intn(1000000))) // enterprise field 100
	offset += 4
	binary.BigEndian.PutUint64(flowSet[offset:offset+8], uint64(rand.Int63())) // enterprise field 200
	offset += 8
	flowSet[offset] = byte(rand.Intn(256))

	packet := make([]byte, 20+len(flowSet))
	copy(packet[0:20], header)
	copy(packet[20:], flowSet)

	return packet
}

func main() {
	addr, err := net.ResolveUDPAddr("udp", "127.0.0.1:2055")
	if err != nil {
		log.Fatal(err)
	}

	conn, err := net.DialUDP("udp", nil, addr)
	if err != nil {
		log.Fatal(err)
	}
	defer conn.Close()

	observers := []uint32{100, 200}
	templateID := uint16(300)
	enterpriseTemplateID := uint16(400)

	for _, obsID := range observers {
		pkt := buildTemplatePacket(obsID, templateID)
		if _, err := conn.Write(pkt); err != nil {
			log.Printf("Error sending template for observer %d: %v", obsID, err)
		} else {
			log.Printf("Sent template %d for observer %d", templateID, obsID)
		}
	}

	for _, obsID := range observers {
		pkt := buildTemplatePacketWithEnterprise(obsID, enterpriseTemplateID)
		if _, err := conn.Write(pkt); err != nil {
			log.Printf("Error sending enterprise template for observer %d: %v", obsID, err)
		} else {
			log.Printf("Sent enterprise template %d for observer %d", enterpriseTemplateID, obsID)
		}
	}

	go func() {
		time.Sleep(8 * time.Second)
		for _, obsID := range observers {
			pkt := buildConflictingTemplatePacket(obsID, templateID)
			if _, err := conn.Write(pkt); err != nil {
				log.Printf("Error sending conflicting template for observer %d: %v", obsID, err)
			} else {
				log.Printf("Sent CONFLICTING template %d for observer %d (should be rejected)", templateID, obsID)
			}
		}
	}()

	for {
		for _, obsID := range observers {
			pkt := buildDataPacket(obsID, templateID)
			if _, err := conn.Write(pkt); err != nil {
				log.Printf("Error sending data for observer %d: %v", obsID, err)
			}
		}
		for _, obsID := range observers {
			pkt := buildDataPacketWithEnterprise(obsID, enterpriseTemplateID)
			if _, err := conn.Write(pkt); err != nil {
				log.Printf("Error sending enterprise data for observer %d: %v", obsID, err)
			}
		}
		time.Sleep(2 * time.Second)
	}
}
