package media

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
)

const (
	exifTagModel       = 0x0110
	exifTagExifIFD     = 0x8769
	exifTagExposure    = 0x829A
	exifTagFNumber     = 0x829D
	exifTagISO         = 0x8827
	exifTagFocalLength = 0x920A
	exifTagLensModel   = 0xA434

	maxTIFFValueBytes = 1 << 24
)

type mediaExifMetadata struct {
	Aperture     string `json:"aperture,omitempty"`
	FocalLength  string `json:"focalLength,omitempty"`
	ShutterSpeed string `json:"shutterSpeed,omitempty"`
	ISO          string `json:"iso,omitempty"`
	CameraModel  string `json:"cameraModel,omitempty"`
	LensModel    string `json:"lensModel,omitempty"`
}

type tiffEntry struct {
	typ   uint16
	count uint32
	value []byte
}

func extractExifMetadataFromFile(filePath, format string) *mediaExifMetadata {
	if !isJPEGFormat(format) {
		return nil
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil
	}
	exif, err := extractExifMetadataFromJPEGBytes(data)
	if err != nil {
		return nil
	}
	return normalizeMediaExif(exif)
}

func extractExifMetadataFromImageBytes(data []byte, format string) *mediaExifMetadata {
	if !isJPEGFormat(format) {
		return nil
	}
	exif, err := extractExifMetadataFromJPEGBytes(data)
	if err != nil {
		return nil
	}
	return normalizeMediaExif(exif)
}

func extractExifMetadataFromJPEGBytes(data []byte) (*mediaExifMetadata, error) {
	if len(data) < 4 || data[0] != 0xFF || data[1] != 0xD8 {
		return nil, errors.New("not a jpeg image")
	}

	for offset := 2; offset+4 <= len(data); {
		if data[offset] != 0xFF {
			return nil, errors.New("invalid jpeg segment")
		}
		for offset < len(data) && data[offset] == 0xFF {
			offset++
		}
		if offset >= len(data) {
			break
		}

		marker := data[offset]
		offset++
		if marker == 0xD9 || marker == 0xDA {
			break
		}
		if offset+2 > len(data) {
			return nil, errors.New("truncated jpeg segment length")
		}
		segmentLength := int(binary.BigEndian.Uint16(data[offset : offset+2]))
		if segmentLength < 2 {
			return nil, errors.New("invalid jpeg segment length")
		}
		segmentStart := offset + 2
		segmentEnd := offset + segmentLength
		if segmentEnd > len(data) {
			return nil, errors.New("truncated jpeg segment")
		}
		if marker == 0xE1 {
			segment := data[segmentStart:segmentEnd]
			if bytes.HasPrefix(segment, []byte("Exif\x00\x00")) {
				return parseExifTIFF(segment[6:])
			}
		}
		offset = segmentEnd
	}

	return nil, nil
}

func parseExifTIFF(tiff []byte) (*mediaExifMetadata, error) {
	if len(tiff) < 8 {
		return nil, errors.New("tiff header too short")
	}

	var order binary.ByteOrder
	switch string(tiff[:2]) {
	case "II":
		order = binary.LittleEndian
	case "MM":
		order = binary.BigEndian
	default:
		return nil, errors.New("unknown tiff byte order")
	}
	if order.Uint16(tiff[2:4]) != 42 {
		return nil, errors.New("invalid tiff magic")
	}

	ifd0Offset := order.Uint32(tiff[4:8])
	ifd0, err := readTIFFIFD(tiff, ifd0Offset, order)
	if err != nil {
		return nil, err
	}

	exif := &mediaExifMetadata{
		CameraModel: tiffASCII(ifd0, exifTagModel),
	}
	if exifIFDOffset, ok := tiffUnsigned(ifd0, exifTagExifIFD, order); ok {
		exifIFD, err := readTIFFIFD(tiff, exifIFDOffset, order)
		if err != nil {
			return normalizeMediaExif(exif), nil
		}
		if numerator, denominator, ok := tiffRational(exifIFD, exifTagFNumber, order); ok {
			exif.Aperture = formatAperture(numerator, denominator)
		}
		if numerator, denominator, ok := tiffRational(exifIFD, exifTagFocalLength, order); ok {
			exif.FocalLength = formatFocalLength(numerator, denominator)
		}
		if numerator, denominator, ok := tiffRational(exifIFD, exifTagExposure, order); ok {
			exif.ShutterSpeed = formatExposureTime(numerator, denominator)
		}
		if iso, ok := tiffUnsigned(exifIFD, exifTagISO, order); ok && iso > 0 {
			exif.ISO = strconv.FormatUint(uint64(iso), 10)
		}
		exif.LensModel = tiffASCII(exifIFD, exifTagLensModel)
	}

	return normalizeMediaExif(exif), nil
}

