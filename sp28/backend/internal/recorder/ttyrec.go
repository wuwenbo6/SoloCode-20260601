package recorder

import (
	"bytes"
	"encoding/binary"
	"time"
)

type TtyRecHeader struct {
	Sec  uint32
	Usec uint32
	Len  uint32
}

type TtyRecFrame struct {
	Header  TtyRecHeader
	Content []byte
}

type TtyRecWriter struct {
	startTime time.Time
}

func NewTtyRecWriter() *TtyRecWriter {
	return &TtyRecWriter{
		startTime: time.Now(),
	}
}

func (w *TtyRecWriter) WriteFrame(buf *bytes.Buffer, data []byte) error {
	now := time.Now()
	elapsed := now.Sub(w.startTime)
	sec := uint32(elapsed.Seconds())
	usec := uint32(elapsed.Microseconds() % 1000000)
	length := uint32(len(data))

	header := TtyRecHeader{
		Sec:  sec,
		Usec: usec,
		Len:  length,
	}

	if err := binary.Write(buf, binary.LittleEndian, header.Sec); err != nil {
		return err
	}
	if err := binary.Write(buf, binary.LittleEndian, header.Usec); err != nil {
		return err
	}
	if err := binary.Write(buf, binary.LittleEndian, header.Len); err != nil {
		return err
	}

	_, err := buf.Write(data)
	return err
}

func ParseTtyRecHeader(data []byte) (TtyRecHeader, error) {
	var header TtyRecHeader
	buf := bytes.NewReader(data)
	if err := binary.Read(buf, binary.LittleEndian, &header.Sec); err != nil {
		return header, err
	}
	if err := binary.Read(buf, binary.LittleEndian, &header.Usec); err != nil {
		return header, err
	}
	if err := binary.Read(buf, binary.LittleEndian, &header.Len); err != nil {
		return header, err
	}
	return header, nil
}
