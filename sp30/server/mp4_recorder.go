package main

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"time"
)

type MP4Recorder struct {
	file            *os.File
	filename        string
	width           int
	height          int
	timescale       uint32
	sequenceNumber  uint32
	baseMediaTime   uint64
	firstTimestamp  uint64
	lastTimestamp   uint64
	sampleCount     uint32
	sampleSizes     []uint32
	sampleDurations []uint32
	keyFrames       []uint32
	buffer          bytes.Buffer
	firstFrame      bool
	sps             []byte
	pps             []byte
	hasSPSPPS       bool
	startTime       time.Time
	isRecording     bool
}

func NewMP4Recorder(filename string, width, height int) (*MP4Recorder, error) {
	file, err := os.Create(filename)
	if err != nil {
		return nil, err
	}

	return &MP4Recorder{
		file:        file,
		filename:    filename,
		width:       width,
		height:      height,
		timescale:   90000,
		firstFrame:  true,
		isRecording: true,
		startTime:   time.Now(),
	}, nil
}

func (m *MP4Recorder) WriteFrame(data []byte, timestamp uint64, isKeyFrame bool) error {
	if !m.isRecording {
		return errors.New("recording stopped")
	}

	nalus := parseNALUs(data)

	for _, nalu := range nalus {
		if len(nalu) < 1 {
			continue
		}

		nalType := nalu[0] & 0x1F

		if nalType == 7 {
			if !m.hasSPSPPS {
				m.sps = append([]byte{}, nalu...)
				if m.pps != nil {
					m.hasSPSPPS = true
				}
			}
			continue
		} else if nalType == 8 {
			if !m.hasSPSPPS {
				m.pps = append([]byte{}, nalu...)
				if m.sps != nil {
					m.hasSPSPPS = true
				}
			}
			continue
		}

		if !m.hasSPSPPS || m.sps == nil || m.pps == nil {
			continue
		}

		if m.firstFrame {
			if !isKeyFrame && nalType != 5 {
				continue
			}
			m.firstTimestamp = timestamp
			m.firstFrame = false
			m.writeFTYP()
			m.writeMOOV()
		}

		if isKeyFrame || nalType == 5 {
			m.keyFrames = append(m.keyFrames, m.sampleCount)
		}

		avccData := convertToAVCC(nalu)
		m.sampleSizes = append(m.sampleSizes, uint32(len(avccData)))

		duration := uint32(3000)
		if m.lastTimestamp > 0 {
			duration = uint32(timestamp - m.lastTimestamp)
		}
		m.sampleDurations = append(m.sampleDurations, duration)
		m.lastTimestamp = timestamp

		m.buffer.Write(avccData)
		m.sampleCount++
	}

	return nil
}

func (m *MP4Recorder) Stop() error {
	if !m.isRecording {
		return nil
	}

	m.isRecording = false

	if m.sampleCount == 0 {
		m.file.Close()
		os.Remove(m.filename)
		return errors.New("no samples recorded")
	}

	if m.buffer.Len() > 0 {
		m.writeMDAT()
	}

	duration := float64(m.lastTimestamp-m.firstTimestamp) / float64(m.timescale)

	m.file.Seek(0, io.SeekStart)
	m.writeFTYP()
	m.writeMOOV()

	err := m.file.Close()
	log.Printf("Recording stopped: %s, duration: %.2fs, samples: %d, size: %.2f MB",
		m.filename, duration, m.sampleCount,
		float64(m.buffer.Len())/1024/1024)

	return err
}

func (m *MP4Recorder) IsRecording() bool {
	return m.isRecording
}

func (m *MP4Recorder) GetFilename() string {
	return m.filename
}

func (m *MP4Recorder) GetDuration() float64 {
	if m.firstTimestamp == 0 || m.lastTimestamp == 0 {
		return 0
	}
	return float64(m.lastTimestamp-m.firstTimestamp) / float64(m.timescale)
}

