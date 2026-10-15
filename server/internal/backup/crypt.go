package backup

import (
	"bytes"
	"compress/gzip"
	"crypto/aes"
	"crypto/cipher"
	"crypto/pbkdf2"
	"crypto/rand"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"io"
)

const magic = "MAVRIBK1" // marks an encrypted backup

const pbkdf2Rounds = 210_000

// ErrPassphrase means the passphrase is missing or wrong.
var ErrPassphrase = errors.New("the passphrase is missing or wrong")

// IsEncrypted reports whether data is an encrypted backup.
func IsEncrypted(data []byte) bool { return bytes.HasPrefix(data, []byte(magic)) }

// Encrypt seals data with AES-256-GCM under a key derived from the passphrase (PBKDF2-SHA256).
// Layout: magic, 16-byte salt, 12-byte nonce, ciphertext.
func Encrypt(data []byte, pass string) ([]byte, error) {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return nil, err
	}
	key, err := pbkdf2.Key(sha256.New, pass, salt, pbkdf2Rounds, 32)
	if err != nil {
		return nil, err
	}
	blk, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(blk)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	head := append([]byte(magic), salt...)
	head = append(head, nonce...)
	return gcm.Seal(head, nonce, data, []byte(magic)), nil
}

// Decrypt reverses Encrypt.
func Decrypt(data []byte, pass string) ([]byte, error) {
	if !IsEncrypted(data) || len(data) < len(magic)+16+12+16 {
		return nil, ErrInvalid
	}
	if pass == "" {
		return nil, ErrPassphrase
	}
	salt := data[len(magic) : len(magic)+16]
	nonce := data[len(magic)+16 : len(magic)+28]
	key, err := pbkdf2.Key(sha256.New, pass, salt, pbkdf2Rounds, 32)
	if err != nil {
		return nil, err
	}
	blk, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(blk)
	if err != nil {
		return nil, err
	}
	plain, err := gcm.Open(nil, nonce, data[len(magic)+28:], []byte(magic))
	if err != nil {
		return nil, ErrPassphrase
	}
	return plain, nil
}

// Pack turns a backup into a file: JSON, gzip, and encryption when a passphrase is given.
func Pack(f File, pass string) ([]byte, error) {
	var buf bytes.Buffer
	zw := gzip.NewWriter(&buf)
	if err := json.NewEncoder(zw).Encode(f); err != nil {
		return nil, err
	}
	if err := zw.Close(); err != nil {
		return nil, err
	}
	if pass == "" {
		return buf.Bytes(), nil
	}
	return Encrypt(buf.Bytes(), pass)
}

// Unpack reads a file made by Pack (or by the plain download), decrypting if needed.
func Unpack(data []byte, pass string) (File, error) {
	var err error
	if IsEncrypted(data) {
		if data, err = Decrypt(data, pass); err != nil {
			return File{}, err
		}
	}
	zr, err := gzip.NewReader(bytes.NewReader(data))
	if err != nil {
		return File{}, ErrInvalid
	}
	raw, err := io.ReadAll(io.LimitReader(zr, 256<<20))
	if err != nil {
		return File{}, ErrInvalid
	}
	return Parse(raw)
}

// Counts is the number of rows per table, for the recovery check.
func Counts(f File) map[string]int {
	out := map[string]int{}
	for _, t := range tables {
		out[t] = len(f.Tables[t])
	}
	return out
}