func readTIFFIFD(tiff []byte, offset uint32, order binary.ByteOrder) (map[uint16]tiffEntry, error) {
	if int(offset)+2 > len(tiff) {
		return nil, errors.New("ifd offset out of range")
	}

	count := int(order.Uint16(tiff[offset : offset+2]))
	entryOffset := int(offset) + 2
	if entryOffset+count*12 > len(tiff) {
		return nil, errors.New("ifd entries out of range")
	}

	entries := make(map[uint16]tiffEntry, count)
	for index := 0; index < count; index++ {
		raw := tiff[entryOffset+index*12 : entryOffset+(index+1)*12]
		tag := order.Uint16(raw[0:2])
		typ := order.Uint16(raw[2:4])
		valueCount := order.Uint32(raw[4:8])
		value, ok := tiffValueBytes(tiff, raw[8:12], typ, valueCount, order)
		if !ok {
			continue
		}
		entries[tag] = tiffEntry{typ: typ, count: valueCount, value: value}
	}
	return entries, nil
}

func tiffValueBytes(tiff []byte, valueField []byte, typ uint16, count uint32, order binary.ByteOrder) ([]byte, bool) {
	unitSize, ok := tiffTypeSize(typ)
	if !ok || count == 0 || count > maxTIFFValueBytes/uint32(unitSize) {
		return nil, false
	}
	size := int(count) * unitSize
	if size <= 4 {
		return valueField[:size], true
	}

	offset := int(order.Uint32(valueField))
	if offset < 0 || offset+size > len(tiff) {
		return nil, false
	}
	return tiff[offset : offset+size], true
}

func tiffTypeSize(typ uint16) (int, bool) {
	switch typ {
	case 1, 2, 6, 7:
		return 1, true
	case 3, 8:
		return 2, true
	case 4, 9:
		return 4, true
	case 5, 10:
		return 8, true
	default:
		return 0, false
	}
}

func tiffASCII(entries map[uint16]tiffEntry, tag uint16) string {
	entry, ok := entries[tag]
	if !ok || entry.typ != 2 || len(entry.value) == 0 {
		return ""
	}
	value := string(bytes.TrimRight(entry.value, "\x00"))
	return strings.TrimSpace(value)
}

func tiffUnsigned(entries map[uint16]tiffEntry, tag uint16, order binary.ByteOrder) (uint32, bool) {
	entry, ok := entries[tag]
	if !ok || len(entry.value) == 0 {
		return 0, false
	}
	switch entry.typ {
	case 3:
		if len(entry.value) < 2 {
			return 0, false
		}
		return uint32(order.Uint16(entry.value[:2])), true
	case 4:
		if len(entry.value) < 4 {
			return 0, false
		}
		return order.Uint32(entry.value[:4]), true
	default:
		return 0, false
	}
}

func tiffRational(entries map[uint16]tiffEntry, tag uint16, order binary.ByteOrder) (uint32, uint32, bool) {
	entry, ok := entries[tag]
	if !ok || entry.typ != 5 || len(entry.value) < 8 {
		return 0, 0, false
	}

	numerator := order.Uint32(entry.value[:4])
	denominator := order.Uint32(entry.value[4:8])
	return numerator, denominator, numerator > 0 && denominator > 0
}

func formatAperture(numerator, denominator uint32) string {
	value, ok := rationalFloat(numerator, denominator)
	if !ok {
		return ""
	}
	return "f/" + strconv.FormatFloat(value, 'f', 1, 64)
}

func formatFocalLength(numerator, denominator uint32) string {
	value, ok := rationalFloat(numerator, denominator)
	if !ok {
		return ""
	}
	return trimDecimal(value, 1) + "mm"
}

func formatExposureTime(numerator, denominator uint32) string {
	if numerator == 0 || denominator == 0 {
		return ""
	}
	if numerator < denominator {
		divisor := gcdUint32(numerator, denominator)
		return fmt.Sprintf("%d/%ds", numerator/divisor, denominator/divisor)
	}
	value := float64(numerator) / float64(denominator)
	return trimDecimal(value, 1) + "s"
}

func rationalFloat(numerator, denominator uint32) (float64, bool) {
	if numerator == 0 || denominator == 0 {
		return 0, false
	}
	return float64(numerator) / float64(denominator), true
}

func trimDecimal(value float64, precision int) string {
	text := strconv.FormatFloat(value, 'f', precision, 64)
	text = strings.TrimRight(text, "0")
	text = strings.TrimRight(text, ".")
	if text == "" {
		return "0"
	}
	return text
}

func gcdUint32(left, right uint32) uint32 {
	for right != 0 {
		left, right = right, left%right
	}
	if left == 0 {
		return 1
	}
	return left
}

func normalizeMediaExif(exif *mediaExifMetadata) *mediaExifMetadata {
	if exif == nil {
		return nil
	}
	exif.Aperture = strings.TrimSpace(exif.Aperture)
	exif.FocalLength = strings.TrimSpace(exif.FocalLength)
	exif.ShutterSpeed = strings.TrimSpace(exif.ShutterSpeed)
	exif.ISO = strings.TrimSpace(exif.ISO)
	exif.CameraModel = strings.TrimSpace(exif.CameraModel)
	exif.LensModel = strings.TrimSpace(exif.LensModel)
	if exif.Aperture == "" && exif.FocalLength == "" && exif.ShutterSpeed == "" && exif.ISO == "" && exif.CameraModel == "" && exif.LensModel == "" {
		return nil
	}
	return exif
}

func isJPEGFormat(format string) bool {
	format = strings.ToLower(strings.TrimPrefix(strings.TrimSpace(format), "."))
	return format == "jpg" || format == "jpeg"
}