func parseNALUs(data []byte) [][]byte {
	var nalus [][]byte
	start := 0

	for i := 0; i < len(data)-3; i++ {
		if data[i] == 0x00 && data[i+1] == 0x00 && data[i+2] == 0x00 && data[i+3] == 0x01 {
			if i > start {
				nalu := data[start:i]
				for len(nalu) > 0 && nalu[0] == 0x00 {
					nalu = nalu[1:]
				}
				if len(nalu) > 0 {
					nalus = append(nalus, nalu)
				}
			}
			start = i + 4
			i += 3
		}
	}

	if start < len(data) {
		nalu := data[start:]
		for len(nalu) > 0 && nalu[0] == 0x00 {
			nalu = nalu[1:]
		}
		if len(nalu) > 0 {
			nalus = append(nalus, nalu)
		}
	}

	return nalus
}

func convertToAVCC(nalu []byte) []byte {
	length := make([]byte, 4)
	binary.BigEndian.PutUint32(length, uint32(len(nalu)))
	return append(length, nalu...)
}

func (m *MP4Recorder) writeBox(boxType string, content []byte) {
	size := uint32(8 + len(content))
	binary.Write(m.file, binary.BigEndian, size)
	m.file.Write([]byte(boxType))
	m.file.Write(content)
}

func (m *MP4Recorder) writeFTYP() {
	content := []byte{
		0x69, 0x73, 0x6F, 0x6D,
		0x00, 0x00, 0x00, 0x01,
		0x69, 0x73, 0x6F, 0x6D,
		0x61, 0x76, 0x63, 0x31,
		0x6D, 0x70, 0x34, 0x31,
	}
	m.writeBox("ftyp", content)
}

func (m *MP4Recorder) writeMOOV() {
	var content bytes.Buffer
	content.Write(m.writeMVHD())
	content.Write(m.writeTRAK())
	m.writeBox("moov", content.Bytes())
}

func (m *MP4Recorder) writeMVHD() []byte {
	var buf bytes.Buffer

	duration := uint64(0)
	if m.lastTimestamp > m.firstTimestamp {
		duration = m.lastTimestamp - m.firstTimestamp
	}

	binary.Write(&buf, binary.BigEndian, uint32(0))
	binary.Write(&buf, binary.BigEndian, uint32(time.Now().Unix()+2082844800))
	binary.Write(&buf, binary.BigEndian, uint32(time.Now().Unix()+2082844800))
	binary.Write(&buf, binary.BigEndian, m.timescale)
	binary.Write(&buf, binary.BigEndian, duration)
	binary.Write(&buf, binary.BigEndian, uint32(0x00010000))
	binary.Write(&buf, binary.BigEndian, uint16(0x0100))
	binary.Write(&buf, binary.BigEndian, uint16(0))
	buf.Write(make([]byte, 10))
	binary.Write(&buf, binary.BigEndian, uint32(0x40000000))
	buf.Write(make([]byte, 24))
	binary.Write(&buf, binary.BigEndian, uint32(2))

	return m.writeBoxContent("mvhd", buf.Bytes())
}

func (m *MP4Recorder) writeTRAK() []byte {
	var content bytes.Buffer
	content.Write(m.writeTKHD())
	content.Write(m.writeMDIA())
	return m.writeBoxContent("trak", content.Bytes())
}

func (m *MP4Recorder) writeTKHD() []byte {
	var buf bytes.Buffer

	duration := uint64(0)
	if m.lastTimestamp > m.firstTimestamp {
		duration = m.lastTimestamp - m.firstTimestamp
	}

	binary.Write(&buf, binary.BigEndian, uint32(0))
	binary.Write(&buf, binary.BigEndian, uint32(time.Now().Unix()+2082844800))
	binary.Write(&buf, binary.BigEndian, uint32(time.Now().Unix()+2082844800))
	binary.Write(&buf, binary.BigEndian, uint32(1))
	binary.Write(&buf, binary.BigEndian, duration)
	buf.Write(make([]byte, 8))
	binary.Write(&buf, binary.BigEndian, uint16(0))
	binary.Write(&buf, binary.BigEndian, uint16(0))
	buf.Write(make([]byte, 4))
	binary.Write(&buf, binary.BigEndian, uint32(0x00480000))
	binary.Write(&buf, binary.BigEndian, uint32(0x00480000))
	binary.Write(&buf, binary.BigEndian, uint32(m.width<<16))
	binary.Write(&buf, binary.BigEndian, uint32(m.height<<16))

	return m.writeBoxContent("tkhd", buf.Bytes())
}

func (m *MP4Recorder) writeMDIA() []byte {
	var content bytes.Buffer
	content.Write(m.writeMDHD())
	content.Write(m.writeHDLR())
	content.Write(m.writeMINF())
	return m.writeBoxContent("mdia", content.Bytes())
}

