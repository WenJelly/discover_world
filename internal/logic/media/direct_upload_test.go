package media

import (
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"
)

func TestBuildCOSAuthorizationAtBindsUploadMethodPathAndWindow(t *testing.T) {
	uploadURL, err := url.Parse("https://bucket.cos.ap-shanghai.myqcloud.com/media/images/asset-10/original.jpg")
	if err != nil {
		t.Fatalf("parse upload URL: %v", err)
	}
	now := time.Unix(1000, 0)

	auth := buildCOSAuthorizationAt("secret-id", "secret-key", uploadURL, http.MethodPut, now, 10*time.Minute)

	for _, fragment := range []string{
		"q-ak=secret-id",
		"q-sign-time=940;1600",
		"q-key-time=940;1600",
		"q-header-list=host",
		"q-url-param-list=",
	} {
		if !strings.Contains(auth, fragment) {
			t.Fatalf("authorization %q missing %q", auth, fragment)
		}
	}
	if strings.Contains(auth, "secret-key") {
		t.Fatalf("authorization leaks secret key: %q", auth)
	}

	headAuth := buildCOSAuthorizationAt("secret-id", "secret-key", uploadURL, http.MethodHead, now, 10*time.Minute)
	if headAuth == auth {
		t.Fatal("authorization should change when HTTP method changes")
	}

	otherURL, err := url.Parse("https://bucket.cos.ap-shanghai.myqcloud.com/media/images/asset-11/original.jpg")
	if err != nil {
		t.Fatalf("parse other URL: %v", err)
	}
	otherAuth := buildCOSAuthorizationAt("secret-id", "secret-key", otherURL, http.MethodPut, now, 10*time.Minute)
	if otherAuth == auth {
		t.Fatal("authorization should change when object path changes")
	}
}

func TestValidateDirectUploadObjectHeaderRequiresMatchingImageFormat(t *testing.T) {
	jpegHeader := []byte{0xFF, 0xD8, 0xFF, 0xE0}
	if err := validateDirectUploadObjectHeader(jpegHeader, "media/images/asset-10/original.jpg"); err != nil {
		t.Fatalf("validateDirectUploadObjectHeader rejected matching jpeg: %v", err)
	}

	pngHeader := []byte{0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A}
	if err := validateDirectUploadObjectHeader(pngHeader, "media/images/asset-10/original.jpg"); err == nil {
		t.Fatal("validateDirectUploadObjectHeader accepted png bytes for jpg object")
	}

	if err := validateDirectUploadObjectHeader([]byte("not an image"), "media/images/asset-10/original.jpg"); err == nil {
		t.Fatal("validateDirectUploadObjectHeader accepted non-image bytes")
	}
}
