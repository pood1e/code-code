package wecomcallback

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/sha1"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"sort"
)

const weComPKCS7BlockSize = 32

// Crypto verifies and decrypts Enterprise WeChat callback payloads.
type Crypto struct {
	token  string
	aesKey []byte
}

// NewCrypto creates one Enterprise WeChat callback crypto helper.
func NewCrypto(token string, encodingAESKey string) (*Crypto, error) {
	if token == "" {
		return nil, fmt.Errorf("wecomcallback: token is required")
	}
	if len(encodingAESKey) != 43 {
		return nil, fmt.Errorf("wecomcallback: encoding aes key must be 43 characters")
	}
	aesKey, err := base64.StdEncoding.DecodeString(encodingAESKey + "=")
	if err != nil {
		return nil, fmt.Errorf("wecomcallback: decode encoding aes key: %w", err)
	}
	if len(aesKey) != 32 {
		return nil, fmt.Errorf("wecomcallback: decoded aes key must be 32 bytes")
	}
	return &Crypto{token: token, aesKey: aesKey}, nil
}

// VerifyURL validates and decrypts the callback URL verification echo.
func (c *Crypto) VerifyURL(signature string, timestamp string, nonce string, echo string) (string, error) {
	if err := c.verifySignature(signature, timestamp, nonce, echo); err != nil {
		return "", err
	}
	message, _, err := c.decrypt(echo)
	return message, err
}

// DecryptMessage validates and decrypts one callback message body.
func (c *Crypto) DecryptMessage(signature string, timestamp string, nonce string, encrypted string) (string, string, error) {
	if err := c.verifySignature(signature, timestamp, nonce, encrypted); err != nil {
		return "", "", err
	}
	return c.decrypt(encrypted)
}

// EncryptMessage encrypts plaintext for tests and passive callback replies.
func (c *Crypto) EncryptMessage(plain string, receiveID string, nonce string, timestamp string, random []byte) (string, string, error) {
	if len(random) != 16 {
		return "", "", fmt.Errorf("wecomcallback: random prefix must be 16 bytes")
	}
	plainBytes := []byte(plain)
	payload := bytes.NewBuffer(make([]byte, 0, 20+len(plainBytes)+len(receiveID)))
	payload.Write(random)
	length := make([]byte, 4)
	binary.BigEndian.PutUint32(length, uint32(len(plainBytes)))
	payload.Write(length)
	payload.Write(plainBytes)
	payload.WriteString(receiveID)

	block, err := aes.NewCipher(c.aesKey)
	if err != nil {
		return "", "", err
	}
	padded := pkcs7Pad(payload.Bytes(), weComPKCS7BlockSize)
	encrypted := make([]byte, len(padded))
	cipher.NewCBCEncrypter(block, c.aesKey[:block.BlockSize()]).CryptBlocks(encrypted, padded)
	value := base64.StdEncoding.EncodeToString(encrypted)
	return value, signatureFor(c.token, timestamp, nonce, value), nil
}

func (c *Crypto) verifySignature(signature string, timestamp string, nonce string, encrypted string) error {
	if signature == "" || timestamp == "" || nonce == "" || encrypted == "" {
		return fmt.Errorf("wecomcallback: missing signature parameters")
	}
	if signatureFor(c.token, timestamp, nonce, encrypted) != signature {
		return fmt.Errorf("wecomcallback: invalid signature")
	}
	return nil
}

func (c *Crypto) decrypt(encrypted string) (string, string, error) {
	ciphertext, err := base64.StdEncoding.DecodeString(encrypted)
	if err != nil {
		return "", "", fmt.Errorf("wecomcallback: decode encrypted payload: %w", err)
	}
	block, err := aes.NewCipher(c.aesKey)
	if err != nil {
		return "", "", err
	}
	if len(ciphertext) == 0 || len(ciphertext)%block.BlockSize() != 0 {
		return "", "", fmt.Errorf("wecomcallback: invalid encrypted payload size")
	}
	plain := make([]byte, len(ciphertext))
	cipher.NewCBCDecrypter(block, c.aesKey[:block.BlockSize()]).CryptBlocks(plain, ciphertext)
	unpadded, err := pkcs7Unpad(plain, weComPKCS7BlockSize)
	if err != nil {
		return "", "", err
	}
	if len(unpadded) < 20 {
		return "", "", fmt.Errorf("wecomcallback: decrypted payload too short")
	}
	messageLength := int(binary.BigEndian.Uint32(unpadded[16:20]))
	messageStart := 20
	messageEnd := messageStart + messageLength
	if messageLength < 0 || messageEnd > len(unpadded) {
		return "", "", fmt.Errorf("wecomcallback: invalid decrypted message length")
	}
	receivedID := string(unpadded[messageEnd:])
	return string(unpadded[messageStart:messageEnd]), receivedID, nil
}

func signatureFor(token string, timestamp string, nonce string, encrypted string) string {
	values := []string{token, timestamp, nonce, encrypted}
	sort.Strings(values)
	hash := sha1.Sum([]byte(values[0] + values[1] + values[2] + values[3]))
	return hex.EncodeToString(hash[:])
}

func pkcs7Pad(data []byte, blockSize int) []byte {
	padding := blockSize - len(data)%blockSize
	return append(data, bytes.Repeat([]byte{byte(padding)}, padding)...)
}

func pkcs7Unpad(data []byte, blockSize int) ([]byte, error) {
	if len(data) == 0 || len(data)%blockSize != 0 {
		return nil, fmt.Errorf("wecomcallback: invalid pkcs7 data size")
	}
	padding := int(data[len(data)-1])
	if padding == 0 || padding > blockSize || padding > len(data) {
		return nil, fmt.Errorf("wecomcallback: invalid pkcs7 padding")
	}
	for _, value := range data[len(data)-padding:] {
		if int(value) != padding {
			return nil, fmt.Errorf("wecomcallback: invalid pkcs7 padding bytes")
		}
	}
	return data[:len(data)-padding], nil
}
