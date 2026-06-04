package service

import (
	"bytes"
	"io"
	"unicode/utf8"

	"golang.org/x/text/encoding/simplifiedchinese"
	"golang.org/x/text/transform"
)

type CharsetDetector struct{}

func NewCharsetDetector() *CharsetDetector {
	return &CharsetDetector{}
}

func (d *CharsetDetector) DetectAndConvert(data []byte) []byte {
	if len(data) == 0 {
		return data
	}

	if utf8.Valid(data) {
		return data
	}

	converted := tryGBK(data)
	if converted != nil {
		return converted
	}

	converted = tryGB18030(data)
	if converted != nil {
		return converted
	}

	return data
}

func tryGBK(data []byte) []byte {
	reader := transform.NewReader(bytes.NewReader(data), simplifiedchinese.GBK.NewDecoder())
	converted, err := io.ReadAll(reader)
	if err != nil {
		return nil
	}
	if utf8.Valid(converted) {
		return converted
	}
	return nil
}

func tryGB18030(data []byte) []byte {
	reader := transform.NewReader(bytes.NewReader(data), simplifiedchinese.GB18030.NewDecoder())
	converted, err := io.ReadAll(reader)
	if err != nil {
		return nil
	}
	if utf8.Valid(converted) {
		return converted
	}
	return nil
}