func (m *MP4Recorder) writeMDHD() []byte {
	var buf bytes.Buffer

	duration := uint64(0)
	if m.lastTimestamp > m.firstTimestamp {
		duration = m.lastTimestamp - m.firstTimestamp
	}

	binary.Write(&buf, binary.BigEndian, uint32(0))
	binary.Write(&buf, binary.BigEndian, uint32(time.Now().Unix()+2082844800))
	binary.Write(&buf, binary.BigEndian, uint32(time.Now().Unix()+2082844800))
	binary.Write(&buf, binary.BigEndian, m.timescale)
	binary.Write(&buf, binary.BigEndian, duration)
	binary.Write(&buf, binary.BigEndian, uint16(0x55C4))
	binary.Write(&buf, binary.BigEndian, uint16(0))

	return m.writeBoxContent("mdhd", buf.Bytes())
}

func (m *MP4Recorder) writeHDLR() []byte {
	content := []byte{
		0x00, 0x00, 0x00, 0x00,
		0x76, 0x69, 0x64, 0x65,
		0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00,
		0x56, 0x69, 0x64, 0x65,
		0x6F, 0x48, 0x61, 0x6E,
		0x64, 0x6C, 0x65, 0x72,
		0x00,
	}
	return m.writeBoxContent("hdlr", content)
}

func (m *MP4Recorder) writeMINF() []byte {
	var content bytes.Buffer
	content.Write(m.writeVMHD())
	content.Write(m.writeDINF())
	content.Write(m.writeSTBL())
	return m.writeBoxContent("minf", content.Bytes())
}

func (m *MP4Recorder) writeVMHD() []byte {
	content := []byte{
		0x00, 0x00, 0x00, 0x01,
		0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00,
	}
	return m.writeBoxContent("vmhd", content)
}

func (m *MP4Recorder) writeDINF() []byte {
	drefContent := []byte{
		0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x01,
	}
	urlContent := []byte{
		0x00, 0x00, 0x00, 0x01,
	}
	var dref bytes.Buffer
	dref.Write(drefContent)
	dref.Write(m.writeBoxContent("url ", urlContent))

	var content bytes.Buffer
	content.Write(m.writeBoxContent("dref", dref.Bytes()))
	return m.writeBoxContent("dinf", content.Bytes())
}

func (m *MP4Recorder) writeSTBL() []byte {
	var content bytes.Buffer
	content.Write(m.writeSTSD())
	content.Write(m.writeSTTS())
	content.Write(m.writeSTSS())
	content.Write(m.writeSTSC())
	content.Write(m.writeSTSZ())
	content.Write(m.writeSTCO())
	return m.writeBoxContent("stbl", content.Bytes())
}

func (m *MP4Recorder) writeSTSD() []byte {
	avcC := m.writeAVCC()

	sampleEntry := make([]byte, 6+len(avcC))
	copy(sampleEntry[:6], []byte{0x00, 0x00, 0x00, 0x00, 0x00, 0x00})
	copy(sampleEntry[6:], avcC)

	visualSampleEntry := make([]byte, 78+len(sampleEntry))
	copy(visualSampleEntry[:], []byte{
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x61, 0x76, 0x63, 0x31,
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
	})
	binary.BigEndian.PutUint16(visualSampleEntry[24:26], uint16(m.width))
	binary.BigEndian.PutUint16(visualSampleEntry[26:28], uint16(m.height))
	binary.BigEndian.PutUint32(visualSampleEntry[28:32], 0x00480000)
	binary.BigEndian.PutUint32(visualSampleEntry[32:36], 0x00480000)
	binary.BigEndian.PutUint32(visualSampleEntry[40:44], 0x00010000)
	copy(visualSampleEntry[70:86], []byte{
		0x48, 0x61, 0x6E, 0x64, 0x76, 0x69, 0x64, 0x65,
		0x33, 0x44, 0x61, 0x76, 0x31, 0x44, 0x61, 0x76,
	})
	binary.BigEndian.PutUint16(visualSampleEntry[86:88], 0x0018)
	binary.BigEndian.PutUint16(visualSampleEntry[88:90], 0xFFFF)
	binary.BigEndian.PutUint16(visualSampleEntry[90:92], 0x0001)
	copy(visualSampleEntry[92:], sampleEntry)

	content := make([]byte, 8+len(visualSampleEntry))
	binary.BigEndian.PutUint32(content[0:4], 1)
	binary.BigEndian.PutUint32(content[4:8], 0)
	copy(content[8:], visualSampleEntry)

	return m.writeBoxContent("stsd", content)
}

