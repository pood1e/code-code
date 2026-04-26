package wecomcallback

import "testing"

const testEncodingAESKey = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG"

func TestCryptoVerifyURLRoundTrip(t *testing.T) {
	crypto, err := NewCrypto("token", testEncodingAESKey)
	if err != nil {
		t.Fatalf("NewCrypto() error = %v", err)
	}
	encrypted, signature, err := crypto.EncryptMessage("hello", "corp-id", "nonce", "12345", []byte("1234567890123456"))
	if err != nil {
		t.Fatalf("EncryptMessage() error = %v", err)
	}

	plain, err := crypto.VerifyURL(signature, "12345", "nonce", encrypted)
	if err != nil {
		t.Fatalf("VerifyURL() error = %v", err)
	}
	if plain != "hello" {
		t.Fatalf("plain = %q, want hello", plain)
	}
}

func TestCryptoVerifyURLRoundTripWithWeComPadding(t *testing.T) {
	crypto, err := NewCrypto("token", testEncodingAESKey)
	if err != nil {
		t.Fatalf("NewCrypto() error = %v", err)
	}
	encrypted, signature, err := crypto.EncryptMessage("hello padding", "", "nonce", "12345", []byte("1234567890123456"))
	if err != nil {
		t.Fatalf("EncryptMessage() error = %v", err)
	}

	plain, err := crypto.VerifyURL(signature, "12345", "nonce", encrypted)
	if err != nil {
		t.Fatalf("VerifyURL() error = %v", err)
	}
	if plain != "hello padding" {
		t.Fatalf("plain = %q, want hello padding", plain)
	}
}

func TestCryptoRejectsInvalidSignature(t *testing.T) {
	crypto, err := NewCrypto("token", testEncodingAESKey)
	if err != nil {
		t.Fatalf("NewCrypto() error = %v", err)
	}
	encrypted, _, err := crypto.EncryptMessage("hello", "", "nonce", "12345", []byte("1234567890123456"))
	if err != nil {
		t.Fatalf("EncryptMessage() error = %v", err)
	}

	if _, err := crypto.VerifyURL("bad", "12345", "nonce", encrypted); err == nil {
		t.Fatal("VerifyURL() error = nil, want invalid signature")
	}
}