func (m *MP4Recorder) writeAVCC() []byte {
	var buf bytes.Buffer

	buf.WriteByte(0x01)
	buf.WriteByte(m.sps[1])
	buf.WriteByte(m.sps[2])
	buf.WriteByte(m.sps[3])
	buf.WriteByte(0xFF)
	buf.WriteByte(0xE1)

	binary.Write(&buf, binary.BigEndian, uint16(len(m.sps)))
	buf.Write(m.sps)

	buf.WriteByte(0x01)

	binary.Write(&buf, binary.BigEndian, uint16(len(m.pps)))
	buf.Write(m.pps)

	return m.writeBoxContent("avcC", buf.Bytes())
}

func (m *MP4Recorder) writeSTTS() []byte {
	var buf bytes.Buffer

	binary.Write(&buf, binary.BigEndian, uint32(0))
	binary.Write(&buf, binary.BigEndian, uint32(1))

	avgDuration := uint32(3000)
	if m.sampleCount > 1 {
		total := uint64(0)
		for _, d := range m.sampleDurations {
			total += uint64(d)
		}
		avgDuration = uint32(total / uint64(m.sampleCount))
	}

	binary.Write(&buf, binary.BigEndian, m.sampleCount)
	binary.Write(&buf, binary.BigEndian, avgDuration)

	return m.writeBoxContent("stts", buf.Bytes())
}

func (m *MP4Recorder) writeSTSS() []byte {
	var buf bytes.Buffer

	binary.Write(&buf, binary.BigEndian, uint32(0))
	binary.Write(&buf, binary.BigEndian, uint32(len(m.keyFrames)))

	for _, kf := range m.keyFrames {
		binary.Write(&buf, binary.BigEndian, kf+1)
	}

	return m.writeBoxContent("stss", buf.Bytes())
}

func (m *MP4Recorder) writeSTSC() []byte {
	var buf bytes.Buffer

	binary.Write(&buf, binary.BigEndian, uint32(0))
	binary.Write(&buf, binary.BigEndian, uint32(1))
	binary.Write(&buf, binary.BigEndian, uint32(1))
	binary.Write(&buf, binary.BigEndian, uint32(1))
	binary.Write(&buf, binary.BigEndian, uint32(1))

	return m.writeBoxContent("stsc", buf.Bytes())
}

func (m *MP4Recorder) writeSTSZ() []byte {
	var buf bytes.Buffer

	binary.Write(&buf, binary.BigEndian, uint32(0))
	binary.Write(&buf, binary.BigEndian, uint32(0))
	binary.Write(&buf, binary.BigEndian, m.sampleCount)

	for _, size := range m.sampleSizes {
		binary.Write(&buf, binary.BigEndian, size)
	}

	return m.writeBoxContent("stsz", buf.Bytes())
}

func (m *MP4Recorder) writeSTCO() []byte {
	var buf bytes.Buffer

	binary.Write(&buf, binary.BigEndian, uint32(0))
	binary.Write(&buf, binary.BigEndian, m.sampleCount)

	offset := uint32(0)
	for _, size := range m.sampleSizes {
		binary.Write(&buf, binary.BigEndian, offset+8+8+8+8)
		offset += size
	}

	return m.writeBoxContent("stco", buf.Bytes())
}

func (m *MP4Recorder) writeMDAT() {
	m.writeBox("mdat", m.buffer.Bytes())
}

func (m *MP4Recorder) writeBoxContent(boxType string, content []byte) []byte {
	size := uint32(8 + len(content))
	result := make([]byte, size)
	binary.BigEndian.PutUint32(result[0:4], size)
	copy(result[4:8], []byte(boxType))
	copy(result[8:], content)
	return result
}

func GenerateMP4Filename(roomID, publisherID string) string {
	timestamp := time.Now().Format("20060102_150405")
	return fmt.Sprintf("recordings/%s_%s_%s.mp4", roomID, publisherID, timestamp)
}
